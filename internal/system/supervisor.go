package system

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

// Daemon is a long running process the supervisor keeps alive.
type Daemon struct {
	Name string
	Cmd  string
	Args []string
	// Pre, if set, runs once before every (re)start.
	Pre func() error
}

// Supervisor runs daemons in the foreground and restarts them when they exit.
// It is what makes the single binary usable as the container's main process.
type Supervisor struct {
	daemons []Daemon

	mu    sync.Mutex
	procs map[string]*exec.Cmd
	wg    sync.WaitGroup
}

// NewSupervisor creates a supervisor for the given daemons.
func NewSupervisor(daemons ...Daemon) *Supervisor {
	return &Supervisor{daemons: daemons, procs: map[string]*exec.Cmd{}}
}

// Start launches every daemon. They stop (SIGTERM, then SIGKILL after 10s)
// when ctx is cancelled; use Wait to block until they are gone.
func (s *Supervisor) Start(ctx context.Context) {
	for _, d := range s.daemons {
		s.wg.Add(1)
		go s.loop(ctx, d)
	}
}

// Wait blocks until all daemons have exited.
func (s *Supervisor) Wait() { s.wg.Wait() }

// Restart terminates the named daemon; the supervisor starts it again.
func (s *Supervisor) Restart(name string) error {
	s.mu.Lock()
	cmd := s.procs[name]
	s.mu.Unlock()
	if cmd == nil || cmd.Process == nil {
		return fmt.Errorf("%s is not running (the supervisor will start it shortly)", name)
	}
	return cmd.Process.Signal(syscall.SIGTERM)
}

func (s *Supervisor) loop(ctx context.Context, d Daemon) {
	defer s.wg.Done()
	delay := time.Second
	for ctx.Err() == nil {
		if d.Pre != nil {
			if err := d.Pre(); err != nil {
				log.Printf("supervisor: %s pre-start failed: %v", d.Name, err)
			}
		}
		cmd := exec.CommandContext(ctx, d.Cmd, d.Args...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Cancel = func() error { return cmd.Process.Signal(syscall.SIGTERM) }
		cmd.WaitDelay = 10 * time.Second

		started := time.Now()
		if err := cmd.Start(); err != nil {
			log.Printf("supervisor: cannot start %s: %v", d.Name, err)
		} else {
			log.Printf("supervisor: started %s (pid %d)", d.Name, cmd.Process.Pid)
			s.mu.Lock()
			s.procs[d.Name] = cmd
			s.mu.Unlock()
			err = cmd.Wait()
			s.mu.Lock()
			delete(s.procs, d.Name)
			s.mu.Unlock()
			if ctx.Err() != nil {
				return
			}
			log.Printf("supervisor: %s exited: %v", d.Name, err)
		}

		if time.Since(started) > 10*time.Second {
			delay = time.Second
		} else if delay < 15*time.Second {
			delay *= 2
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
	}
}
