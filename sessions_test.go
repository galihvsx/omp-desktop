package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func writeSessionFixture(t *testing.T, dir, name, id, cwd, title, firstUserText string, mtime time.Time) string {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", dir, err)
	}
	path := filepath.Join(dir, name)
	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("create %s: %v", path, err)
	}
	defer file.Close()

	writeRecord := func(record map[string]any) {
		t.Helper()
		line, err := json.Marshal(record)
		if err != nil {
			t.Fatalf("marshal record: %v", err)
		}
		if _, err := file.Write(append(line, '\n')); err != nil {
			t.Fatalf("write record: %v", err)
		}
	}

	writeRecord(map[string]any{"type": "title", "v": 1, "title": title, "updatedAt": "2026-10-08T00:30:23.637Z"})
	writeRecord(map[string]any{
		"type": "session", "version": 3, "id": id,
		"timestamp": "2026-10-08T00:30:23.637Z", "cwd": cwd,
	})
	if firstUserText != "" {
		writeRecord(map[string]any{
			"type": "message",
			"message": map[string]any{
				"role":    "user",
				"content": []map[string]any{{"type": "text", "text": firstUserText}},
			},
		})
	}
	if err := os.Chtimes(path, mtime, mtime); err != nil {
		t.Fatalf("chtimes: %v", err)
	}
	return path
}

func TestListSessionsGroupsByCwdAndSorts(t *testing.T) {
	root := t.TempDir()
	projA := filepath.Join(root, "work", "proj-a")
	projB := filepath.Join(root, "work", "proj-b")

	writeSessionFixture(t, filepath.Join(root, "--enc-a--"),
		"2026-10-08T00-30-23-637Z_aaaaaaaa-0000-0000-0000-000000000001.jsonl",
		"aaaaaaaa-0000-0000-0000-000000000001", projA, "",
		"Perbaiki copywriting agar tidak slop", time.Date(2026, 10, 8, 2, 0, 0, 0, time.UTC))
	writeSessionFixture(t, filepath.Join(root, "--enc-a--"),
		"2026-10-07T10-00-00-000Z_aaaaaaaa-0000-0000-0000-000000000002.jsonl",
		"aaaaaaaa-0000-0000-0000-000000000002", projA,
		"Integrasi RPC Mode dengan AI Elements", "",
		time.Date(2026, 10, 7, 10, 0, 0, 0, time.UTC))
	writeSessionFixture(t, filepath.Join(root, "--enc-b--"),
		"2026-10-06T10-00-00-000Z_bbbbbbbb-0000-0000-0000-000000000003.jsonl",
		"bbbbbbbb-0000-0000-0000-000000000003", projB, "Brainstorming Project Ideas", "",
		time.Date(2026, 10, 6, 10, 0, 0, 0, time.UTC))

	groups, err := listSessionsIn(root, "")
	if err != nil {
		t.Fatalf("listSessionsIn: %v", err)
	}
	if len(groups) != 2 {
		t.Fatalf("expected 2 groups, got %d: %+v", len(groups), groups)
	}

	if groups[0].Name != "proj-a" || groups[1].Name != "proj-b" {
		t.Fatalf("group order wrong: %s, %s", groups[0].Name, groups[1].Name)
	}
	if groups[0].Path != projA {
		t.Fatalf("group path should be the real cwd, got %s", groups[0].Path)
	}

	sessions := groups[0].Sessions
	if len(sessions) != 2 {
		t.Fatalf("expected 2 sessions in proj-a, got %d", len(sessions))
	}
	if sessions[0].ID != "aaaaaaaa-0000-0000-0000-000000000001" {
		t.Fatalf("session order wrong, first = %s", sessions[0].ID)
	}
	if sessions[0].Title != "Perbaiki copywriting agar tidak slop" {
		t.Fatalf("title fallback wrong: %q", sessions[0].Title)
	}
	if sessions[1].Title != "Integrasi RPC Mode dengan AI Elements" {
		t.Fatalf("title from record wrong: %q", sessions[1].Title)
	}
	wantCreated := time.Date(2026, 10, 8, 0, 30, 23, 637_000_000, time.UTC).UnixMilli()
	if sessions[0].Created != wantCreated {
		t.Fatalf("created = %d, want %d", sessions[0].Created, wantCreated)
	}
	wantUpdated := time.Date(2026, 10, 8, 2, 0, 0, 0, time.UTC).UnixMilli()
	if sessions[0].Updated != wantUpdated {
		t.Fatalf("updated = %d, want %d", sessions[0].Updated, wantUpdated)
	}
}

func TestSessionSummaryCarriesPath(t *testing.T) {
	root := t.TempDir()
	const id = "eeeeeeee-0000-0000-0000-000000000005"
	name := "2026-10-08T00-30-23-637Z_" + id + ".jsonl"
	path := writeSessionFixture(t, filepath.Join(root, "--enc-path--"), name, id,
		filepath.Join(root, "work"), "Sesi dengan path", "",
		time.Date(2026, 10, 8, 2, 0, 0, 0, time.UTC))

	summary, ok := readSessionSummary(path, name)
	if !ok {
		t.Fatalf("readSessionSummary(%q) reported no summary", path)
	}
	if summary.Path != path {
		t.Fatalf("summary path = %q, want %q", summary.Path, path)
	}
	if summary.ID != id {
		t.Fatalf("summary id = %q, want the session id %q", summary.ID, id)
	}

	groups, err := listSessionsIn(root, "")
	if err != nil {
		t.Fatalf("listSessionsIn: %v", err)
	}
	if len(groups) != 1 || len(groups[0].Sessions) != 1 {
		t.Fatalf("expected one group with one session, got %+v", groups)
	}
	if got := groups[0].Sessions[0].Path; got != path {
		t.Fatalf("listed summary path = %q, want %q", got, path)
	}
	if got := groups[0].Sessions[0].ID; got != id {
		t.Fatalf("listed summary id = %q, want %q", got, id)
	}
}

func TestListSessionsSkipsConfiguredBaseAndNonSessions(t *testing.T) {
	root := t.TempDir()
	scratch := filepath.Join(root, "scratch")

	writeSessionFixture(t, filepath.Join(root, "--enc--"),
		"2026-10-08T00-30-23-637Z_cccccccc-0000-0000-0000-000000000004.jsonl",
		"cccccccc-0000-0000-0000-000000000004", scratch, "Sesi scratch", "",
		time.Date(2026, 10, 8, 3, 0, 0, 0, time.UTC))
	stray := filepath.Join(root, "--enc--", "2026-10-08T00-00-00-000Z_stray.jsonl")
	if err := os.WriteFile(stray, []byte("{\"type\":\"message\"}\n"), 0o644); err != nil {
		t.Fatalf("write stray: %v", err)
	}

	all, err := listSessionsIn(root, "")
	if err != nil {
		t.Fatalf("listSessionsIn: %v", err)
	}
	if len(all) != 1 || len(all[0].Sessions) != 1 {
		t.Fatalf("expected the scratch session, got %+v", all)
	}

	filtered, err := listSessionsIn(root, root)
	if err != nil {
		t.Fatalf("listSessionsIn filtered: %v", err)
	}
	if len(filtered) != 0 {
		t.Fatalf("expected scratch sessions filtered out, got %+v", filtered)
	}
}

func TestListSessionsMissingRootIsEmpty(t *testing.T) {
	groups, err := listSessionsIn(filepath.Join(t.TempDir(), "does-not-exist"), "")
	if err != nil {
		t.Fatalf("missing root should not error: %v", err)
	}
	if len(groups) != 0 {
		t.Fatalf("expected empty result, got %+v", groups)
	}
}

func TestTruncateTitleCollapsesWhitespace(t *testing.T) {
	if got := truncateTitle("  hello   world \n"); got != "hello world" {
		t.Fatalf("got %q", got)
	}
	runes := make([]rune, 100)
	for i := range runes {
		runes[i] = 'a'
	}
	got := truncateTitle(string(runes))
	if len([]rune(got)) != 65 {
		t.Fatalf("expected 64 runes plus ellipsis, got %d (%q)", len([]rune(got)), got)
	}
}

func writeSessionLines(t *testing.T, dir, name string, lines ...string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
	return path
}

func sessionMessageLine(id, parentID, role, text string) (line, message string) {
	parent := json.RawMessage("null")
	if parentID != "" {
		parent = json.RawMessage(strconv.Quote(parentID))
	}
	payload := map[string]any{
		"role":    role,
		"content": []map[string]any{{"type": "text", "text": text}},
	}
	record := map[string]any{
		"type":     "message",
		"id":       id,
		"parentId": parent,
		"message":  payload,
	}
	encoded, err := json.Marshal(record)
	if err != nil {
		panic(err)
	}
	wrapped, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}
	return string(encoded), string(wrapped)
}

type decodedMessage struct {
	Role    string `json:"role"`
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

func decodeMessage(t *testing.T, raw json.RawMessage) decodedMessage {
	t.Helper()
	var msg decodedMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		t.Fatalf("decode message %s: %v", raw, err)
	}
	return msg
}

func TestReadSessionFollowsLeafBranch(t *testing.T) {
	dir := t.TempDir()
	userLine, userMsg := sessionMessageLine("m1", "", "user", "first")
	assistantLine, assistantMsg := sessionMessageLine("m2", "c1", "assistant", "second")
	siblingLine, _ := sessionMessageLine("x1", "m1", "assistant", "off chain")
	toolLine, toolMsg := sessionMessageLine("m3", "m2", "toolResult", "third")

	path := writeSessionLines(
		t, dir, "branch.jsonl",
		`{"type":"title","v":1,"title":"Branch fixture"}`,
		`{"type":"session","version":3,"id":"sess-branch","timestamp":"2026-10-07T16:11:25.369Z","cwd":"C:\\work\\proj"}`,
		userLine,
		`{"type":"custom","id":"c1","parentId":"m1","data":{}}`,
		assistantLine,
		siblingLine,
		toolLine,
	)

	transcript, err := ReadSession(path)
	if err != nil {
		t.Fatalf("ReadSession: %v", err)
	}
	if transcript.ID != "sess-branch" {
		t.Fatalf("id = %q, want sess-branch", transcript.ID)
	}
	if want := filepath.Clean(`C:\work\proj`); transcript.Cwd != want {
		t.Fatalf("cwd = %q, want %q", transcript.Cwd, want)
	}
	if transcript.Title != "Branch fixture" {
		t.Fatalf("title = %q", transcript.Title)
	}
	wantCreated := time.Date(2026, 10, 7, 16, 11, 25, 369_000_000, time.UTC).UnixMilli()
	if transcript.Created != wantCreated {
		t.Fatalf("created = %d, want %d", transcript.Created, wantCreated)
	}
	if transcript.Updated == 0 {
		t.Fatal("updated must come from the file mtime")
	}

	want := []string{userMsg, assistantMsg, toolMsg}
	if len(transcript.Messages) != len(want) {
		t.Fatalf("got %d messages, want %d: %s", len(transcript.Messages), len(want), transcript.Messages)
	}
	for i, expected := range want {
		if string(transcript.Messages[i]) != expected {
			t.Fatalf("message %d = %s, want %s", i, transcript.Messages[i], expected)
		}
	}
}

func TestReadSessionTitlePrecedence(t *testing.T) {
	const session = `{"type":"session","version":3,"id":"sess-title","timestamp":"2026-10-08T00:30:23.637Z","cwd":"C:\\work\\title"}`
	msg := func(id, parent, role, text string) string {
		line, _ := sessionMessageLine(id, parent, role, text)
		return line
	}

	cases := []struct {
		name  string
		lines []string
		want  string
	}{
		{
			name: "title record wins",
			lines: []string{
				session,
				msg("m1", "", "user", "first user text"),
				`{"type":"title","v":1,"title":"Explicit title"}`,
			},
			want: "Explicit title",
		},
		{
			name: "falls back to the first user message",
			lines: []string{
				session,
				msg("m1", "", "user", "Perbaiki sidebar"),
				msg("m2", "m1", "user", "second user message"),
			},
			want: "Perbaiki sidebar",
		},
		{
			name: "truncates a long fallback",
			lines: []string{
				session,
				msg("m1", "", "user", strings.Repeat("a", 100)),
			},
			want: strings.Repeat("a", 64) + "…",
		},
		{
			name: "empty without a title record or user message",
			lines: []string{
				session,
				msg("m1", "", "assistant", "no user turn"),
			},
			want: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := writeSessionLines(t, t.TempDir(), "title.jsonl", tc.lines...)
			transcript, err := ReadSession(path)
			if err != nil {
				t.Fatalf("ReadSession: %v", err)
			}
			if transcript.Title != tc.want {
				t.Fatalf("title = %q, want %q", transcript.Title, tc.want)
			}
		})
	}
}

func TestReadSessionEmptyAndMissing(t *testing.T) {
	dir := t.TempDir()

	empty := filepath.Join(dir, "empty.jsonl")
	if err := os.WriteFile(empty, nil, 0o644); err != nil {
		t.Fatalf("write empty: %v", err)
	}
	transcript, err := ReadSession(empty)
	if err != nil {
		t.Fatalf("empty file must not error: %v", err)
	}
	if !reflect.DeepEqual(transcript, SessionTranscript{}) {
		t.Fatalf("empty file must yield the zero-value transcript, got %+v", transcript)
	}

	if _, err := ReadSession(filepath.Join(dir, "does-not-exist.jsonl")); err == nil {
		t.Fatal("missing file must return an error")
	}
}

func TestReadSessionCyclicParentTerminates(t *testing.T) {
	const session = `{"type":"session","version":3,"id":"sess-cycle","timestamp":"2026-10-08T00:30:23.637Z","cwd":"C:\\work\\cycle"}`
	msg := func(id, parent, role, text string) string {
		line, _ := sessionMessageLine(id, parent, role, text)
		return line
	}

	cases := []struct {
		name  string
		lines []string
		want  int
	}{
		{
			name: "self reference",
			lines: []string{
				session,
				msg("a", "a", "user", "loop"),
			},
			want: 1,
		},
		{
			name: "two record cycle",
			lines: []string{
				session,
				msg("a", "b", "user", "one"),
				msg("b", "a", "assistant", "two"),
			},
			want: 2,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := writeSessionLines(t, t.TempDir(), "cycle.jsonl", tc.lines...)

			type result struct {
				transcript SessionTranscript
				err        error
			}
			done := make(chan result, 1)
			go func() {
				transcript, err := ReadSession(path)
				done <- result{transcript, err}
			}()

			select {
			case got := <-done:
				if got.err != nil {
					t.Fatalf("ReadSession: %v", got.err)
				}
				if len(got.transcript.Messages) != tc.want {
					t.Fatalf("got %d messages, want %d", len(got.transcript.Messages), tc.want)
				}
			case <-time.After(10 * time.Second):
				t.Fatal("ReadSession hung on a cyclic parentId")
			}
		})
	}
}

func TestReadSessionRejectsOversizedLine(t *testing.T) {
	path := filepath.Join(t.TempDir(), "huge.jsonl")
	huge := strings.Repeat("x", sessionMaxLineBytes+1)
	if err := os.WriteFile(path, []byte(huge), 0o644); err != nil {
		t.Fatalf("write huge: %v", err)
	}

	_, err := ReadSession(path)
	if err == nil {
		t.Fatal("a line over the cap must be an error, not a silent skip")
	}
	if !strings.Contains(err.Error(), "exceeds") {
		t.Fatalf("error should name the cap, got %v", err)
	}
}

func runGit(t *testing.T, dir string, args ...string) string {
	t.Helper()
	out, err := exec.Command("git", append([]string{"-C", dir}, args...)...).CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
	return string(out)
}

func TestListBranchesCurrentFirstAndNonRepo(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not on PATH")
	}

	repo := t.TempDir()
	runGit(t, repo, "init")
	runGit(t, repo,
		"-c", "user.email=omp@example.com", "-c", "user.name=OMP Test", "-c", "commit.gpgsign=false",
		"commit", "--allow-empty", "-m", "init")
	runGit(t, repo, "branch", "feature/sidebar")

	current := strings.TrimSpace(runGit(t, repo, "rev-parse", "--abbrev-ref", "HEAD"))
	branches, err := ListBranches(repo)
	if err != nil {
		t.Fatalf("ListBranches: %v", err)
	}
	if len(branches) != 2 {
		t.Fatalf("want the current branch plus feature/sidebar, got %v", branches)
	}
	if branches[0] != current {
		t.Fatalf("current branch must come first: got %v, current is %q", branches, current)
	}
	if branches[1] != "feature/sidebar" {
		t.Fatalf("want feature/sidebar second, got %v", branches)
	}

	plain := t.TempDir()
	t.Setenv("GIT_CEILING_DIRECTORIES", filepath.Dir(plain))
	empty, err := ListBranches(plain)
	if err != nil {
		t.Fatalf("non-repo directory must not error: %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("want no branches, got %v", empty)
	}
}

func resetModelsCache(t *testing.T) {
	t.Helper()
	modelsMu.Lock()
	oldCache, oldLoaded := modelsCache, modelsLoaded
	modelsCache, modelsLoaded = nil, false
	modelsMu.Unlock()
	t.Cleanup(func() {
		modelsMu.Lock()
		modelsCache, modelsLoaded = oldCache, oldLoaded
		modelsMu.Unlock()
	})
}

func TestListModelsSortsSkipsEmptySelectorAndCaches(t *testing.T) {
	resetModelsCache(t)
	oldRunner := modelsRunner
	t.Cleanup(func() { modelsRunner = oldRunner })

	var calls int32
	modelsRunner = func(context.Context) ([]byte, error) {
		atomic.AddInt32(&calls, 1)
		time.Sleep(20 * time.Millisecond)
		return []byte(`{"models":[
			{"provider":"zeta","kind":"chat","id":"z1","selector":"zeta/z1","name":"Zeta One","contextWindow":1000,"maxTokens":10,"reasoning":false,"thinking":[],"input":["text"],"cost":{}},
			{"provider":"alpha","kind":"chat","id":"a1","selector":"alpha/a1","name":"Alpha One","contextWindow":2000,"maxTokens":20,"reasoning":true,"thinking":["low","high"],"input":["text","image"],"cost":{},"pricingStatus":"unknown"},
			{"provider":"ghost","kind":"chat","id":"g1","selector":"","name":"No selector","contextWindow":1,"maxTokens":1,"reasoning":false,"thinking":[]}
		]}`), nil
	}

	const callers = 8
	results := make([][]ModelOption, callers)
	errs := make([]error, callers)
	var wg sync.WaitGroup
	for i := range callers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results[i], errs[i] = ListModels()
		}()
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("caller %d: %v", i, err)
		}
	}
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Fatalf("the listing child ran %d times, want 1: the cache must be shared", got)
	}
	if !reflect.DeepEqual(results[0], results[callers-1]) {
		t.Fatalf("callers saw different lists: %+v vs %+v", results[0], results[callers-1])
	}

	models := results[0]
	if len(models) != 2 {
		t.Fatalf("want 2 usable models (empty selector skipped), got %d: %+v", len(models), models)
	}
	if models[0].Selector != "alpha/a1" || models[1].Selector != "zeta/z1" {
		t.Fatalf("want selector-sorted models, got %+v", models)
	}
	first := models[0]
	if first.Provider != "alpha" || first.ID != "a1" || first.Name != "Alpha One" ||
		!first.Reasoning || first.ContextWindow != 2000 {
		t.Fatalf("model fields not mapped: %+v", first)
	}
	if !reflect.DeepEqual(first.Thinking, []string{"low", "high"}) {
		t.Fatalf("thinking levels not mapped: %+v", first.Thinking)
	}
}

func TestListModelsFailureIsErrorAndDoesNotPoisonCache(t *testing.T) {
	resetModelsCache(t)
	oldRunner := modelsRunner
	t.Cleanup(func() { modelsRunner = oldRunner })

	modelsRunner = func(context.Context) ([]byte, error) { return nil, errors.New("child exploded") }
	if _, err := ListModels(); err == nil {
		t.Fatal("a failing listing child must be an error")
	}

	modelsRunner = func(context.Context) ([]byte, error) { return []byte("not json"), nil }
	if _, err := ListModels(); err == nil {
		t.Fatal("malformed listing output must be an error")
	}

	modelsRunner = func(context.Context) ([]byte, error) {
		return []byte(`{"models":[{"provider":"p","id":"i","selector":"p/i","name":"P"}]}`), nil
	}
	models, err := ListModels()
	if err != nil {
		t.Fatalf("retry after failure: %v", err)
	}
	if len(models) != 1 || models[0].Selector != "p/i" {
		t.Fatalf("want the retried model, got %+v", models)
	}
}

func TestListModelsLiveOmpSmoke(t *testing.T) {
	if os.Getenv("OMP_LIVE_SMOKE") != "1" {
		t.Skip("set OMP_LIVE_SMOKE=1 to run against the real omp CLI")
	}
	resetModelsCache(t)

	models, err := ListModels()
	if err != nil {
		t.Fatalf("ListModels: %v", err)
	}
	if len(models) == 0 {
		t.Fatal("expected at least one model")
	}
	for i, model := range models {
		if model.Selector == "" {
			t.Fatalf("model %d has an empty selector: %+v", i, model)
		}
		if i > 0 && models[i-1].Selector > model.Selector {
			t.Fatalf("models are not sorted at %d: %q > %q", i, models[i-1].Selector, model.Selector)
		}
	}
}

const (
	realSessionDir  = "--D--playground-omp-desktop--"
	realSessionName = "2026-10-07T16-11-25-369Z_01a11722-4939-773e-8efd-73be59c0cf63.jsonl"
)

func TestReadSessionRealFile(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skipf("no home directory: %v", err)
	}
	path := filepath.Join(home, ".omp", "agent", "sessions", realSessionDir, realSessionName)
	if _, err := os.Stat(path); err != nil {
		t.Skipf("real session file not present: %v", err)
	}

	transcript, err := ReadSession(path)
	if err != nil {
		t.Fatalf("ReadSession(%s): %v", path, err)
	}
	if len(transcript.Messages) < 600 {
		t.Fatalf("expected at least 600 messages, got %d", len(transcript.Messages))
	}
	if transcript.ID == "" || transcript.Cwd == "" || transcript.Title == "" {
		t.Fatalf("session metadata missing: %+v", transcript)
	}
	if transcript.Created == 0 || transcript.Updated == 0 {
		t.Fatalf("timestamps missing: created=%d updated=%d", transcript.Created, transcript.Updated)
	}

	first := decodeMessage(t, transcript.Messages[0])
	if first.Role != "user" {
		t.Fatalf("first message role = %q, want user", first.Role)
	}
	last := decodeMessage(t, transcript.Messages[len(transcript.Messages)-1])
	if last.Role != "assistant" && last.Role != "toolResult" {
		t.Fatalf("last message role = %q, want assistant or toolResult", last.Role)
	}
	t.Logf("real session: %d messages, id=%s, cwd=%s, created=%d, updated=%d, title=%q",
		len(transcript.Messages), transcript.ID, transcript.Cwd, transcript.Created, transcript.Updated, transcript.Title)
}

func writeChainedSession(t *testing.T, n int) (string, []string) {
	t.Helper()
	lines := []string{
		`{"type":"title","v":1,"title":"Chain fixture"}`,
		`{"type":"session","version":3,"id":"sess-chain","timestamp":"2026-10-08T00:30:23.637Z","cwd":"C:\\work\\chain"}`,
	}
	messages := make([]string, 0, n)
	for i := 1; i <= n; i++ {
		id := "m" + strconv.Itoa(i)
		parent := ""
		if i > 1 {
			parent = "m" + strconv.Itoa(i-1)
		}
		role := "user"
		if i%2 == 0 {
			role = "assistant"
		}
		line, msg := sessionMessageLine(id, parent, role, "msg-"+strconv.Itoa(i))
		lines = append(lines, line)
		messages = append(messages, msg)
	}
	path := writeSessionLines(t, t.TempDir(), "chain.jsonl", lines...)
	return path, messages
}

func assertMessagesEqual(t *testing.T, got []json.RawMessage, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("got %d messages, want %d", len(got), len(want))
	}
	for i := range want {
		if string(got[i]) != want[i] {
			t.Fatalf("message %d = %s, want %s", i, got[i], want[i])
		}
	}
}

func TestReadSessionPageLastWindow(t *testing.T) {
	const n, limit = 95, 40
	path, want := writeChainedSession(t, n)

	transcript, err := ReadSession(path)
	if err != nil {
		t.Fatalf("ReadSession: %v", err)
	}
	assertMessagesEqual(t, transcript.Messages, want)

	page, err := ReadSessionPage(path, 0, limit)
	if err != nil {
		t.Fatalf("ReadSessionPage: %v", err)
	}
	if page.Total != n {
		t.Fatalf("total = %d, want %d", page.Total, n)
	}
	if page.Start != n-limit {
		t.Fatalf("start = %d, want %d", page.Start, n-limit)
	}
	if !page.HasMore {
		t.Fatal("hasMore must be true when earlier messages remain")
	}
	assertMessagesEqual(t, page.Messages, want[n-limit:])
}

func TestReadSessionPageEarlierWindow(t *testing.T) {
	const n, limit = 95, 40
	path, want := writeChainedSession(t, n)

	first, err := ReadSessionPage(path, 0, limit)
	if err != nil {
		t.Fatalf("first page: %v", err)
	}
	second, err := ReadSessionPage(path, first.Start, limit)
	if err != nil {
		t.Fatalf("second page: %v", err)
	}
	if second.Total != n {
		t.Fatalf("total = %d, want %d", second.Total, n)
	}
	if second.Start != n-2*limit {
		t.Fatalf("start = %d, want %d", second.Start, n-2*limit)
	}
	if !second.HasMore {
		t.Fatal("hasMore must be true: messages remain before this window")
	}
	assertMessagesEqual(t, second.Messages, want[n-2*limit:n-limit])
}

func TestReadSessionPageWalkReconstructsTranscript(t *testing.T) {
	const n, limit = 95, 40
	path, want := writeChainedSession(t, n)

	transcript, err := ReadSession(path)
	if err != nil {
		t.Fatalf("ReadSession: %v", err)
	}

	var collected []json.RawMessage
	before := 0
	for pages := 0; ; pages++ {
		if pages > n {
			t.Fatal("page walk did not terminate")
		}
		page, err := ReadSessionPage(path, before, limit)
		if err != nil {
			t.Fatalf("page at before=%d: %v", before, err)
		}
		collected = append(append([]json.RawMessage{}, page.Messages...), collected...)
		if !page.HasMore {
			break
		}
		before = page.Start
	}

	assertMessagesEqual(t, collected, want)
	if len(collected) != len(transcript.Messages) {
		t.Fatalf("walked %d messages, transcript has %d", len(collected), len(transcript.Messages))
	}
	for i := range collected {
		if string(collected[i]) != string(transcript.Messages[i]) {
			t.Fatalf("walked message %d = %s, transcript = %s", i, collected[i], transcript.Messages[i])
		}
	}
}

func TestReadSessionPageClamps(t *testing.T) {
	const n = 250
	path, _ := writeChainedSession(t, n)

	def, err := ReadSessionPage(path, 0, 0)
	if err != nil {
		t.Fatalf("default limit: %v", err)
	}
	if len(def.Messages) != 40 || def.Start != n-40 || !def.HasMore {
		t.Fatalf("default limit page = start %d, len %d, hasMore %v", def.Start, len(def.Messages), def.HasMore)
	}

	big, err := ReadSessionPage(path, 0, 10_000)
	if err != nil {
		t.Fatalf("clamped limit: %v", err)
	}
	if len(big.Messages) != 200 || big.Start != n-200 || !big.HasMore {
		t.Fatalf("clamped limit page = start %d, len %d, hasMore %v", big.Start, len(big.Messages), big.HasMore)
	}

	past, err := ReadSessionPage(path, n+1000, 40)
	if err != nil {
		t.Fatalf("before past the end: %v", err)
	}
	if past.Start != n-40 || len(past.Messages) != 40 || !past.HasMore {
		t.Fatalf("clamped before page = start %d, len %d, hasMore %v", past.Start, len(past.Messages), past.HasMore)
	}
}

func TestReadSessionPageEmptyAndMissing(t *testing.T) {
	dir := t.TempDir()

	empty := filepath.Join(dir, "empty.jsonl")
	if err := os.WriteFile(empty, nil, 0o644); err != nil {
		t.Fatalf("write empty: %v", err)
	}
	page, err := ReadSessionPage(empty, 0, 0)
	if err != nil {
		t.Fatalf("empty file must not error: %v", err)
	}
	if page.Total != 0 || page.Start != 0 || page.HasMore || len(page.Messages) != 0 {
		t.Fatalf("empty file page = %+v", page)
	}

	if _, err := ReadSessionPage(filepath.Join(dir, "missing.jsonl"), 0, 0); err == nil {
		t.Fatal("missing file must return an error")
	}
}

func encodeMessageRecord(id, parentID string, payload map[string]any) (line, message string) {
	parent := json.RawMessage("null")
	if parentID != "" {
		parent = json.RawMessage(strconv.Quote(parentID))
	}
	record := map[string]any{
		"type":     "message",
		"id":       id,
		"parentId": parent,
		"message":  payload,
	}
	encoded, err := json.Marshal(record)
	if err != nil {
		panic(err)
	}
	wrapped, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}
	return string(encoded), string(wrapped)
}

func toolCallMessageLine(id, parentID, callID string) (line, message string) {
	return encodeMessageRecord(id, parentID, map[string]any{
		"role": "assistant",
		"content": []map[string]any{
			{"type": "toolCall", "toolCallId": callID, "toolName": "read", "input": map[string]any{}},
		},
	})
}

func toolResultMessageLine(id, parentID, callID string) (line, message string) {
	return encodeMessageRecord(id, parentID, map[string]any{
		"role": "toolResult",
		"content": []map[string]any{
			{"type": "toolResult", "toolCallId": callID, "output": "ok"},
		},
	})
}

func TestReadSessionPageAlignsToolResultBoundary(t *testing.T) {
	const n, limit = 45, 40
	const callIndex = 4

	lines := []string{
		`{"type":"title","v":1,"title":"Align fixture"}`,
		`{"type":"session","version":3,"id":"sess-align","timestamp":"2026-10-08T00:30:23.637Z","cwd":"C:\\work\\align"}`,
	}
	var want []string
	for i := range n {
		id := "m" + strconv.Itoa(i+1)
		parent := ""
		if i > 0 {
			parent = "m" + strconv.Itoa(i)
		}
		var line, msg string
		switch i {
		case callIndex:
			line, msg = toolCallMessageLine(id, parent, "call-1")
		case callIndex + 1:
			line, msg = toolResultMessageLine(id, parent, "call-1")
		default:
			role := "user"
			if i%2 == 1 {
				role = "assistant"
			}
			line, msg = sessionMessageLine(id, parent, role, "msg-"+strconv.Itoa(i))
		}
		lines = append(lines, line)
		want = append(want, msg)
	}
	path := writeSessionLines(t, t.TempDir(), "align.jsonl", lines...)

	transcript, err := ReadSession(path)
	if err != nil {
		t.Fatalf("ReadSession: %v", err)
	}
	assertMessagesEqual(t, transcript.Messages, want)

	page, err := ReadSessionPage(path, 0, limit)
	if err != nil {
		t.Fatalf("ReadSessionPage: %v", err)
	}
	if isToolResultMessage(page.Messages[0]) {
		t.Fatalf("window opened on a bare toolResult: %s", page.Messages[0])
	}
	if got := decodeMessage(t, page.Messages[0]); got.Role != "assistant" {
		t.Fatalf("first message role = %q, want assistant", got.Role)
	}
	if page.Start != n-limit-1 {
		t.Fatalf("start = %d, want %d", page.Start, n-limit-1)
	}
	if !page.HasMore {
		t.Fatal("hasMore must be true: messages remain before the adjusted start")
	}
	assertMessagesEqual(t, page.Messages, want[n-limit-1:])

	earlier, err := ReadSessionPage(path, page.Start, limit)
	if err != nil {
		t.Fatalf("earlier page: %v", err)
	}
	if earlier.Start != 0 || earlier.HasMore {
		t.Fatalf("earlier page = start %d, hasMore %v, want start 0 / hasMore false", earlier.Start, earlier.HasMore)
	}
	assertMessagesEqual(t, earlier.Messages, want[:n-limit-1])

	combined := append(append([]json.RawMessage{}, earlier.Messages...), page.Messages...)
	if len(combined) != len(transcript.Messages) {
		t.Fatalf("combined %d messages, transcript has %d", len(combined), len(transcript.Messages))
	}
	for i := range combined {
		if string(combined[i]) != string(transcript.Messages[i]) {
			t.Fatalf("combined message %d = %s, transcript = %s", i, combined[i], transcript.Messages[i])
		}
	}

	normal, err := ReadSessionPage(path, 0, limit-1)
	if err != nil {
		t.Fatalf("normal window: %v", err)
	}
	if normal.Start != n-limit+1 {
		t.Fatalf("normal window start = %d, want %d (no extension)", normal.Start, n-limit+1)
	}
	if isToolResultMessage(normal.Messages[0]) {
		t.Fatal("normal window must not open on a toolResult")
	}
}
