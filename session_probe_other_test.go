//go:build !windows

package main

import "testing"

func holdSessionForWrite(t *testing.T, path string) (release func(), ok bool) {
	t.Helper()
	return func() {}, false
}
