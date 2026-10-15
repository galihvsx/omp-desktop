package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type SessionSummary struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Cwd     string `json:"cwd"`
	Path    string `json:"path"`
	Created int64  `json:"createdMs"`
	Updated int64  `json:"updatedMs"`
}

type SessionGroup struct {
	Path     string           `json:"path"`
	Name     string           `json:"name"`
	Updated  int64            `json:"updatedMs"`
	Sessions []SessionSummary `json:"sessions"`
}

type SessionTranscript struct {
	ID       string            `json:"id"`
	Title    string            `json:"title"`
	Cwd      string            `json:"cwd"`
	Created  int64             `json:"created"`
	Updated  int64             `json:"updated"`
	Messages []json.RawMessage `json:"messages"`
}

type SessionPage struct {
	Messages []json.RawMessage `json:"messages"`
	Total    int               `json:"total"`
	Start    int               `json:"start"`
	HasMore  bool              `json:"hasMore"`
}

type ModelOption struct {
	Provider      string   `json:"provider"`
	ID            string   `json:"id"`
	Selector      string   `json:"selector"`
	Name          string   `json:"name"`
	Reasoning     bool     `json:"reasoning"`
	Thinking      []string `json:"thinking"`
	ContextWindow int      `json:"contextWindow"`
}

const sessionHeaderBytes = 256 << 10

const sessionHeaderLines = 300

const sessionMaxLineBytes = 8 << 20

const gitTimeout = 5 * time.Second

const modelsTimeout = 60 * time.Second

type sessionRecord struct {
	Type      string          `json:"type"`
	ID        string          `json:"id"`
	ParentID  *string         `json:"parentId"`
	Timestamp string          `json:"timestamp"`
	Cwd       string          `json:"cwd"`
	Title     string          `json:"title"`
	Message   json.RawMessage `json:"message"`
}

type agentMessage struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`
}

type sessionTitle struct {
	explicit string
	fallback string
}

func (t *sessionTitle) observe(record sessionRecord) {
	switch {
	case record.Type == "title" && record.Title != "":
		t.explicit = record.Title
	case record.Type == "message" && t.fallback == "":
		var msg agentMessage
		if json.Unmarshal(record.Message, &msg) == nil && msg.Role == "user" {
			t.fallback = truncateTitle(userText(msg.Content))
		}
	}
}

func (t *sessionTitle) value() string {
	if t.explicit != "" {
		return t.explicit
	}
	return t.fallback
}

func (a *App) ListSessions() ([]SessionGroup, error) {
	root, err := sessionsRoot()
	if err != nil {
		return nil, err
	}
	return listSessionsIn(root, os.TempDir())
}

func sessionsRoot() (string, error) {
	if dir := strings.TrimSpace(os.Getenv("PI_CODING_AGENT_DIR")); dir != "" {
		return filepath.Join(dir, "sessions"), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("omp sessions: resolve home: %w", err)
	}
	return filepath.Join(home, ".omp", "agent", "sessions"), nil
}

func listSessionsIn(root, skipUnder string) ([]SessionGroup, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return []SessionGroup{}, nil
		}
		return nil, fmt.Errorf("omp sessions: read %s: %w", root, err)
	}

	var skipBase string
	if strings.TrimSpace(skipUnder) != "" {
		skipBase = filepath.Clean(skipUnder)
	}
	byCwd := map[string]*SessionGroup{}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		dir := filepath.Join(root, entry.Name())
		files, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, file := range files {
			if file.IsDir() || !strings.HasSuffix(file.Name(), ".jsonl") {
				continue
			}
			path := filepath.Join(dir, file.Name())
			summary, ok := readSessionSummary(path, file.Name())
			if !ok {
				continue
			}
			if skipBase != "" && isUnder(summary.Cwd, skipBase) {
				continue
			}
			group := byCwd[summary.Cwd]
			if group == nil {
				group = &SessionGroup{
					Path: summary.Cwd,
					Name: filepath.Base(summary.Cwd),
				}
				byCwd[summary.Cwd] = group
			}
			group.Sessions = append(group.Sessions, summary)
			if summary.Updated > group.Updated {
				group.Updated = summary.Updated
			}
		}
	}

	groups := make([]SessionGroup, 0, len(byCwd))
	for _, group := range byCwd {
		sort.Slice(group.Sessions, func(i, j int) bool {
			return group.Sessions[i].Updated > group.Sessions[j].Updated
		})
		groups = append(groups, *group)
	}
	sort.Slice(groups, func(i, j int) bool {
		return groups[i].Updated > groups[j].Updated
	})
	return groups, nil
}

func readSessionSummary(path, name string) (SessionSummary, bool) {
	file, err := os.Open(path)
	if err != nil {
		return SessionSummary{}, false
	}
	defer file.Close()

	summary := SessionSummary{}
	summary.ID = sessionIDFromName(name)
	summary.Path = path
	summary.Created = createdFromName(name)

	title := sessionTitle{}
	reader := bufio.NewReaderSize(file, 64<<10)
	read := 0
	lines := 0
	for lines < sessionHeaderLines && read < sessionHeaderBytes {
		line, err := reader.ReadString('\n')
		read += len(line)
		lines++
		if len(line) > 0 {
			var record sessionRecord
			if json.Unmarshal([]byte(line), &record) == nil {
				if record.Type == "session" && record.Cwd != "" {
					summary.Cwd = filepath.Clean(record.Cwd)
					if record.ID != "" {
						summary.ID = record.ID
					}
					if ts, perr := time.Parse(time.RFC3339, record.Timestamp); perr == nil {
						summary.Created = ts.UnixMilli()
					}
				}
				title.observe(record)
			}
		}
		if err != nil {
			break
		}
	}

	if summary.Cwd == "" {
		return SessionSummary{}, false
	}
	summary.Title = title.value()
	if info, err := os.Stat(path); err == nil {
		summary.Updated = info.ModTime().UnixMilli()
	}
	if summary.Created == 0 {
		summary.Created = summary.Updated
	}
	return summary, true
}

func ReadSession(path string) (SessionTranscript, error) {
	return readSessionTranscript(path)
}

func readSessionTranscript(path string) (SessionTranscript, error) {
	file, err := os.Open(path)
	if err != nil {
		return SessionTranscript{}, fmt.Errorf("omp session: open %s: %w", path, err)
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return SessionTranscript{}, fmt.Errorf("omp session: stat %s: %w", path, err)
	}

	var (
		transcript SessionTranscript
		title      sessionTitle
		records    = map[string]sessionRecord{}
		leaf       string
		found      bool
	)

	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 64<<10), sessionMaxLineBytes)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var record sessionRecord
		if json.Unmarshal(line, &record) != nil {
			continue
		}
		found = true
		title.observe(record)
		if record.Type == "session" {
			if record.ID != "" {
				transcript.ID = record.ID
			}
			if record.Cwd != "" {
				transcript.Cwd = filepath.Clean(record.Cwd)
			}
			if ts, perr := time.Parse(time.RFC3339, record.Timestamp); perr == nil {
				transcript.Created = ts.UnixMilli()
			}
		}
		if record.ID == "" {
			continue
		}
		records[record.ID] = record
		leaf = record.ID
	}
	if err := scanner.Err(); err != nil {
		if errors.Is(err, bufio.ErrTooLong) {
			return SessionTranscript{}, fmt.Errorf("omp session: %s: line exceeds %d bytes", path, sessionMaxLineBytes)
		}
		return SessionTranscript{}, fmt.Errorf("omp session: read %s: %w", path, err)
	}
	if !found {
		return SessionTranscript{}, nil
	}

	transcript.Title = title.value()
	transcript.Updated = info.ModTime().UnixMilli()

	chain := make([]json.RawMessage, 0, 64)
	seen := make(map[string]bool, len(records))
	for id := leaf; id != "" && !seen[id]; {
		seen[id] = true
		record, ok := records[id]
		if !ok {
			break
		}
		if record.Type == "message" && len(record.Message) > 0 {
			chain = append(chain, record.Message)
		}
		if record.ParentID == nil {
			break
		}
		id = *record.ParentID
	}

	if len(chain) > 0 {
		transcript.Messages = make([]json.RawMessage, 0, len(chain))
		for i := len(chain) - 1; i >= 0; i-- {
			transcript.Messages = append(transcript.Messages, chain[i])
		}
	}
	return transcript, nil
}

const (
	sessionPageDefaultLimit = 40
	sessionPageMaxLimit     = 200
)

const sessionPageAlignLookback = 8

func ReadSessionPage(path string, before int, limit int) (SessionPage, error) {
	transcript, err := readSessionTranscript(path)
	if err != nil {
		return SessionPage{}, err
	}
	return windowTranscript(transcript.Messages, before, limit), nil
}

func windowTranscript(messages []json.RawMessage, before, limit int) SessionPage {
	total := len(messages)
	page := SessionPage{Messages: []json.RawMessage{}, Total: total}
	if total == 0 {
		return page
	}

	limit = clampPageLimit(limit)
	end := before
	if end <= 0 || end > total {
		end = total
	}
	start := end - limit
	if start < 0 {
		start = 0
	}
	start = alignWindowStart(messages, start)

	page.Messages = messages[start:end]
	page.Start = start
	page.HasMore = start > 0
	return page
}

func alignWindowStart(messages []json.RawMessage, start int) int {
	for extra := 0; extra < sessionPageAlignLookback && start > 0; extra++ {
		if !isToolResultMessage(messages[start]) {
			break
		}
		start--
	}
	return start
}

func isToolResultMessage(raw json.RawMessage) bool {
	var msg agentMessage
	return json.Unmarshal(raw, &msg) == nil && msg.Role == "toolResult"
}

func clampPageLimit(limit int) int {
	switch {
	case limit <= 0:
		return sessionPageDefaultLimit
	case limit > sessionPageMaxLimit:
		return sessionPageMaxLimit
	default:
		return limit
	}
}

func ListBranches(cwd string) ([]string, error) {
	branches := []string{}
	if strings.TrimSpace(cwd) == "" {
		return branches, nil
	}

	seen := map[string]bool{}
	add := func(name string) {
		if name == "" || seen[name] {
			return
		}
		seen[name] = true
		branches = append(branches, name)
	}

	if current := gitLines(cwd, "rev-parse", "--abbrev-ref", "HEAD"); len(current) > 0 {
		add(current[0])
	}
	for _, name := range gitLines(cwd, "branch", "--format=%(refname:short)") {
		add(name)
	}
	return branches, nil
}

func gitLines(cwd string, args ...string) []string {
	ctx, cancel := context.WithTimeout(context.Background(), gitTimeout)
	defer cancel()

	out, err := exec.CommandContext(ctx, "git", append([]string{"-C", cwd}, args...)...).Output()
	if err != nil {
		return nil
	}
	var lines []string
	for _, line := range strings.Split(string(out), "\n") {
		if line = strings.TrimSpace(line); line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

var (
	modelsMu     sync.Mutex
	modelsCache  []ModelOption
	modelsLoaded bool
)

var modelsRunner = func(ctx context.Context) ([]byte, error) {
	return exec.CommandContext(ctx, rpcCommand, "models", "--json").Output()
}

func ListModels() ([]ModelOption, error) {
	modelsMu.Lock()
	defer modelsMu.Unlock()
	if modelsLoaded {
		return modelsCache, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), modelsTimeout)
	defer cancel()
	out, err := modelsRunner(ctx)
	if err != nil {
		return nil, fmt.Errorf("omp models: %w", err)
	}

	var envelope struct {
		Models []ModelOption `json:"models"`
	}
	if err := json.Unmarshal(out, &envelope); err != nil {
		return nil, fmt.Errorf("omp models: parse: %w", err)
	}

	options := make([]ModelOption, 0, len(envelope.Models))
	for _, model := range envelope.Models {
		if model.Selector == "" {
			continue
		}
		options = append(options, model)
	}
	sort.Slice(options, func(i, j int) bool { return options[i].Selector < options[j].Selector })

	modelsCache = options
	modelsLoaded = true
	return modelsCache, nil
}

func (a *App) ReadSession(path string) (SessionTranscript, error) {
	return ReadSession(path)
}

func (a *App) ReadSessionPage(path string, before int, limit int) (SessionPage, error) {
	return ReadSessionPage(path, before, limit)
}

func (a *App) ListBranches(cwd string) ([]string, error) {
	return ListBranches(cwd)
}

func (a *App) ListModels() ([]ModelOption, error) {
	return ListModels()
}

func userText(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return text
	}
	var blocks []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal(raw, &blocks) == nil {
		for _, block := range blocks {
			if block.Type == "text" && block.Text != "" {
				return block.Text
			}
		}
	}
	return ""
}

func truncateTitle(text string) string {
	text = strings.Join(strings.Fields(text), " ")
	const max = 64
	runes := []rune(text)
	if len(runes) <= max {
		return text
	}
	return strings.TrimSpace(string(runes[:max])) + "…"
}

func sessionIDFromName(name string) string {
	base := strings.TrimSuffix(name, ".jsonl")
	if idx := strings.LastIndex(base, "_"); idx >= 0 {
		return base[idx+1:]
	}
	return base
}

func createdFromName(name string) int64 {
	base := strings.TrimSuffix(name, ".jsonl")
	if len(base) < 19 {
		return 0
	}
	ts, err := time.Parse("2006-01-02T15-04-05", base[:19])
	if err != nil {
		return 0
	}
	return ts.UTC().UnixMilli()
}

func isUnder(path, base string) bool {
	if path == "" || base == "" {
		return false
	}
	p := strings.ToLower(filepath.Clean(path))
	b := strings.ToLower(filepath.Clean(base))
	return p == b || strings.HasPrefix(p, b+string(filepath.Separator))
}
