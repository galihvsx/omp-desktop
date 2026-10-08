package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// writeSessionFixture lays down one session jsonl with a title record, a
// session record, and one user message, mirroring omp's on-disk format.
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

	// Newest session of proj-a, no title -> falls back to the first user text.
	writeSessionFixture(t, filepath.Join(root, "--enc-a--"),
		"2026-10-08T00-30-23-637Z_aaaaaaaa-0000-0000-0000-000000000001.jsonl",
		"aaaaaaaa-0000-0000-0000-000000000001", projA, "",
		"Perbaiki copywriting agar tidak slop", time.Date(2026, 10, 8, 2, 0, 0, 0, time.UTC))
	// Older session of proj-a with a real title.
	writeSessionFixture(t, filepath.Join(root, "--enc-a--"),
		"2026-10-07T10-00-00-000Z_aaaaaaaa-0000-0000-0000-000000000002.jsonl",
		"aaaaaaaa-0000-0000-0000-000000000002", projA,
		"Integrasi RPC Mode dengan AI Elements", "",
		time.Date(2026, 10, 7, 10, 0, 0, 0, time.UTC))
	// proj-b, older than both.
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

	// Groups ordered by most recent session.
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
	// Sessions newest first.
	if sessions[0].ID != "aaaaaaaa-0000-0000-0000-000000000001" {
		t.Fatalf("session order wrong, first = %s", sessions[0].ID)
	}
	// Title fallback from the first user message.
	if sessions[0].Title != "Perbaiki copywriting agar tidak slop" {
		t.Fatalf("title fallback wrong: %q", sessions[0].Title)
	}
	// Real title wins when present.
	if sessions[1].Title != "Integrasi RPC Mode dengan AI Elements" {
		t.Fatalf("title from record wrong: %q", sessions[1].Title)
	}
	// Created comes from the session record's timestamp (millisecond precision).
	wantCreated := time.Date(2026, 10, 8, 0, 30, 23, 637_000_000, time.UTC).UnixMilli()
	if sessions[0].Created != wantCreated {
		t.Fatalf("created = %d, want %d", sessions[0].Created, wantCreated)
	}
	// Updated comes from the file mtime.
	wantUpdated := time.Date(2026, 10, 8, 2, 0, 0, 0, time.UTC).UnixMilli()
	if sessions[0].Updated != wantUpdated {
		t.Fatalf("updated = %d, want %d", sessions[0].Updated, wantUpdated)
	}
}

func TestListSessionsSkipsConfiguredBaseAndNonSessions(t *testing.T) {
	root := t.TempDir()
	scratch := filepath.Join(root, "scratch")

	writeSessionFixture(t, filepath.Join(root, "--enc--"),
		"2026-10-08T00-30-23-637Z_cccccccc-0000-0000-0000-000000000004.jsonl",
		"cccccccc-0000-0000-0000-000000000004", scratch, "Sesi scratch", "",
		time.Date(2026, 10, 8, 3, 0, 0, 0, time.UTC))
	// A stray non-session jsonl (no session record) must be ignored.
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
	if len([]rune(got)) != 65 { // 64 + ellipsis
		t.Fatalf("expected 64 runes plus ellipsis, got %d (%q)", len([]rune(got)), got)
	}
}
