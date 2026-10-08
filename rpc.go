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
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Events pushed to the frontend by the RPC bridge.
const (
	eventRPCFrame = "omp:frame"
	eventRPCExit  = "omp:rpc-exit"
)

// rpcReadBufferSize is only the initial bufio buffer. ReadBytes grows it on
// demand, so protocol frames of up to omp's 1 MiB transport limit are read
// whole -- unlike bufio.Scanner, which would fail on its 64 KiB default line
// limit.
const rpcReadBufferSize = 64 << 10

// rpcStderrTailBytes caps how much of the child's stderr is kept for the exit
// event detail, so a crashed child reports its actual failure output instead
// of a bare "exit status 1".
const rpcStderrTailBytes = 8 << 10

// rpcStopGrace is how long StopRPC waits after closing the child's stdin
// before killing it. omp's rpc mode exits on its own once stdin hits EOF, so
// a well-behaved child never reaches the kill path.
var rpcStopGrace = 3 * time.Second

// rpcExitDrain bounds how long a dead child's pipes may stay open after the
// process exits. Grandchildren inherit the stdio handles, so without this a
// killed child whose descendants live on would leave the stdout reader
// blocked forever and the session slot pinned ("already running").
var rpcExitDrain = time.Second

// The spawned command lives in variables so tests can substitute a fake omp
// (the go test binary re-executing itself as a helper process).
var (
	rpcCommand = "omp"
	rpcArgs    = []string{"--mode", "rpc"}
)

var (
	errRPCAlreadyRunning = errors.New("omp rpc: a process is already running")
	errRPCNotRunning     = errors.New("omp rpc: no process is running")
	errRPCNotJSON        = errors.New("omp rpc: command must be a single JSON object")
)

// rpcProcess is the state of one `omp --mode rpc` subprocess.
//
// Protocol contract (src/modes/rpc in the omp CLI, wire v1):
//   - stdin: JSON lines, each a flat command `{"id?","type",...fields}`
//   - stdout: JSON lines; the first frame is `{"type":"ready",...}`, then
//     responses correlated by `id`, notifications, and session events
//   - stderr: free-form diagnostics, never protocol
type rpcProcess struct {
	cmd    *exec.Cmd
	cancel context.CancelFunc
	stdin  io.WriteCloser
	// stdout/stderr are the host-owned read ends; reap closes them after the
	// process exits so the readers always unblock.
	stdout *os.File
	stderr *os.File

	writeMu    sync.Mutex // serializes writes to stdin
	stdinOpen  bool       // guarded by writeMu; false once StopRPC closed it
	readers    sync.WaitGroup
	stopOnce   sync.Once // idempotent graceful-shutdown sequence
	done       chan struct{}
	stopIssued atomic.Bool // true once shutdown() ran; exit detail then reports the clean path

	stderrMu  sync.Mutex
	stderrBuf []byte // bounded tail, kept for the exit detail

	emit func(event string, data ...any)
}

var (
	rpcMu      sync.Mutex
	rpcCurrent *rpcProcess
)

// StartRPC launches `omp --mode rpc` in cwd and starts streaming its stdout
// frames to the frontend. It returns an error if a process is already running.
func (a *App) StartRPC(cwd string) error {
	return rpcStart(a.emit, cwd)
}

// RPCSend writes one newline-terminated JSON command to the child's stdin.
// The payload must be a single JSON object; omp's wire protocol is flat
// commands like {"id":"...","type":"prompt","message":"..."}.
func (a *App) RPCSend(command string) error {
	return rpcSend(command)
}

// StopRPC closes the child's stdin and waits for a graceful exit; if the
// child is still alive after the grace period it is killed (process tree on
// Windows). It is a no-op when nothing is running.
func (a *App) StopRPC() error {
	return rpcStop()
}

func rpcStart(emit func(event string, data ...any), cwd string) error {
	rpcMu.Lock()
	defer rpcMu.Unlock()

	if rpcCurrent != nil {
		return errRPCAlreadyRunning
	}

	if cwd == "" {
		dir, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("omp rpc: resolve working directory: %w", err)
		}
		cwd = dir
	}

	// Session persistence is left at its default on purpose: no --no-session.
	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, rpcCommand, rpcArgs...)
	cmd.Dir = cwd
	// WaitDelay bounds how long cmd.Wait lets the pipes drain after the
	// process exits before force-closing them (see reap).
	cmd.WaitDelay = rpcExitDrain

	stdin, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("omp rpc: stdin pipe: %w", err)
	}
	// Stdout/stderr use explicit pipes so the host owns the read ends: on
	// process exit the host closes them itself, which unblocks the readers
	// even when a grandchild inherited the write ends (the Windows case where
	// StderrPipe/StdoutPipe readers would never see EOF and pin the slot).
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
	// The parent keeps no write end: closing them makes the host's read ends
	// the only owners, so EOF arrives as soon as the child (and any
	// descendant that inherited the handle) closes its copy.
	_ = stdoutW.Close()
	_ = stderrW.Close()

	p := &rpcProcess{
		cmd:       cmd,
		cancel:    cancel,
		stdin:     stdin,
		stdinOpen: true,
		stdout:    stdoutR,
		stderr:    stderrR,
		done:      make(chan struct{}),
		emit:      emit,
	}
	rpcCurrent = p

	p.readers.Add(2)
	go p.readStdout(stdoutR)
	go p.drainStderr(stderrR)
	go p.reap()
	return nil
}

func rpcSend(command string) error {
	trimmed := strings.TrimSpace(command)
	var probe map[string]json.RawMessage
	if trimmed == "" || json.Unmarshal([]byte(trimmed), &probe) != nil || len(probe) == 0 {
		return errRPCNotJSON
	}

	rpcMu.Lock()
	p := rpcCurrent
	rpcMu.Unlock()

	if p == nil {
		return errRPCNotRunning
	}

	// One writer at a time, so concurrent commands cannot interleave.
	p.writeMu.Lock()
	defer p.writeMu.Unlock()
	if !p.stdinOpen {
		return errRPCNotRunning
	}
	if _, err := io.WriteString(p.stdin, trimmed+"\n"); err != nil {
		return fmt.Errorf("omp rpc: write: %w", err)
	}
	return nil
}

func rpcStop() error {
	rpcMu.Lock()
	p := rpcCurrent
	rpcMu.Unlock()

	if p == nil {
		return nil
	}

	p.shutdown()
	return nil
}

// shutdown runs the graceful-stop sequence exactly once: stdin EOF (omp's rpc
// mode drains and exits on its own), a bounded wait, then a process-tree kill
// for children that ignore EOF.
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

// killTree terminates the child and its descendants. context cancellation
// alone only signals the direct child, while omp may spawn its own.
func (p *rpcProcess) killTree() {
	if runtime.GOOS != "windows" {
		p.cancel() // POSIX: direct kill; adequate for the MVP.
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

// readStdout parses newline-delimited JSON frames and forwards each one.
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

// drainStderr keeps reading stderr into a bounded tail: an undrained pipe
// would block the child, and the tail is the only diagnostics source when the
// process dies.
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

// reap waits for the process, lets the pipe readers drain, emits the exit
// event and only then releases the single-session slot. Emitting before
// clearing rpcCurrent is deliberate: a StartRPC that races a shutdown must
// never observe a nil slot while the previous session's exit event is still
// undelivered, or the frontend attributes the old exit to the new session.
//
// Order matters. cmd.Wait runs first: with cmd.WaitDelay set it lets the
// readers drain the pipes for a bounded window after the process exits, then
// force-closes them. Waiting on the readers first would deadlock whenever a
// grandchild inherits the stdio handles and outlives the child — the readers
// would never see EOF and the session slot would stay pinned forever.
func (p *rpcProcess) reap() {
	err := p.cmd.Wait()
	// Close the host's read ends: cmd.WaitDelay may already have force-closed
	// them, but when a grandchild still holds the write end only this close
	// guarantees the readers see EOF instead of pinning the session slot.
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
		// Clean or user-initiated exit, but the child complained on stderr.
		detail = tail
	}
	var payload any
	if detail != "" {
		payload = detail
	}
	p.emit(eventRPCExit, payload)

	rpcMu.Lock()
	if rpcCurrent == p {
		rpcCurrent = nil
	}
	rpcMu.Unlock()

	close(p.done)
}

// emitFrame forwards one raw stdout line as a parsed frame.
func (p *rpcProcess) emitFrame(raw []byte) {
	line := strings.TrimRight(string(raw), "\r\n")
	if line == "" {
		return
	}

	var frame map[string]any
	if err := json.Unmarshal([]byte(line), &frame); err != nil {
		p.emit(eventRPCFrame, map[string]any{
			"type": "rpc_parse_error",
			"raw":  line,
		})
		return
	}
	p.emit(eventRPCFrame, frame)
}

// emit is a nil-safe EventsEmit wrapper; a.ctx is only set after startup.
func (a *App) emit(event string, data ...any) {
	if a.ctx == nil {
		return
	}
	wailsruntime.EventsEmit(a.ctx, event, data...)
}
