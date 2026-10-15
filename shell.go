package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"time"
)

const revealTimeout = 5 * time.Second

func (a *App) RevealPath(path string) error {
	if path == "" {
		return errors.New("omp shell: folder path must not be empty")
	}
	info, err := os.Stat(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("omp shell: folder does not exist: %s", path)
		}
		return fmt.Errorf("omp shell: stat %s: %w", path, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("omp shell: not a folder: %s", path)
	}

	ctx, cancel := context.WithTimeout(context.Background(), revealTimeout)
	defer cancel()

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.CommandContext(ctx, "explorer.exe", path)
	case "darwin":
		cmd = exec.CommandContext(ctx, "open", path)
	default:
		cmd = exec.CommandContext(ctx, "xdg-open", path)
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("omp shell: open %s: %w", path, err)
	}
	go func() { _ = cmd.Wait() }()
	return nil
}
