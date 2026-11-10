// Package system wraps everything that talks to the operating system:
// running commands, managing Unix users/groups and controlling the Samba service.
package system

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// Runner runs external commands. It exists so the rest of the code can be
// tested without touching the host.
type Runner interface {
	Run(ctx context.Context, stdin string, name string, args ...string) (string, error)
}

// CmdError is returned when a command fails. It carries the command's own
// error output so callers can show something more useful than "exit status 9".
type CmdError struct {
	Cmd    string
	Err    error
	Output string
}

func (e *CmdError) Error() string {
	msg := strings.TrimSpace(e.Output)
	if msg == "" {
		msg = e.Err.Error()
	}
	return fmt.Sprintf("%s: %s", e.Cmd, msg)
}

func (e *CmdError) Unwrap() error { return e.Err }

// ExecRunner is the real Runner. Commands are killed after Timeout (30s default).
type ExecRunner struct {
	Timeout time.Duration
}

// Run executes name with args, feeding stdin if non-empty, and returns stdout.
func (r ExecRunner) Run(ctx context.Context, stdin string, name string, args ...string) (string, error) {
	timeout := r.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	bin := name
	if p, err := LookupPath(name); err == nil {
		bin = p
	}
	cmd := exec.CommandContext(ctx, bin, args...)
	cmd.Env = append(os.Environ(), "LC_ALL=C")
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		out := stderr.String()
		if strings.TrimSpace(out) == "" {
			out = stdout.String()
		}
		if ctx.Err() == context.DeadlineExceeded {
			err = fmt.Errorf("timed out after %s", timeout)
		}
		return stdout.String(), &CmdError{Cmd: name, Err: err, Output: out}
	}
	return stdout.String(), nil
}

// HaveCommand reports whether a binary is on PATH.
func HaveCommand(name string) bool {
	_, err := LookupPath(name)
	return err == nil
}

// LookupPath returns the full path of a binary, also looking in the sbin
// directories that are often missing from a non-root user's PATH.
func LookupPath(name string) (string, error) {
	if p, err := exec.LookPath(name); err == nil {
		return p, nil
	}
	for _, dir := range []string{"/usr/sbin", "/sbin", "/usr/local/sbin"} {
		p := dir + "/" + name
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() && fi.Mode()&0o111 != 0 {
			return p, nil
		}
	}
	return "", exec.ErrNotFound
}
