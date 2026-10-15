package main

import (
	"os"
	"time"
)

const sessionInUseRecentWindow = 60 * time.Second

type SessionInUse struct {
	InUse        bool   `json:"inUse"`
	UpdatedAgeMs int64  `json:"updatedAgeMs"`
	Reason       string `json:"reason"`
}

func (a *App) CheckSessionInUse(sessionFile string) SessionInUse {
	if sessionFile == "" {
		return SessionInUse{InUse: false, UpdatedAgeMs: -1, Reason: ""}
	}

	info, err := os.Stat(sessionFile)
	if err != nil {
		return SessionInUse{InUse: false, UpdatedAgeMs: -1, Reason: ""}
	}

	age := time.Since(info.ModTime())
	result := SessionInUse{InUse: false, UpdatedAgeMs: age.Milliseconds(), Reason: ""}
	if sessionLockHeld(sessionFile) {
		result.InUse = true
		result.Reason = "locked"
		return result
	}
	if !sessionProbeAuthoritative() && age < sessionInUseRecentWindow {
		result.InUse = true
		result.Reason = "recent"
	}
	return result
}
