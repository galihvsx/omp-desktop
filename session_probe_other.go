//go:build !windows

package main

func sessionLockHeld(path string) bool {
	return false
}

func sessionProbeAuthoritative() bool {
	return false
}
