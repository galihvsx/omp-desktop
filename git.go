package main

import (
	"strconv"
	"strings"
)

type GitStatus struct {
	Branch     string `json:"branch"`
	Changed    int    `json:"changed"`
	Insertions int    `json:"insertions"`
	Deletions  int    `json:"deletions"`
}

func ReadGitStatus(cwd string) GitStatus {
	var status GitStatus
	if cwd == "" {
		return status
	}

	if current := gitLines(cwd, "rev-parse", "--abbrev-ref", "HEAD"); len(current) > 0 {
		if name := current[0]; name != "HEAD" {
			status.Branch = name
		}
	}
	status.Changed = len(gitLines(cwd, "status", "--porcelain"))
	for _, line := range gitLines(cwd, "diff", "--numstat", "HEAD") {
		added, removed, ok := numstatLine(line)
		if !ok {
			continue
		}
		status.Insertions += added
		status.Deletions += removed
	}
	return status
}

func numstatLine(line string) (int, int, bool) {
	fields := strings.Split(line, "\t")
	if len(fields) < 3 {
		return 0, 0, false
	}
	added, err := strconv.Atoi(fields[0])
	if err != nil {
		return 0, 0, false
	}
	removed, err := strconv.Atoi(fields[1])
	if err != nil {
		return 0, 0, false
	}
	return added, removed, true
}

func (a *App) GitStatus(cwd string) (GitStatus, error) {
	return ReadGitStatus(cwd), nil
}
