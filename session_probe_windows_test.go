//go:build windows

package main

import (
	"sync"
	"testing"

	"golang.org/x/sys/windows"
)

func holdSessionForWrite(t *testing.T, path string) (release func(), ok bool) {
	t.Helper()
	utf16Path, err := windows.UTF16PtrFromString(path)
	if err != nil {
		t.Fatalf("utf16 path: %v", err)
	}
	handle, err := windows.CreateFile(
		utf16Path,
		windows.GENERIC_READ|windows.GENERIC_WRITE,
		windows.FILE_SHARE_READ,
		nil,
		windows.OPEN_EXISTING,
		windows.FILE_ATTRIBUTE_NORMAL,
		0,
	)
	if err != nil {
		t.Fatalf("hold file for write: %v", err)
	}
	var once sync.Once
	release = func() {
		once.Do(func() { _ = windows.CloseHandle(handle) })
	}
	return release, true
}
