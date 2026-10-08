package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// SessionSummary is one omp session as shown in the sidebar.
type SessionSummary struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Cwd     string `json:"cwd"`
	Created int64  `json:"createdMs"`
	Updated int64  `json:"updatedMs"`
}

// SessionGroup collects the sessions that ran in one working directory.
type SessionGroup struct {
	Path     string           `json:"path"`
	Name     string           `json:"name"`
	Updated  int64            `json:"updatedMs"`
	Sessions []SessionSummary `json:"sessions"`
}

// sessionHeaderBytes caps how much of each session file is read: the title and
// session records are the first lines, and the title fallback (first user
// message) sits within the first few hundred kilobytes at most. Files grow to
// several megabytes, so they are never read whole.
const sessionHeaderBytes = 256 << 10

const sessionHeaderLines = 300

// sessionRecord mirrors the JSONL records this listing cares about.
type sessionRecord struct {
	Type      string `json:"type"`
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Cwd       string `json:"cwd"`
	Title     string `json:"title"`
	Message   *struct {
		Role    string          `json:"role"`
		Content json.RawMessage `json:"content"`
	} `json:"message"`
}

// ListSessions scans omp's session store and returns sessions grouped by their
// real working directory. Grouping uses the cwd recorded inside each session
// file — the on-disk directory names are lossy encodings and must not be
// decoded.
func (a *App) ListSessions() ([]SessionGroup, error) {
	root, err := sessionsRoot()
	if err != nil {
		return nil, err
	}
	return listSessionsIn(root, os.TempDir())
}

// sessionsRoot resolves the omp sessions directory (~/.omp/agent/sessions,
// overridable with PI_CODING_AGENT_DIR).
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
			// Scratch/test sessions (temp cwd) are noise in a project list.
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

// readSessionSummary extracts one session's summary from its JSONL header.
// ok is false for files that are not sessions (no `session` record).
func readSessionSummary(path, name string) (SessionSummary, bool) {
	file, err := os.Open(path)
	if err != nil {
		return SessionSummary{}, false
	}
	defer file.Close()

	summary := SessionSummary{}
	summary.ID = sessionIDFromName(name)
	summary.Created = createdFromName(name)

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
				switch {
				case record.Type == "session" && record.Cwd != "":
					summary.Cwd = filepath.Clean(record.Cwd)
					if record.ID != "" {
						summary.ID = record.ID
					}
					if ts, perr := time.Parse(time.RFC3339, record.Timestamp); perr == nil {
						summary.Created = ts.UnixMilli()
					}
				case record.Type == "title" && record.Title != "":
					summary.Title = record.Title
				case record.Type == "message" && summary.Title == "" && record.Message != nil && record.Message.Role == "user":
					summary.Title = truncateTitle(userText(record.Message.Content))
				}
			}
		}
		if err != nil {
			break
		}
	}

	if summary.Cwd == "" {
		return SessionSummary{}, false
	}
	if summary.Title == "" {
		summary.Title = "(sesi tanpa judul)"
	}
	if info, err := os.Stat(path); err == nil {
		summary.Updated = info.ModTime().UnixMilli()
	}
	if summary.Created == 0 {
		summary.Created = summary.Updated
	}
	return summary, true
}

// userText extracts plain text from a message content value, which is either
// a string or an array of typed blocks.
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

// sessionIDFromName pulls the session id out of
// `2026-10-08T00-30-23-637Z_01a118eb-1b95-7380-80f2-9285e416b960.jsonl`.
func sessionIDFromName(name string) string {
	base := strings.TrimSuffix(name, ".jsonl")
	if idx := strings.LastIndex(base, "_"); idx >= 0 {
		return base[idx+1:]
	}
	return base
}

// createdFromName parses the leading timestamp of a session file name.
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

// isUnder reports whether path sits inside base (case-insensitive on Windows).
func isUnder(path, base string) bool {
	if path == "" || base == "" {
		return false
	}
	p := strings.ToLower(filepath.Clean(path))
	b := strings.ToLower(filepath.Clean(base))
	return p == b || strings.HasPrefix(p, b+string(filepath.Separator))
}
