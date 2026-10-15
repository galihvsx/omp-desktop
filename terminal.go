package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode/utf8"

	"github.com/aymanbagabas/go-pty"
)

const (
	eventTermData = "term:data"
	eventTermExit = "term:exit"
)

const (
	termReadBufferSize = 32 << 10
	termStopGrace      = 3 * time.Second
	termExitGrace      = 2 * time.Second
	termDefaultCols    = 80
	termDefaultRows    = 24
	termMaxCols        = 500
	termMaxRows        = 200
)

var errTermNotRunning = errors.New("omp terminal: no terminal is running")

var (
	termCommand string
	termArgs    []string
)

type termSession struct {
	pty pty.Pty
	cmd *pty.Cmd

	shellName string

	exited  chan struct{}
	waitErr error

	stopped atomic.Bool

	writeMu sync.Mutex

	closeOnce sync.Once

	done chan struct{}
}

var (
	termMu       sync.Mutex
	termSessions = map[string]*termSession{}
)

func (a *App) StartTerminal(id string, cols int, rows int) error {
	return termStart(a.emit, id, cols, rows)
}

func (a *App) TerminalWrite(id string, data string) error {
	s := termCurrent(id)
	if s == nil {
		return errTermNotRunning
	}
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	if _, err := s.pty.Write([]byte(data)); err != nil {
		return fmt.Errorf("omp terminal: write: %w", err)
	}
	return nil
}

func (a *App) TerminalResize(id string, cols int, rows int) error {
	s := termCurrent(id)
	if s == nil {
		return errTermNotRunning
	}
	width, height := termClampSize(cols, rows)
	if err := s.pty.Resize(width, height); err != nil {
		return fmt.Errorf("omp terminal: resize: %w", err)
	}
	return nil
}

func (a *App) StopTerminal(id string) error {
	return termStop(id)
}

func (a *App) StopAllTerminals() error {
	return termStopAll()
}

func termStart(emit func(event string, data ...any), id string, cols int, rows int) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("omp terminal: terminal id is required")
	}
	termMu.Lock()
	defer termMu.Unlock()
	if termSessions[id] != nil {
		return nil
	}

	shell, args, err := termShell()
	if err != nil {
		return err
	}
	p, err := pty.New()
	if err != nil {
		return fmt.Errorf("omp terminal: open pty: %w", err)
	}
	width, height := termClampSize(cols, rows)
	if err := p.Resize(width, height); err != nil {
		_ = p.Close()
		return fmt.Errorf("omp terminal: size pty: %w", err)
	}

	cmd := p.Command(shell, args...)
	cmd.Dir = termWorkingDir()
	cmd.Env = termEnv()
	if err := cmd.Start(); err != nil {
		_ = p.Close()
		return fmt.Errorf("omp terminal: start %s: %w", shell, err)
	}

	s := &termSession{
		pty:       p,
		cmd:       cmd,
		shellName: termShellLabel(shell),
		exited:    make(chan struct{}),
		done:      make(chan struct{}),
	}
	termSessions[id] = s
	go termWait(s)
	go termRead(emit, id, s)
	return nil
}

func (a *App) TerminalShellName(id string) string {
	s := termCurrent(id)
	if s == nil {
		return ""
	}
	return s.shellName
}

func termStop(id string) error {
	termMu.Lock()
	s := termSessions[id]
	if s == nil {
		termMu.Unlock()
		return nil
	}
	delete(termSessions, id)
	termMu.Unlock()

	s.stopped.Store(true)
	var killErr error
	if s.cmd.Process != nil {
		if err := s.cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
			killErr = fmt.Errorf("omp terminal: kill shell: %w", err)
		}
	}
	s.release()

	select {
	case <-s.done:
	case <-time.After(termStopGrace):
		return errors.Join(killErr, fmt.Errorf("omp terminal: stop timed out after %s", termStopGrace))
	}
	return killErr
}

func termStopAll() error {
	termMu.Lock()
	ids := make([]string, 0, len(termSessions))
	for id := range termSessions {
		ids = append(ids, id)
	}
	termMu.Unlock()

	var errs []error
	for _, id := range ids {
		if err := termStop(id); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func termWait(s *termSession) {
	s.waitErr = s.cmd.Wait()
	close(s.exited)
	s.release()
}

func (s *termSession) release() {
	s.closeOnce.Do(func() {
		_ = s.pty.Close()
	})
}

func termRead(emit func(event string, data ...any), id string, s *termSession) {
	buf := make([]byte, termReadBufferSize)
	var carry []byte
	for {
		n, err := s.pty.Read(buf)
		if n > 0 {
			chunk, rest := termSplitUTF8(carry, buf[:n])
			carry = rest
			if chunk != "" {
				emit(eventTermData, id, chunk)
			}
		}
		if err != nil {
			break
		}
	}

	select {
	case <-s.exited:
	case <-time.After(termExitGrace):
	}

	termMu.Lock()
	if termSessions[id] == s {
		delete(termSessions, id)
	}
	termMu.Unlock()

	if !s.stopped.Load() {
		emit(eventTermExit, id, termExitDetail(s))
	}
	close(s.done)
}

func termExitDetail(s *termSession) string {
	if s.waitErr == nil {
		return ""
	}
	return s.waitErr.Error()
}

func termCurrent(id string) *termSession {
	termMu.Lock()
	defer termMu.Unlock()
	return termSessions[id]
}

func termShell() (string, []string, error) {
	if termCommand != "" {
		return termCommand, termArgs, nil
	}
	if runtime.GOOS == "windows" {
		for _, name := range []string{"pwsh", "powershell", "cmd"} {
			if path, err := exec.LookPath(name); err == nil {
				return path, nil, nil
			}
		}
		return "", nil, errors.New("omp terminal: no shell found (tried pwsh, powershell, cmd)")
	}
	if sh := os.Getenv("SHELL"); sh != "" {
		if path, err := exec.LookPath(sh); err == nil {
			return path, nil, nil
		}
	}
	if path, err := exec.LookPath("/bin/sh"); err == nil {
		return path, nil, nil
	}
	return "", nil, errors.New("omp terminal: no shell found (tried $SHELL, /bin/sh)")
}

func termShellLabel(shell string) string {
	base := strings.ToLower(filepath.Base(shell))
	base = strings.TrimSuffix(base, ".exe")
	switch base {
	case "pwsh", "powershell":
		return "PowerShell"
	case "cmd":
		return "Command Prompt"
	case "":
		return ""
	}
	return base
}

func termWorkingDir() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	return dir
}

func termEnv() []string {
	env := os.Environ()
	if runtime.GOOS != "windows" {
		env = append(env, "TERM=xterm-256color", "COLORTERM=truecolor")
	}
	return env
}

func termClampSize(cols, rows int) (int, int) {
	switch {
	case cols <= 0:
		cols = termDefaultCols
	case cols > termMaxCols:
		cols = termMaxCols
	}
	switch {
	case rows <= 0:
		rows = termDefaultRows
	case rows > termMaxRows:
		rows = termMaxRows
	}
	return cols, rows
}

func termSplitUTF8(carry []byte, data []byte) (string, []byte) {
	if len(carry) > 0 {
		joined := make([]byte, 0, len(carry)+len(data))
		joined = append(joined, carry...)
		joined = append(joined, data...)
		data = joined
	}

	start := len(data) - utf8.UTFMax
	if start < 0 {
		start = 0
	}
	for i := len(data) - 1; i >= start; i-- {
		b := data[i]
		if b < utf8.RuneSelf {
			break
		}
		if b&0xC0 == 0x80 {
			continue
		}
		size := utf8LeadSize(b)
		if size == 0 || i+size <= len(data) {
			break
		}
		return string(data[:i]), append([]byte(nil), data[i:]...)
	}
	return string(data), nil
}

func utf8LeadSize(b byte) int {
	switch {
	case b&0xE0 == 0xC0:
		return 2
	case b&0xF0 == 0xE0:
		return 3
	case b&0xF8 == 0xF0:
		return 4
	}
	return 0
}
