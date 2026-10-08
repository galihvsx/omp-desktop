package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"sync"
	"testing"
	"time"
)

// The helper child re-executes this test binary with a mode selected by env.
// It speaks a minimal omp rpc protocol on stdio: JSON frames out, JSON
// commands in, exit on stdin EOF.
const (
	envHelper = "OMP_RPC_TEST_HELPER"
	envMode   = "OMP_RPC_TEST_MODE"
)

// TestHelperProcess is never run as a real test; when the env marker is
// absent it returns immediately so the normal suite skips it silently.
func TestHelperProcess(t *testing.T) {
	if os.Getenv(envHelper) == "" {
		return
	}
	switch os.Getenv(envMode) {
	case "frames":
		runFramesHelper()
	case "hang":
		runHangHelper()
	case "leak":
		runLeakHelper()
	}
	os.Exit(0)
}

// runLeakHelper spawns a grandchild that inherits this process's stdio and
// outlives it, then exits immediately. The grandchild keeps stdout/stderr
// open, which is exactly the Windows case where the host's pipe readers would
// never see EOF and the session slot would stay pinned forever.
//
// The grandchild is a system process (ping/sleep), not a re-exec of the test
// binary: a copy of the test executable would stay locked and break Go's
// build-cache cleanup after the run.
func runLeakHelper() {
	var child *exec.Cmd
	if runtime.GOOS == "windows" {
		// ~19s: far longer than the drain budget, so an implementation that
		// waits for the pipes (instead of bounding the wait) cannot pass.
		child = exec.Command("ping", "-n", "20", "127.0.0.1")
	} else {
		child = exec.Command("sleep", "20")
	}
	child.Stdout = os.Stdout
	child.Stderr = os.Stderr
	if err := child.Start(); err != nil {
		os.Exit(4)
	}
	// Exit without waiting: the grandchild keeps our stdio handles.
	os.Exit(0)
}

// runFramesHelper prints a ready frame, a notification, and one non-JSON line
// (which the host must surface as rpc_parse_error), then echoes one response
// per stdin command line and exits cleanly when stdin hits EOF.
func runFramesHelper() {
	out := bufio.NewWriter(os.Stdout)
	say := func(s string) {
		fmt.Fprintln(out, s)
		out.Flush()
	}
	say(`{"type":"ready","protocolVersion":1,"supportedProtocolVersions":[1,2],"maxFrameBytes":1048576}`)
	say(`{"type":"turn_start","turn":"t-1"}`)
	say(`this line is not json`)

	sc := bufio.NewScanner(os.Stdin)
	for sc.Scan() {
		var cmd map[string]any
		_ = json.Unmarshal(sc.Bytes(), &cmd)
		resp := map[string]any{"type": "response", "command": cmd["type"], "success": true}
		if id, ok := cmd["id"].(string); ok && id != "" {
			resp["id"] = id
		}
		encoded, _ := json.Marshal(resp)
		say(string(encoded))
	}
}

// runHangHelper prints ready and then ignores stdin entirely, forcing the
// host through the kill path after the grace period.
func runHangHelper() {
	fmt.Println(`{"type":"ready","protocolVersion":1,"supportedProtocolVersions":[1,2],"maxFrameBytes":1048576}`)
	time.Sleep(30 * time.Second)
}

type rpcEvent struct {
	event string
	data  []any
}

type rpcEventLog struct {
	mu     sync.Mutex
	events []rpcEvent
	notify chan struct{}
}

func newEventLog() *rpcEventLog { return &rpcEventLog{notify: make(chan struct{}, 64)} }

func (l *rpcEventLog) emit(event string, data ...any) {
	l.mu.Lock()
	l.events = append(l.events, rpcEvent{event: event, data: data})
	l.mu.Unlock()
	select {
	case l.notify <- struct{}{}:
	default:
	}
}

func (l *rpcEventLog) snapshot() []rpcEvent {
	l.mu.Lock()
	defer l.mu.Unlock()
	out := make([]rpcEvent, len(l.events))
	copy(out, l.events)
	return out
}

// waitUntil polls cond until it holds or the timeout elapses.
func waitUntil(t *testing.T, timeout time.Duration, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for condition")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func frameCount(log *rpcEventLog) int {
	n := 0
	for _, e := range log.snapshot() {
		if e.event == eventRPCFrame {
			n++
		}
	}
	return n
}

func exitEvent(log *rpcEventLog) (rpcEvent, bool) {
	for _, e := range log.snapshot() {
		if e.event == eventRPCExit {
			return e, true
		}
	}
	return rpcEvent{}, false
}

// useHelperOmp points the bridge at this test binary re-executed as the fake
// omp child, with the grace period shortened for fast kill-path tests.
func useHelperOmp(t *testing.T, mode string, grace time.Duration) {
	t.Helper()
	exe, err := os.Executable()
	if err != nil {
		t.Fatalf("resolve test binary: %v", err)
	}
	t.Setenv(envHelper, "1")
	t.Setenv(envMode, mode)

	oldCommand, oldArgs, oldGrace := rpcCommand, rpcArgs, rpcStopGrace
	rpcCommand = exe
	rpcArgs = []string{"-test.run=TestHelperProcess"}
	rpcStopGrace = grace
	t.Cleanup(func() {
		rpcCommand, rpcArgs, rpcStopGrace = oldCommand, oldArgs, oldGrace
	})
}

func resetRPCState(t *testing.T) {
	t.Helper()
	if rpcCurrent != nil {
		_ = rpcStop()
	}
	t.Cleanup(func() {
		if rpcCurrent != nil {
			_ = rpcStop()
		}
	})
}

func TestRPCFramesGracefulStopAndEcho(t *testing.T) {
	useHelperOmp(t, "frames", 3*time.Second)
	resetRPCState(t)

	log := newEventLog()
	if err := rpcStart(log.emit, t.TempDir()); err != nil {
		t.Fatalf("start: %v", err)
	}

	// The fake child's first three stdout lines: ready, turn_start, garbage.
	waitUntil(t, 5*time.Second, func() bool { return frameCount(log) >= 3 })
	frames := log.snapshot()
	first := frames[0].data[0].(map[string]any)
	if first["type"] != "ready" {
		t.Fatalf("expected ready frame first, got %v", first)
	}
	second := frames[1].data[0].(map[string]any)
	if second["type"] != "turn_start" {
		t.Fatalf("expected turn_start second, got %v", second)
	}
	third := frames[2].data[0].(map[string]any)
	if third["type"] != "rpc_parse_error" {
		t.Fatalf("expected rpc_parse_error third, got %v", third)
	}

	// A valid command is forwarded and its response echoed back with the id.
	if err := rpcSend(`{"id":"req-7","type":"get_state"}`); err != nil {
		t.Fatalf("send: %v", err)
	}
	waitUntil(t, 5*time.Second, func() bool {
		for _, e := range log.snapshot() {
			if e.event != eventRPCFrame || len(e.data) == 0 {
				continue
			}
			if m, ok := e.data[0].(map[string]any); ok &&
				m["type"] == "response" && m["id"] == "req-7" && m["success"] == true {
				return true
			}
		}
		return false
	})

	// Malformed commands are rejected client-side without touching the pipe.
	if err := rpcSend(`not json`); err != errRPCNotJSON {
		t.Fatalf("expected errRPCNotJSON, got %v", err)
	}

	// Graceful stop: stdin EOF makes the helper exit 0 on its own.
	started := time.Now()
	if err := rpcStop(); err != nil {
		t.Fatalf("stop: %v", err)
	}
	if elapsed := time.Since(started); elapsed > 2*time.Second {
		t.Fatalf("graceful stop took %v, expected EOF exit", elapsed)
	}

	e, ok := exitEvent(log)
	if !ok {
		t.Fatal("exit event missing")
	}
	// Clean exit: payload stays nil so the frontend shows its generic message.
	if len(e.data) > 0 && e.data[0] != nil {
		t.Fatalf("expected nil exit payload for clean exit, got %v", e.data[0])
	}

	if rpcCurrent != nil {
		t.Fatal("rpcCurrent not cleared after stop")
	}
	// Sends after stop report no process.
	if err := rpcSend(`{"type":"get_state"}`); err != errRPCNotRunning {
		t.Fatalf("expected errRPCNotRunning after stop, got %v", err)
	}
}

func TestRPCKillsUnresponsiveChild(t *testing.T) {
	useHelperOmp(t, "hang", 200*time.Millisecond)
	resetRPCState(t)

	log := newEventLog()
	if err := rpcStart(log.emit, t.TempDir()); err != nil {
		t.Fatalf("start: %v", err)
	}
	waitUntil(t, 5*time.Second, func() bool { return frameCount(log) >= 1 })

	started := time.Now()
	if err := rpcStop(); err != nil {
		t.Fatalf("stop: %v", err)
	}
	if elapsed := time.Since(started); elapsed > 5*time.Second {
		t.Fatalf("kill path took %v", elapsed)
	}

	if _, ok := exitEvent(log); !ok {
		t.Fatal("exit event missing after kill")
	}
	waitUntil(t, 2*time.Second, func() bool { return rpcCurrent == nil })
}

// TestRPCReleasesSlotWhenGrandchildHoldsPipes reproduces the Windows case
// where the child exits while a grandchild keeps the inherited stdout/stderr
// handles open: the session slot must still be released (bounded by
// WaitDelay) instead of pinning "already running" forever.
func TestRPCReleasesSlotWhenGrandchildHoldsPipes(t *testing.T) {
	useHelperOmp(t, "leak", 3*time.Second)
	resetRPCState(t)
	oldDrain := rpcExitDrain
	rpcExitDrain = 300 * time.Millisecond
	t.Cleanup(func() { rpcExitDrain = oldDrain })

	log := newEventLog()
	// cwd "" (the repo dir): the leaked grandchild holds the child's cwd, so a
	// t.TempDir() here would fail cleanup while the grandchild lives.
	if err := rpcStart(log.emit, ""); err != nil {
		t.Fatalf("start: %v", err)
	}

	// The child exits at once; the grandchild keeps the pipes open ~19s. The
	// slot must free within the drain budget — waiting for real EOF would take
	// the full grandchild lifetime.
	started := time.Now()
	waitUntil(t, 8*time.Second, func() bool { return rpcCurrent == nil })
	if elapsed := time.Since(started); elapsed > 3*time.Second {
		t.Fatalf("slot released after %v; expected the bounded drain to free it in well under 3s", elapsed)
	}
	if _, ok := exitEvent(log); !ok {
		t.Fatal("exit event missing after leaked-pipe exit")
	}

	// The slot is free again: a fresh start must be accepted.
	log2 := newEventLog()
	if err := rpcStart(log2.emit, ""); err != nil {
		t.Fatalf("restart after leaked-pipe exit: %v", err)
	}
	if err := rpcStop(); err != nil {
		t.Fatalf("stop: %v", err)
	}
}

func TestRPCSendWithoutProcess(t *testing.T) {
	resetRPCState(t)
	if err := rpcSend(`{"type":"get_state"}`); err != errRPCNotRunning {
		t.Fatalf("expected errRPCNotRunning, got %v", err)
	}
}

func TestRPCStartRejectsSecondProcess(t *testing.T) {
	useHelperOmp(t, "frames", 3*time.Second)
	resetRPCState(t)

	log := newEventLog()
	if err := rpcStart(log.emit, t.TempDir()); err != nil {
		t.Fatalf("first start: %v", err)
	}
	waitUntil(t, 5*time.Second, func() bool { return frameCount(log) >= 1 })

	if err := rpcStart(log.emit, t.TempDir()); err != errRPCAlreadyRunning {
		t.Fatalf("expected errRPCAlreadyRunning, got %v", err)
	}

	// Release the child before t.TempDir cleanup: on Windows the process
	// holds its cwd, and cleanup order would otherwise try to remove it live.
	if err := rpcStop(); err != nil {
		t.Fatalf("stop: %v", err)
	}
	waitUntil(t, 2*time.Second, func() bool { return rpcCurrent == nil })
}

// TestRPCLiveOmpSmoke exercises the real `omp --mode rpc` binary: ready
// frame, a correlated get_state response, and graceful stop. Guarded by
// OMP_LIVE_SMOKE=1 because it depends on the installed CLI.
func TestRPCLiveOmpSmoke(t *testing.T) {
	if os.Getenv("OMP_LIVE_SMOKE") != "1" {
		t.Skip("set OMP_LIVE_SMOKE=1 to run against the real omp CLI")
	}
	resetRPCState(t)

	log := newEventLog()
	if err := rpcStart(log.emit, t.TempDir()); err != nil {
		t.Fatalf("start: %v", err)
	}

	waitUntil(t, 90*time.Second, func() bool {
		for _, e := range log.snapshot() {
			if e.event != eventRPCFrame || len(e.data) == 0 {
				continue
			}
			if m, ok := e.data[0].(map[string]any); ok && m["type"] == "ready" {
				return true
			}
		}
		return false
	})

	if err := rpcSend(`{"id":"smoke-1","type":"get_state"}`); err != nil {
		t.Fatalf("send get_state: %v", err)
	}
	waitUntil(t, 30*time.Second, func() bool {
		for _, e := range log.snapshot() {
			if e.event != eventRPCFrame || len(e.data) == 0 {
				continue
			}
			if m, ok := e.data[0].(map[string]any); ok &&
				m["type"] == "response" && m["id"] == "smoke-1" {
				if success, _ := m["success"].(bool); !success {
					t.Fatalf("get_state failed: %v", m)
				}
				return true
			}
		}
		return false
	})

	if err := rpcStop(); err != nil {
		t.Fatalf("stop: %v", err)
	}
	if _, ok := exitEvent(log); !ok {
		t.Fatal("exit event missing after live stop")
	}
}
