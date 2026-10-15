package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCheckSessionInUseLocked(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "session.jsonl")
	if err := os.WriteFile(path, []byte("{}\n"), 0o600); err != nil {
		t.Fatalf("write session file: %v", err)
	}
	old := time.Now().Add(-2 * sessionInUseRecentWindow)
	if err := os.Chtimes(path, old, old); err != nil {
		t.Fatalf("age session file: %v", err)
	}

	release, ok := holdSessionForWrite(t, path)
	if !ok {
		t.Skip("exclusive share probe is only meaningful on Windows")
	}
	defer release()

	app := &App{}
	got := app.CheckSessionInUse(path)
	if !got.InUse || got.Reason != "locked" {
		t.Fatalf("while held: got inUse=%v reason=%q, want true/\"locked\"", got.InUse, got.Reason)
	}
	if got.UpdatedAgeMs < 0 {
		t.Fatalf("while held: updatedAgeMs=%d, want >= 0", got.UpdatedAgeMs)
	}

	release()
	got = app.CheckSessionInUse(path)
	if got.InUse || got.Reason != "" {
		t.Fatalf("after release: got inUse=%v reason=%q, want false/\"\"", got.InUse, got.Reason)
	}
}

func TestCheckSessionInUseMtime(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "session.jsonl")
	if err := os.WriteFile(path, []byte("{}\n"), 0o600); err != nil {
		t.Fatalf("write session file: %v", err)
	}

	app := &App{}
	got := app.CheckSessionInUse(path)
	if sessionProbeAuthoritative() {
		if got.InUse || got.Reason != "" {
			t.Fatalf("fresh unlocked file: got inUse=%v reason=%q, want false/\"\" (probe is authoritative)", got.InUse, got.Reason)
		}
	} else if !got.InUse || got.Reason != "recent" {
		t.Fatalf("fresh file: got inUse=%v reason=%q, want true/\"recent\"", got.InUse, got.Reason)
	}

	old := time.Now().Add(-2 * sessionInUseRecentWindow)
	if err := os.Chtimes(path, old, old); err != nil {
		t.Fatalf("age session file: %v", err)
	}
	got = app.CheckSessionInUse(path)
	if got.InUse || got.Reason != "" {
		t.Fatalf("old file: got inUse=%v reason=%q, want false/\"\"", got.InUse, got.Reason)
	}
	if got.UpdatedAgeMs < sessionInUseRecentWindow.Milliseconds() {
		t.Fatalf("old file: updatedAgeMs=%d, want >= %d", got.UpdatedAgeMs, sessionInUseRecentWindow.Milliseconds())
	}
}

func TestCheckSessionInUseNoFile(t *testing.T) {
	app := &App{}
	for _, path := range []string{"", filepath.Join(t.TempDir(), "missing.jsonl")} {
		got := app.CheckSessionInUse(path)
		if got.InUse || got.Reason != "" || got.UpdatedAgeMs != -1 {
			t.Fatalf("path %q: got %+v, want inUse=false reason=\"\" updatedAgeMs=-1", path, got)
		}
	}
}
