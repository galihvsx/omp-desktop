//go:build windows

package main

import (
	"errors"

	"golang.org/x/sys/windows"
)

func sessionLockHeld(path string) bool {
	utf16Path, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return false
	}
	handle, err := windows.CreateFile(
		utf16Path,
		windows.GENERIC_READ,
		windows.FILE_SHARE_READ,
		nil,
		windows.OPEN_EXISTING,
		windows.FILE_ATTRIBUTE_NORMAL,
		0,
	)
	if err != nil {
		return errors.Is(err, windows.ERROR_SHARING_VIOLATION)
	}
	_ = windows.CloseHandle(handle)
	return false
}

func sessionProbeAuthoritative() bool {
	return true
}
