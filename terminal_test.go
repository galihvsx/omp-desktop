package main

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"
)

const envTermHelper = "OMP_TERM_TEST_HELPER"

func TestTerminalHelperProcess(t *testing.T) {
	if os.Getenv(envTermHelper) == "" {
		return
	}
	fmt.Print("helper-ready\r\n")
	buf := make([]byte, 256)
	for {
		n, err := os.Stdin.Read(buf)
		if n > 0 {
			line := string(buf[:n])
			if strings.Contains(line, "quit") {
				os.Exit(0)
			}
			if strings.Contains(line, "fail") {
				os.Exit(3)
			}
			fmt.Printf("echo:%s", line)
		}
		if err != nil {
			os.Exit(0)
		}
	}
}

func useHelperTerminal(t *testing.T) {
	t.Helper()
	exe, err := os.Executable()
	if err != nil {
		t.Fatalf("resolve test binary: %v", err)
	}
	t.Setenv(envTermHelper, "1")

	oldCommand, oldArgs := termCommand, termArgs
	termCommand = exe
	termArgs = []string{"-test.run=TestTerminalHelperProcess"}
	t.Cleanup(func() {
		termCommand, termArgs = oldCommand, oldArgs
	})
}

func resetTerminal(t *testing.T) {
	t.Helper()
	if err := termStopAll(); err != nil {
		t.Fatalf("reset terminal: %v", err)
	}
	t.Cleanup(func() { _ = termStopAll() })
}

func termChunks(t *testing.T, log *rpcEventLog, id string) string {
	t.Helper()
	var b strings.Builder
	for _, e := range log.snapshot() {
		if e.event != eventTermData {
			continue
		}
		if len(e.data) != 2 {
			t.Fatalf("term:data carries %d args, want the id and the chunk", len(e.data))
		}
		if e.data[0] != id {
			continue
		}
		chunk, ok := e.data[1].(string)
		if !ok {
			t.Fatalf("term:data payload is %T, want string", e.data[1])
		}
		b.WriteString(chunk)
	}
	return b.String()
}

func termExitEvent(t *testing.T, log *rpcEventLog, id string) (rpcEvent, bool) {
	t.Helper()
	for _, e := range log.snapshot() {
		if e.event != eventTermExit {
			continue
		}
		if len(e.data) != 2 {
			t.Fatalf("term:exit carries %d args, want the id and the detail", len(e.data))
		}
		if e.data[0] != id {
			continue
		}
		return e, true
	}
	return rpcEvent{}, false
}

func TestTerminalStopWithoutStartIsNoop(t *testing.T) {
	resetTerminal(t)

	if err := termStop("t"); err != nil {
		t.Fatalf("stop without start: %v", err)
	}
	if err := (&App{}).StopTerminal("t"); err != nil {
		t.Fatalf("App.StopTerminal without start: %v", err)
	}
	if err := (&App{}).StopTerminal("t"); err != nil {
		t.Fatalf("second App.StopTerminal without start: %v", err)
	}
	if err := (&App{}).StopAllTerminals(); err != nil {
		t.Fatalf("App.StopAllTerminals without start: %v", err)
	}
}

func TestTerminalInputBeforeStartErrors(t *testing.T) {
	resetTerminal(t)
	app := &App{}

	if err := app.TerminalWrite("t", "x"); !errors.Is(err, errTermNotRunning) {
		t.Fatalf("write before start = %v, want %v", err, errTermNotRunning)
	}
	if err := app.TerminalResize("t", 80, 24); !errors.Is(err, errTermNotRunning) {
		t.Fatalf("resize before start = %v, want %v", err, errTermNotRunning)
	}
	if name := app.TerminalShellName("t"); name != "" {
		t.Fatalf("shell name before start = %q, want empty", name)
	}
}

func TestTerminalStartRejectsEmptyID(t *testing.T) {
	useHelperTerminal(t)
	resetTerminal(t)

	log := newEventLog()
	for _, id := range []string{"", "   "} {
		if err := termStart(log.emit, id, 80, 24); err == nil {
			t.Fatalf("start with id %q succeeded, want an error", id)
		}
	}
}

func TestTerminalStartWriteResizeStopCycle(t *testing.T) {
	useHelperTerminal(t)
	resetTerminal(t)

	const id = "t"
	log := newEventLog()
	if err := termStart(log.emit, id, 80, 24); err != nil {
		t.Fatalf("start: %v", err)
	}
	waitUntil(t, 10*time.Second, func() bool {
		return strings.Contains(termChunks(t, log, id), "helper-ready")
	})

	if err := termStart(log.emit, id, 100, 40); err != nil {
		t.Fatalf("second start: %v", err)
	}
	app := &App{}
	if err := app.TerminalWrite(id, "hi\r"); err != nil {
		t.Fatalf("write: %v", err)
	}
	waitUntil(t, 10*time.Second, func() bool {
		return strings.Contains(termChunks(t, log, id), "echo:")
	})

	if err := app.TerminalResize(id, 120, 30); err != nil {
		t.Fatalf("resize: %v", err)
	}

	if err := app.StopTerminal(id); err != nil {
		t.Fatalf("stop: %v", err)
	}
	if _, ok := termExitEvent(t, log, id); ok {
		t.Fatal("stop emitted an exit event for a shell this host killed")
	}
	if err := app.TerminalWrite(id, "x"); !errors.Is(err, errTermNotRunning) {
		t.Fatalf("write after stop = %v, want %v", err, errTermNotRunning)
	}

	log2 := newEventLog()
	if err := termStart(log2.emit, id, 80, 24); err != nil {
		t.Fatalf("restart: %v", err)
	}
	waitUntil(t, 10*time.Second, func() bool {
		return strings.Contains(termChunks(t, log2, id), "helper-ready")
	})
	if err := app.StopTerminal(id); err != nil {
		t.Fatalf("stop after restart: %v", err)
	}
}

func TestTerminalSameIdStartIsNoop(t *testing.T) {
	useHelperTerminal(t)
	resetTerminal(t)

	const id = "t"
	first := newEventLog()
	if err := termStart(first.emit, id, 80, 24); err != nil {
		t.Fatalf("start: %v", err)
	}
	waitUntil(t, 10*time.Second, func() bool {
		return strings.Contains(termChunks(t, first, id), "helper-ready")
	})

	second := newEventLog()
	if err := termStart(second.emit, id, 80, 24); err != nil {
		t.Fatalf("second start: %v", err)
	}
	if got := termChunks(t, second, id); got != "" {
		t.Fatalf("second start produced output %q, want the running shell to be reused", got)
	}

	if err := (&App{}).TerminalWrite(id, "hi\r"); err != nil {
		t.Fatalf("write: %v", err)
	}
	waitUntil(t, 10*time.Second, func() bool {
		return strings.Contains(termChunks(t, first, id), "echo:")
	})
	if n := strings.Count(termChunks(t, first, id), "helper-ready"); n != 1 {
		t.Fatalf("first log saw %d banners, want exactly 1", n)
	}
}

func TestTerminalMultipleSessionsRunConcurrently(t *testing.T) {
	useHelperTerminal(t)
	resetTerminal(t)

	logA, logB := newEventLog(), newEventLog()
	if err := termStart(logA.emit, "a", 80, 24); err != nil {
		t.Fatalf("start a: %v", err)
	}
	if err := termStart(logB.emit, "b", 80, 24); err != nil {
		t.Fatalf("start b: %v", err)
	}
	waitUntil(t, 10*time.Second, func() bool {
		return strings.Contains(termChunks(t, logA, "a"), "helper-ready") &&
			strings.Contains(termChunks(t, logB, "b"), "helper-ready")
	})

	app := &App{}
	if err := app.TerminalWrite("a", "hi-a\r"); err != nil {
		t.Fatalf("write a: %v", err)
	}
	if err := app.TerminalWrite("b", "hi-b\r"); err != nil {
		t.Fatalf("write b: %v", err)
	}
	waitUntil(t, 10*time.Second, func() bool {
		return strings.Contains(termChunks(t, logA, "a"), "echo:hi-a") &&
			strings.Contains(termChunks(t, logB, "b"), "echo:hi-b")
	})
	if got := termChunks(t, logA, "a"); strings.Contains(got, "hi-b") {
		t.Fatalf("shell a received b's input: %q", got)
	}
	if got := termChunks(t, logB, "b"); strings.Contains(got, "hi-a") {
		t.Fatalf("shell b received a's input: %q", got)
	}

	if err := app.StopTerminal("a"); err != nil {
		t.Fatalf("stop a: %v", err)
	}
	if err := app.TerminalWrite("b", "still-here\r"); err != nil {
		t.Fatalf("write b after stopping a: %v", err)
	}
	waitUntil(t, 10*time.Second, func() bool {
		return strings.Contains(termChunks(t, logB, "b"), "echo:still-here")
	})
	if err := app.TerminalWrite("a", "x"); !errors.Is(err, errTermNotRunning) {
		t.Fatalf("write to stopped a = %v, want %v", err, errTermNotRunning)
	}
}

func TestTerminalShellName(t *testing.T) {
	useHelperTerminal(t)
	resetTerminal(t)

	log := newEventLog()
	if err := termStart(log.emit, "t", 80, 24); err != nil {
		t.Fatalf("start: %v", err)
	}
	waitUntil(t, 10*time.Second, func() bool {
		return strings.Contains(termChunks(t, log, "t"), "helper-ready")
	})

	app := &App{}
	if name := app.TerminalShellName("t"); name == "" {
		t.Fatal("shell name for a live id is empty, want the resolved shell")
	}
	if name := app.TerminalShellName("nope"); name != "" {
		t.Fatalf("shell name for an unknown id = %q, want empty", name)
	}
}

func TestTerminalSplitUTF8CarriesPartialRune(t *testing.T) {
	lead, carry := termSplitUTF8(nil, []byte("a\xc3"))
	if lead != "a" || string(carry) != "\xc3" {
		t.Fatalf("first read = %q / %q, want %q / %q", lead, carry, "a", "\xc3")
	}
	lead, carry = termSplitUTF8(carry, []byte("\xa9b"))
	if lead != "éb" || carry != nil {
		t.Fatalf("second read = %q / %q, want %q / nil", lead, carry, "éb")
	}

	if lead, carry = termSplitUTF8(nil, []byte("café")); lead != "café" || carry != nil {
		t.Fatalf("complete read = %q / %q, want %q / nil", lead, carry, "café")
	}

	lead, carry = termSplitUTF8(nil, []byte("x\xf0\x9f\x98"))
	if lead != "x" || len(carry) != 3 {
		t.Fatalf("four-byte split = %q / %q, want %q / 3 carried bytes", lead, carry, "x")
	}
	if lead, carry = termSplitUTF8(carry, []byte("\x80y")); lead != "😀y" || carry != nil {
		t.Fatalf("four-byte completion = %q / %q, want %q / nil", lead, carry, "😀y")
	}

	if lead, carry = termSplitUTF8(nil, []byte("\xff\xfe")); lead != "\xff\xfe" || carry != nil {
		t.Fatalf("invalid bytes = %q / %q, want them passed through", lead, carry)
	}
}

func TestTerminalReportsSelfExit(t *testing.T) {
	useHelperTerminal(t)
	resetTerminal(t)

	const id = "t"
	log := newEventLog()
	if err := termStart(log.emit, id, 80, 24); err != nil {
		t.Fatalf("start: %v", err)
	}
	waitUntil(t, 10*time.Second, func() bool {
		return strings.Contains(termChunks(t, log, id), "helper-ready")
	})

	app := &App{}
	if err := app.TerminalWrite(id, "fail\r"); err != nil {
		t.Fatalf("write: %v", err)
	}
	var exit rpcEvent
	waitUntil(t, 10*time.Second, func() bool {
		e, ok := termExitEvent(t, log, id)
		exit = e
		return ok
	})
	detail, _ := exit.data[1].(string)
	if !strings.Contains(detail, "3") {
		t.Fatalf("exit detail = %q, want the shell's exit status", detail)
	}

	if err := app.TerminalWrite(id, "x"); !errors.Is(err, errTermNotRunning) {
		t.Fatalf("write after self-exit = %v, want %v", err, errTermNotRunning)
	}
	log2 := newEventLog()
	if err := termStart(log2.emit, id, 80, 24); err != nil {
		t.Fatalf("restart after self-exit: %v", err)
	}
	waitUntil(t, 10*time.Second, func() bool {
		return strings.Contains(termChunks(t, log2, id), "helper-ready")
	})
	if err := app.StopTerminal(id); err != nil {
		t.Fatalf("stop after restart: %v", err)
	}
}

func TestTerminalLiveShellSmoke(t *testing.T) {
	if os.Getenv("OMP_LIVE_SMOKE") != "1" {
		t.Skip("set OMP_LIVE_SMOKE=1 to run against the real shell")
	}
	resetTerminal(t)

	const id = "t"
	log := newEventLog()
	if err := termStart(log.emit, id, 80, 24); err != nil {
		t.Fatalf("start: %v", err)
	}

	waitUntil(t, 30*time.Second, func() bool { return termChunks(t, log, id) != "" })
	t.Logf("shell output: %q", termChunks(t, log, id))

	if err := (&App{}).TerminalWrite(id, "exit\r"); err != nil {
		t.Fatalf("write: %v", err)
	}
	waitUntil(t, 30*time.Second, func() bool {
		_, ok := termExitEvent(t, log, id)
		return ok
	})
}
