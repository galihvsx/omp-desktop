package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	eventRPCFrame   = "omp:frame"
	eventRPCExit    = "omp:rpc-exit"
	eventRPCSession = "omp:session"
)

const rpcReadBufferSize = 64 << 10

const rpcStderrTailBytes = 8 << 10

const rpcCmdIDCap = 64

var hostStateSeq atomic.Uint64

var rpcStopGrace = 3 * time.Second

var rpcExitDrain = time.Second

var (
	rpcCommand = "omp"
	rpcArgs    = []string{"--mode", "rpc"}
)

var (
	errRPCEmptyKey      = errors.New("omp rpc: session key must not be empty")
	errRPCSessionExists = errors.New("omp rpc: a session is already running for that key")
	errRPCNotRunning    = errors.New("omp rpc: no session is running for that key")
	errRPCNotJSON       = errors.New("omp rpc: command must be a single JSON object")
)

type StartOptions struct {
	Cwd           string `json:"cwd"`
	Resume        string `json:"resume"`
	Model         string `json:"model"`
	ThinkingLevel string `json:"thinkingLevel"`
	ApprovalMode  string `json:"approvalMode"`
}

type rpcProcess struct {
	key    string
	resume string

	cmd    *exec.Cmd
	cancel context.CancelFunc
	stdin  io.WriteCloser
	stdout *os.File
	stderr *os.File

	writeMu    sync.Mutex
	stdinOpen  bool
	readers    sync.WaitGroup
	stopOnce   sync.Once
	done       chan struct{}
	stopIssued atomic.Bool

	stderrMu  sync.Mutex
	stderrBuf []byte

	cmdMu    sync.Mutex
	cmdIDs   map[string]string
	cmdOrder []string

	emit func(event string, data ...any)
}

var (
	rpcMu       sync.Mutex
	rpcSessions = map[string]*rpcProcess{}
)

func (a *App) StartSession(key string, opts StartOptions) error {
	return rpcStart(a.emit, key, opts)
}

func (a *App) SendSession(key string, command string) error {
	return rpcSend(key, command)
}

func (a *App) StopSession(key string) error {
	return rpcStop(key)
}

func (a *App) StopAllSessions() error {
	rpcStopAll()
	return nil
}

func (a *App) ListRunningSessions() []string {
	rpcMu.Lock()
	defer rpcMu.Unlock()

	keys := make([]string, 0, len(rpcSessions))
	for key := range rpcSessions {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func rpcArgv(opts StartOptions) []string {
	args := append([]string(nil), rpcArgs...)
	if opts.Model != "" {
		args = append(args, "--model", opts.Model)
	}
	if opts.ThinkingLevel != "" {
		args = append(args, "--thinking", opts.ThinkingLevel)
	}
	if opts.ApprovalMode != "" {
		args = append(args, "--approval-mode", opts.ApprovalMode)
	}
	if opts.Resume != "" {
		args = append(args, "--resume", opts.Resume)
	}
	return args
}

func rpcStart(emit func(event string, data ...any), key string, opts StartOptions) error {
	if key == "" {
		return errRPCEmptyKey
	}

	rpcMu.Lock()
	defer rpcMu.Unlock()

	if _, exists := rpcSessions[key]; exists {
		return errRPCSessionExists
	}

	if opts.Resume != "" && sessionLockHeld(opts.Resume) {
		return fmt.Errorf("omp rpc: session is running in another omp process (%s); close it before resuming here", opts.Resume)
	}

	cwd := opts.Cwd
	if cwd == "" {
		dir, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("omp rpc: resolve working directory: %w", err)
		}
		cwd = dir
	}

	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, rpcCommand, rpcArgv(opts)...)
	cmd.Dir = cwd
	cmd.WaitDelay = rpcExitDrain

	stdin, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("omp rpc: stdin pipe: %w", err)
	}
	stdoutR, stdoutW, err := os.Pipe()
	if err != nil {
		cancel()
		return fmt.Errorf("omp rpc: stdout pipe: %w", err)
	}
	stderrR, stderrW, err := os.Pipe()
	if err != nil {
		stdoutR.Close()
		stdoutW.Close()
		cancel()
		return fmt.Errorf("omp rpc: stderr pipe: %w", err)
	}
	cmd.Stdout = stdoutW
	cmd.Stderr = stderrW

	if err := cmd.Start(); err != nil {
		stdoutR.Close()
		stdoutW.Close()
		stderrR.Close()
		stderrW.Close()
		cancel()
		return fmt.Errorf("omp rpc: start: %w", err)
	}
	_ = stdoutW.Close()
	_ = stderrW.Close()

	p := &rpcProcess{
		key:       key,
		resume:    opts.Resume,
		cmd:       cmd,
		cancel:    cancel,
		stdin:     stdin,
		stdinOpen: true,
		stdout:    stdoutR,
		stderr:    stderrR,
		done:      make(chan struct{}),
		cmdIDs:    map[string]string{},
		emit:      emit,
	}
	rpcSessions[key] = p

	p.readers.Add(2)
	go p.readStdout(stdoutR)
	go p.drainStderr(stderrR)
	go p.reap()
	return nil
}

func rpcSend(key string, command string) error {
	trimmed := strings.TrimSpace(command)
	var probe map[string]json.RawMessage
	if trimmed == "" || json.Unmarshal([]byte(trimmed), &probe) != nil || len(probe) == 0 {
		return errRPCNotJSON
	}

	p := rpcLookup(key)
	if p == nil {
		return errRPCNotRunning
	}
	return p.writeCommand(trimmed, rawString(probe["id"]), rawString(probe["type"]))
}

func (p *rpcProcess) writeCommand(command, id, commandType string) error {
	p.writeMu.Lock()
	defer p.writeMu.Unlock()
	if !p.stdinOpen {
		return errRPCNotRunning
	}
	if _, err := io.WriteString(p.stdin, command+"\n"); err != nil {
		return fmt.Errorf("omp rpc: write: %w", err)
	}
	p.noteCommand(id, commandType)
	return nil
}

func rpcStop(key string) error {
	p := rpcLookup(key)
	if p == nil {
		return errRPCNotRunning
	}

	p.shutdown()
	return nil
}

func rpcStopAll() {
	rpcMu.Lock()
	procs := make([]*rpcProcess, 0, len(rpcSessions))
	for _, p := range rpcSessions {
		procs = append(procs, p)
	}
	rpcMu.Unlock()

	var wg sync.WaitGroup
	for _, p := range procs {
		wg.Add(1)
		go func(p *rpcProcess) {
			defer wg.Done()
			p.shutdown()
		}(p)
	}
	wg.Wait()
}

func rpcLookup(key string) *rpcProcess {
	rpcMu.Lock()
	defer rpcMu.Unlock()
	return rpcSessions[key]
}

func (p *rpcProcess) shutdown() {
	p.stopOnce.Do(func() {
		p.stopIssued.Store(true)

		p.writeMu.Lock()
		if p.stdinOpen {
			p.stdinOpen = false
			_ = p.stdin.Close()
		}
		p.writeMu.Unlock()

		select {
		case <-p.done:
		case <-time.After(rpcStopGrace):
			p.killTree()
			p.cancel()
		}
	})
	<-p.done
}

func (p *rpcProcess) killTree() {
	if runtime.GOOS != "windows" {
		p.cancel()
		return
	}
	if p.cmd.Process == nil {
		return
	}
	killCtx, killCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer killCancel()
	kill := exec.CommandContext(killCtx, "taskkill", "/T", "/F", "/PID", strconv.Itoa(p.cmd.Process.Pid))
	_ = kill.Run()
}

func (p *rpcProcess) readStdout(r io.Reader) {
	defer p.readers.Done()

	reader := bufio.NewReaderSize(r, rpcReadBufferSize)
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			p.emitFrame(line)
		}
		if err != nil {
			return
		}
	}
}

func (p *rpcProcess) drainStderr(r io.Reader) {
	defer p.readers.Done()

	buf := make([]byte, 4096)
	for {
		n, err := r.Read(buf)
		if n > 0 {
			p.appendStderr(buf[:n])
		}
		if err != nil {
			return
		}
	}
}

func (p *rpcProcess) appendStderr(chunk []byte) {
	p.stderrMu.Lock()
	defer p.stderrMu.Unlock()
	p.stderrBuf = append(p.stderrBuf, chunk...)
	if over := len(p.stderrBuf) - rpcStderrTailBytes; over > 0 {
		p.stderrBuf = append(p.stderrBuf[:0], p.stderrBuf[over:]...)
	}
}

func (p *rpcProcess) stderrTail() string {
	p.stderrMu.Lock()
	defer p.stderrMu.Unlock()
	return strings.TrimSpace(string(p.stderrBuf))
}

func (p *rpcProcess) noteCommand(id, commandType string) {
	if id == "" || commandType == "" {
		return
	}

	p.cmdMu.Lock()
	defer p.cmdMu.Unlock()
	if _, tracked := p.cmdIDs[id]; !tracked {
		p.cmdOrder = append(p.cmdOrder, id)
	}
	p.cmdIDs[id] = commandType
	for len(p.cmdOrder) > rpcCmdIDCap {
		oldest := p.cmdOrder[0]
		p.cmdOrder = p.cmdOrder[1:]
		delete(p.cmdIDs, oldest)
	}
}

func (p *rpcProcess) consumeCommand(id string) string {
	p.cmdMu.Lock()
	defer p.cmdMu.Unlock()

	commandType := p.cmdIDs[id]
	delete(p.cmdIDs, id)
	for i, tracked := range p.cmdOrder {
		if tracked == id {
			p.cmdOrder = append(p.cmdOrder[:i], p.cmdOrder[i+1:]...)
			break
		}
	}
	return commandType
}

func rawString(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return ""
	}
	return s
}

func (p *rpcProcess) reap() {
	err := p.cmd.Wait()
	if p.stdout != nil {
		_ = p.stdout.Close()
	}
	if p.stderr != nil {
		_ = p.stderr.Close()
	}
	p.readers.Wait()
	p.cancel()

	detail := ""
	if err != nil && !p.stopIssued.Load() {
		if tail := p.stderrTail(); tail != "" {
			detail = fmt.Sprintf("%v; stderr: %s", err, tail)
		} else {
			detail = err.Error()
		}
	} else if tail := p.stderrTail(); tail != "" {
		detail = tail
	}
	p.emit(eventRPCExit, p.key, detail)

	rpcMu.Lock()
	if rpcSessions[p.key] == p {
		delete(rpcSessions, p.key)
	}
	rpcMu.Unlock()

	close(p.done)
}

func (p *rpcProcess) requestState() {
	id := fmt.Sprintf("host-state-%d", hostStateSeq.Add(1))
	command, err := json.Marshal(map[string]string{"id": id, "type": "get_state"})
	if err != nil {
		return
	}
	_ = p.writeCommand(string(command), id, "get_state")
}

func (p *rpcProcess) emitFrame(raw []byte) {
	line := strings.TrimRight(string(raw), "\r\n")
	if line == "" {
		return
	}

	var frame map[string]any
	if err := json.Unmarshal([]byte(line), &frame); err != nil {
		p.emit(eventRPCFrame, p.key, map[string]any{
			"type": "rpc_parse_error",
			"raw":  line,
		})
		return
	}
	p.emit(eventRPCFrame, p.key, frame)
	if frameType, _ := frame["type"].(string); frameType == "ready" {
		go p.requestState()
	}
	p.emitSession(frame)
}

func (p *rpcProcess) emitSession(frame map[string]any) {
	frameType, _ := frame["type"].(string)
	switch frameType {
	case "session_info_update":
	case "response":
		id, _ := frame["id"].(string)
		if id == "" || p.consumeCommand(id) != "get_state" {
			return
		}
	default:
		return
	}

	id, file := sessionIdentity(frame)
	if id == "" && file == "" {
		return
	}
	p.emit(eventRPCSession, p.key, id, file)
}

func sessionIdentity(frame map[string]any) (id string, file string) {
	data, _ := frame["data"].(map[string]any)
	id = stringField(data, "sessionId")
	file = stringField(data, "sessionFile")
	if id == "" {
		id = stringField(frame, "sessionId")
	}
	if file == "" {
		file = stringField(frame, "sessionFile")
	}
	return id, file
}

func stringField(m map[string]any, key string) string {
	if m == nil {
		return ""
	}
	s, _ := m[key].(string)
	return s
}

func (a *App) emit(event string, data ...any) {
	if a.ctx == nil {
		return
	}
	wailsruntime.EventsEmit(a.ctx, event, data...)
}
