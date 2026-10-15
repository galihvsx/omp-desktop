package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"
)

const (
	envHelper = "OMP_RPC_TEST_HELPER"
	envMode   = "OMP_RPC_TEST_MODE"
	envCmdLog = "OMP_RPC_TEST_CMD_LOG"
)

const (
	helperInfoSessionID    = "sess-info-1"
	helperStateSessionID   = "sess-state-1"
	helperStateSessionFile = `C:\sessions\sess-state-1.jsonl`
)

func TestHelperProcess(t *testing.T) {
	if os.Getenv(envHelper) == "" {
		return
	}
	switch os.Getenv(envMode) {
	case "frames":
		runFramesHelper()
	case "state":
		runStateHelper()
	case "hang":
		runHangHelper()
	case "leak":
		runLeakHelper()
	}
	os.Exit(0)
}

func runLeakHelper() {
	var child *exec.Cmd
	if runtime.GOOS == "windows" {
		child = exec.Command("ping", "-n", "20", "127.0.0.1")
	} else {
		child = exec.Command("sleep", "20")
	}
	child.Stdout = os.Stdout
	child.Stderr = os.Stderr
	if err := child.Start(); err != nil {
		os.Exit(4)
	}
	os.Exit(0)
}

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

func runStateHelper() {
	out := bufio.NewWriter(os.Stdout)
	say := func(s string) {
		fmt.Fprintln(out, s)
		out.Flush()
	}
	say(`{"type":"ready","protocolVersion":1,"supportedProtocolVersions":[1,2],"maxFrameBytes":1048576}`)
	say(fmt.Sprintf(`{"type":"session_info_update","sessionId":%q}`, helperInfoSessionID))

	var cmdLog *os.File
	if path := os.Getenv(envCmdLog); path != "" {
		cmdLog, _ = os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
		if cmdLog != nil {
			defer cmdLog.Close()
		}
	}

	sc := bufio.NewScanner(os.Stdin)
	for sc.Scan() {
		if cmdLog != nil {
			_, _ = cmdLog.WriteString(sc.Text() + "\n")
		}
		var cmd map[string]any
		_ = json.Unmarshal(sc.Bytes(), &cmd)
		resp := map[string]any{"type": "response", "command": cmd["type"], "success": true}
		if id, ok := cmd["id"].(string); ok && id != "" {
			resp["id"] = id
		}
		if cmd["type"] == "get_state" {
			resp["data"] = map[string]any{
				"sessionId":   helperStateSessionID,
				"sessionFile": helperStateSessionFile,
			}
		}
		encoded, _ := json.Marshal(resp)
		say(string(encoded))
	}
}

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

func sessionEventCount(log *rpcEventLog) int {
	n := 0
	for _, e := range log.snapshot() {
		if e.event == eventRPCSession {
			n++
		}
	}
	return n
}

func hasSessionEvent(log *rpcEventLog, key, id, file string) bool {
	for _, e := range log.snapshot() {
		if e.event != eventRPCSession || len(e.data) != 3 {
			continue
		}
		if e.data[0] == key && e.data[1] == id && e.data[2] == file {
			return true
		}
	}
	return false
}

func framesFor(t *testing.T, log *rpcEventLog, key string) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, e := range log.snapshot() {
		if e.event != eventRPCFrame {
			continue
		}
		if len(e.data) != 2 {
			t.Fatalf("frame event carries %d args, want (key, frame)", len(e.data))
		}
		if got, _ := e.data[0].(string); got != key {
			t.Fatalf("frame routed to key %q, want %q", got, key)
		}
		frame, _ := e.data[1].(map[string]any)
		out = append(out, frame)
	}
	return out
}

func hasResponse(frames []map[string]any, id string) bool {
	for _, frame := range frames {
		if frame["type"] == "response" && frame["id"] == id {
			return true
		}
	}
	return false
}

func runningSessions() []string { return (&App{}).ListRunningSessions() }

func sessionRunning(key string) bool {
	return slices.Contains(runningSessions(), key)
}

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
	rpcStopAll()
	t.Cleanup(rpcStopAll)
}

func TestRPCFramesGracefulStopAndEcho(t *testing.T) {
	useHelperOmp(t, "frames", 3*time.Second)
	resetRPCState(t)

	const key = "new:11111111-1111-1111-1111-111111111111"
	log := newEventLog()
	if err := rpcStart(log.emit, key, StartOptions{Cwd: t.TempDir()}); err != nil {
		t.Fatalf("start: %v", err)
	}
	if p := rpcLookup(key); p == nil || p.key != key {
		t.Fatalf("registry entry for %q missing or mis-keyed", key)
	}

	waitUntil(t, 5*time.Second, func() bool { return frameCount(log) >= 3 })
	frames := framesFor(t, log, key)
	if frames[0]["type"] != "ready" {
		t.Fatalf("expected ready frame first, got %v", frames[0])
	}
	if frames[1]["type"] != "turn_start" {
		t.Fatalf("expected turn_start second, got %v", frames[1])
	}
	if frames[2]["type"] != "rpc_parse_error" {
		t.Fatalf("expected rpc_parse_error third, got %v", frames[2])
	}

	if err := rpcSend(key, `{"id":"req-7","type":"get_state"}`); err != nil {
		t.Fatalf("send: %v", err)
	}
	waitUntil(t, 5*time.Second, func() bool {
		for _, frame := range framesFor(t, log, key) {
			if frame["type"] == "response" && frame["id"] == "req-7" && frame["success"] == true {
				return true
			}
		}
		return false
	})

	if err := rpcSend(key, `not json`); err != errRPCNotJSON {
		t.Fatalf("expected errRPCNotJSON, got %v", err)
	}

	started := time.Now()
	if err := rpcStop(key); err != nil {
		t.Fatalf("stop: %v", err)
	}
	if elapsed := time.Since(started); elapsed > 2*time.Second {
		t.Fatalf("graceful stop took %v, expected EOF exit", elapsed)
	}

	e, ok := exitEvent(log)
	if !ok {
		t.Fatal("exit event missing")
	}
	if got, _ := e.data[0].(string); got != key {
		t.Fatalf("exit event key = %q, want %q", got, key)
	}
	if detail, _ := e.data[1].(string); detail != "" {
		t.Fatalf("expected empty exit detail for clean exit, got %q", detail)
	}

	if sessionRunning(key) {
		t.Fatal("key still registered after stop")
	}
	if err := rpcSend(key, `{"type":"get_state"}`); err != errRPCNotRunning {
		t.Fatalf("expected errRPCNotRunning after stop, got %v", err)
	}
}

func TestRPCKillsUnresponsiveChild(t *testing.T) {
	useHelperOmp(t, "hang", 200*time.Millisecond)
	resetRPCState(t)

	const key = "new:hang"
	log := newEventLog()
	if err := rpcStart(log.emit, key, StartOptions{Cwd: t.TempDir()}); err != nil {
		t.Fatalf("start: %v", err)
	}
	waitUntil(t, 5*time.Second, func() bool { return frameCount(log) >= 1 })

	started := time.Now()
	if err := rpcStop(key); err != nil {
		t.Fatalf("stop: %v", err)
	}
	if elapsed := time.Since(started); elapsed > 5*time.Second {
		t.Fatalf("kill path took %v", elapsed)
	}

	if _, ok := exitEvent(log); !ok {
		t.Fatal("exit event missing after kill")
	}
	waitUntil(t, 2*time.Second, func() bool { return !sessionRunning(key) })
}

func TestRPCReleasesSlotWhenGrandchildHoldsPipes(t *testing.T) {
	useHelperOmp(t, "leak", 3*time.Second)
	resetRPCState(t)
	oldDrain := rpcExitDrain
	rpcExitDrain = 300 * time.Millisecond
	t.Cleanup(func() { rpcExitDrain = oldDrain })

	const key = "new:leak"
	log := newEventLog()
	if err := rpcStart(log.emit, key, StartOptions{}); err != nil {
		t.Fatalf("start: %v", err)
	}

	started := time.Now()
	waitUntil(t, 8*time.Second, func() bool { return !sessionRunning(key) })
	if elapsed := time.Since(started); elapsed > 3*time.Second {
		t.Fatalf("key released after %v; expected the bounded drain to free it in well under 3s", elapsed)
	}
	if _, ok := exitEvent(log); !ok {
		t.Fatal("exit event missing after leaked-pipe exit")
	}

	log2 := newEventLog()
	if err := rpcStart(log2.emit, key, StartOptions{}); err != nil {
		t.Fatalf("restart after leaked-pipe exit: %v", err)
	}
	if err := rpcStop(key); err != nil {
		t.Fatalf("stop: %v", err)
	}
}

func TestRPCSendUnknownKeyReturnsNotRunning(t *testing.T) {
	resetRPCState(t)

	if err := rpcSend("new:missing", `not json`); err != errRPCNotJSON {
		t.Fatalf("expected errRPCNotJSON, got %v", err)
	}
	if err := rpcSend("new:missing", `{"type":"get_state"}`); err != errRPCNotRunning {
		t.Fatalf("expected errRPCNotRunning, got %v", err)
	}
	if err := rpcStop("new:missing"); err != errRPCNotRunning {
		t.Fatalf("expected errRPCNotRunning from stop, got %v", err)
	}
}

func TestRPCSessionsRunConcurrentlyAndRouteFrames(t *testing.T) {
	useHelperOmp(t, "frames", 3*time.Second)
	resetRPCState(t)

	const keyA, keyB = "new:aaaa", "new:bbbb"
	logA, logB := newEventLog(), newEventLog()
	if err := rpcStart(logA.emit, keyA, StartOptions{Cwd: t.TempDir()}); err != nil {
		t.Fatalf("start A: %v", err)
	}
	if err := rpcStart(logB.emit, keyB, StartOptions{Cwd: t.TempDir()}); err != nil {
		t.Fatalf("start B: %v", err)
	}
	if got := runningSessions(); !slices.Equal(got, []string{keyA, keyB}) {
		t.Fatalf("running sessions = %v, want [%s %s]", got, keyA, keyB)
	}

	waitUntil(t, 5*time.Second, func() bool { return frameCount(logA) >= 3 && frameCount(logB) >= 3 })

	if err := rpcSend(keyA, `{"id":"a-1","type":"get_state"}`); err != nil {
		t.Fatalf("send to A: %v", err)
	}
	if err := rpcSend(keyB, `{"id":"b-1","type":"get_state"}`); err != nil {
		t.Fatalf("send to B: %v", err)
	}
	waitUntil(t, 5*time.Second, func() bool {
		return hasResponse(framesFor(t, logA, keyA), "a-1") && hasResponse(framesFor(t, logB, keyB), "b-1")
	})
	if hasResponse(framesFor(t, logA, keyA), "b-1") || hasResponse(framesFor(t, logB, keyB), "a-1") {
		t.Fatal("response leaked across session keys")
	}

	if err := rpcStop(keyA); err != nil {
		t.Fatalf("stop A: %v", err)
	}
	if err := rpcStop(keyB); err != nil {
		t.Fatalf("stop B: %v", err)
	}
	if got := runningSessions(); len(got) != 0 {
		t.Fatalf("keys still running after both stops: %v", got)
	}
}

func TestRPCDuplicateKeyRejectedAndRestartable(t *testing.T) {
	useHelperOmp(t, "frames", 3*time.Second)
	resetRPCState(t)

	const key = "new:dupe"
	log := newEventLog()
	if err := rpcStart(log.emit, key, StartOptions{Cwd: t.TempDir()}); err != nil {
		t.Fatalf("first start: %v", err)
	}
	waitUntil(t, 5*time.Second, func() bool { return frameCount(log) >= 1 })

	if err := rpcStart(log.emit, key, StartOptions{Cwd: t.TempDir()}); err != errRPCSessionExists {
		t.Fatalf("expected errRPCSessionExists, got %v", err)
	}
	if err := rpcStart(log.emit, "", StartOptions{Cwd: t.TempDir()}); err != errRPCEmptyKey {
		t.Fatalf("expected errRPCEmptyKey, got %v", err)
	}
	if !sessionRunning(key) {
		t.Fatal("rejected duplicate start dropped the running session")
	}

	if err := rpcStop(key); err != nil {
		t.Fatalf("stop: %v", err)
	}
	waitUntil(t, 2*time.Second, func() bool { return !sessionRunning(key) })

	if err := rpcStart(log.emit, key, StartOptions{Cwd: t.TempDir()}); err != nil {
		t.Fatalf("restart after stop: %v", err)
	}
	if err := rpcStop(key); err != nil {
		t.Fatalf("stop after restart: %v", err)
	}
}

func TestRPCStopSessionLeavesOtherKeysRunning(t *testing.T) {
	useHelperOmp(t, "frames", 3*time.Second)
	resetRPCState(t)

	const keyA, keyB = "new:stop-a", "new:stop-b"
	logA, logB := newEventLog(), newEventLog()
	if err := rpcStart(logA.emit, keyA, StartOptions{Cwd: t.TempDir()}); err != nil {
		t.Fatalf("start A: %v", err)
	}
	if err := rpcStart(logB.emit, keyB, StartOptions{Cwd: t.TempDir()}); err != nil {
		t.Fatalf("start B: %v", err)
	}
	waitUntil(t, 5*time.Second, func() bool { return frameCount(logA) >= 1 && frameCount(logB) >= 1 })

	if err := rpcStop(keyA); err != nil {
		t.Fatalf("stop A: %v", err)
	}
	if _, ok := exitEvent(logA); !ok {
		t.Fatal("A exit event missing after its stop")
	}
	if !sessionRunning(keyB) {
		t.Fatal("stopping A also dropped B")
	}
	if _, ok := exitEvent(logB); ok {
		t.Fatal("B reported an exit while its child still runs")
	}

	if err := (&App{}).StopAllSessions(); err != nil {
		t.Fatalf("stop all: %v", err)
	}
	if _, ok := exitEvent(logB); !ok {
		t.Fatal("B exit event missing after StopAllSessions")
	}
	if got := runningSessions(); len(got) != 0 {
		t.Fatalf("keys still running after StopAllSessions: %v", got)
	}
}

func TestRPCSessionEventFromGetStateResponse(t *testing.T) {
	useHelperOmp(t, "state", 3*time.Second)
	resetRPCState(t)

	const key = "new:state"
	log := newEventLog()
	if err := rpcStart(log.emit, key, StartOptions{Cwd: t.TempDir()}); err != nil {
		t.Fatalf("start: %v", err)
	}
	waitUntil(t, 5*time.Second, func() bool { return frameCount(log) >= 1 })

	waitUntil(t, 5*time.Second, func() bool {
		return hasSessionEvent(log, key, helperInfoSessionID, "")
	})

	waitUntil(t, 5*time.Second, func() bool {
		return hasSessionEvent(log, key, helperStateSessionID, helperStateSessionFile)
	})

	if err := rpcSend(key, `{"id":"state-1","type":"get_state"}`); err != nil {
		t.Fatalf("send get_state: %v", err)
	}
	waitUntil(t, 5*time.Second, func() bool { return sessionEventCount(log) >= 3 })

	if err := rpcSend(key, `{"id":"prompt-1","type":"prompt","message":"hi"}`); err != nil {
		t.Fatalf("send prompt: %v", err)
	}
	waitUntil(t, 5*time.Second, func() bool { return hasResponse(framesFor(t, log, key), "prompt-1") })
	if n := sessionEventCount(log); n != 3 {
		t.Fatalf("expected exactly 3 omp:session events, got %d", n)
	}

	if err := rpcStop(key); err != nil {
		t.Fatalf("stop: %v", err)
	}
}

func helperCommands(t *testing.T, path string) []string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read helper command log: %v", err)
	}
	var types []string
	for _, line := range strings.Split(string(data), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var cmd map[string]any
		if err := json.Unmarshal([]byte(line), &cmd); err != nil {
			t.Fatalf("helper command log line is not json: %q", line)
		}
		commandType, _ := cmd["type"].(string)
		types = append(types, commandType)
	}
	return types
}

func TestRPCHostRequestsStateOnReady(t *testing.T) {
	useHelperOmp(t, "state", 3*time.Second)
	resetRPCState(t)

	cmdLog := filepath.Join(t.TempDir(), "helper-commands.log")
	t.Setenv(envCmdLog, cmdLog)

	const key = "new:host-state"
	log := newEventLog()
	if err := rpcStart(log.emit, key, StartOptions{Cwd: t.TempDir()}); err != nil {
		t.Fatalf("start: %v", err)
	}

	waitUntil(t, 5*time.Second, func() bool {
		return hasSessionEvent(log, key, helperStateSessionID, helperStateSessionFile)
	})

	if err := rpcSend(key, `{"id":"prompt-1","type":"prompt","message":"hi"}`); err != nil {
		t.Fatalf("send prompt: %v", err)
	}
	waitUntil(t, 5*time.Second, func() bool { return hasResponse(framesFor(t, log, key), "prompt-1") })

	if got := helperCommands(t, cmdLog); !slices.Equal(got, []string{"get_state", "prompt"}) {
		t.Fatalf("helper received %v, want [get_state prompt]", got)
	}
	if n := sessionEventCount(log); n != 2 {
		t.Fatalf("expected exactly 2 omp:session events, got %d", n)
	}

	if err := rpcStop(key); err != nil {
		t.Fatalf("stop: %v", err)
	}
}

func TestRPCArgvComposition(t *testing.T) {
	oldArgs := rpcArgs
	rpcArgs = []string{"--mode", "rpc"}
	t.Cleanup(func() { rpcArgs = oldArgs })

	if got := rpcArgv(StartOptions{}); !slices.Equal(got, []string{"--mode", "rpc"}) {
		t.Fatalf("argv for empty options = %v", got)
	}

	got := rpcArgv(StartOptions{
		Model:         "openai-codex/gpt-5.5:low",
		ThinkingLevel: "high",
		ApprovalMode:  "yolo",
		Resume:        `C:\sessions\a.jsonl`,
	})
	want := []string{
		"--mode", "rpc",
		"--model", "openai-codex/gpt-5.5:low",
		"--thinking", "high",
		"--approval-mode", "yolo",
		"--resume", `C:\sessions\a.jsonl`,
	}
	if !slices.Equal(got, want) {
		t.Fatalf("argv = %v, want %v", got, want)
	}
	for _, arg := range got {
		if arg == "--no-session" {
			t.Fatal("--no-session must never be passed")
		}
	}
	if !slices.Equal(rpcArgs, []string{"--mode", "rpc"}) {
		t.Fatalf("rpcArgs mutated to %v", rpcArgs)
	}
}

func TestRPCLiveOmpSmoke(t *testing.T) {
	if os.Getenv("OMP_LIVE_SMOKE") != "1" {
		t.Skip("set OMP_LIVE_SMOKE=1 to run against the real omp CLI")
	}
	resetRPCState(t)

	const key = "new:smoke"
	log := newEventLog()
	dir, err := os.MkdirTemp("", "omp-rpc-smoke-")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	t.Cleanup(func() {
		if err := os.RemoveAll(dir); err != nil {
			t.Logf("temp dir cleanup (best effort): %v", err)
		}
	})
	if err := rpcStart(log.emit, key, StartOptions{Cwd: dir}); err != nil {
		t.Fatalf("start: %v", err)
	}

	waitUntil(t, 90*time.Second, func() bool {
		for _, frame := range framesFor(t, log, key) {
			if frame["type"] == "ready" {
				return true
			}
		}
		return false
	})

	var sessionID, sessionFile string
	waitUntil(t, 30*time.Second, func() bool {
		for _, e := range log.snapshot() {
			if e.event != eventRPCSession || len(e.data) != 3 {
				continue
			}
			if got, _ := e.data[0].(string); got != key {
				continue
			}
			file, _ := e.data[2].(string)
			if file == "" {
				continue
			}
			sessionID, _ = e.data[1].(string)
			sessionFile = file
			return true
		}
		return false
	})
	if !filepath.IsAbs(sessionFile) {
		t.Fatalf("session file %q reported by the child is not absolute", sessionFile)
	}
	if !strings.HasSuffix(filepath.Base(sessionFile), sessionID+".jsonl") {
		t.Fatalf("session file %q does not carry the reported session id %q", sessionFile, sessionID)
	}
	info, err := os.Stat(filepath.Dir(sessionFile))
	if err != nil {
		t.Fatalf("session dir %q reported by the child is not readable: %v", filepath.Dir(sessionFile), err)
	}
	if !info.IsDir() {
		t.Fatalf("session dir %q is not a directory", filepath.Dir(sessionFile))
	}
	t.Logf("live identity: sessionId=%s sessionFile=%s", sessionID, sessionFile)

	if err := rpcSend(key, `{"id":"smoke-1","type":"get_state"}`); err != nil {
		t.Fatalf("send get_state: %v", err)
	}
	waitUntil(t, 30*time.Second, func() bool {
		for _, frame := range framesFor(t, log, key) {
			if frame["type"] == "response" && frame["id"] == "smoke-1" {
				if success, _ := frame["success"].(bool); !success {
					t.Fatalf("get_state failed: %v", frame)
				}
				return true
			}
		}
		return false
	})

	if err := rpcStop(key); err != nil {
		t.Fatalf("stop: %v", err)
	}
	if _, ok := exitEvent(log); !ok {
		t.Fatal("exit event missing after live stop")
	}
}
