package api

import (
	"bufio"
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"samba-manager/internal/system"
)

// DiskInfo describes a mounted filesystem.
type DiskInfo struct {
	Filesystem  string  `json:"filesystem"`
	Size        string  `json:"size"`
	Used        string  `json:"used"`
	Available   string  `json:"available"`
	UsePercent  float64 `json:"usePercent"`
	MountedOn   string  `json:"mountedOn"`
	DisplayName string  `json:"displayName"`
	IsVirtualFS bool    `json:"isVirtualFS,omitempty"`
}

// ShareSizeInfo describes how much space a share uses.
type ShareSizeInfo struct {
	Name       string  `json:"name"`
	Path       string  `json:"path"`
	Size       string  `json:"size"`
	Used       string  `json:"used"`
	Available  string  `json:"available"`
	UsePercent float64 `json:"usePercent"`
}

const cacheDuration = time.Minute

type cached[T any] struct {
	mu   sync.Mutex
	at   time.Time
	data T
}

func (c *cached[T]) get(fn func() (T, error)) (T, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.at.IsZero() && time.Since(c.at) < cacheDuration {
		return c.data, nil
	}
	v, err := fn()
	if err != nil {
		var zero T
		return zero, err
	}
	c.data, c.at = v, time.Now()
	return v, nil
}

var (
	disksCache  cached[[]DiskInfo]
	sharesCache cached[[]ShareSizeInfo]
)

var virtualFS = map[string]bool{
	"tmpfs": true, "devtmpfs": true, "overlay": true, "squashfs": true,
	"proc": true, "sysfs": true, "devpts": true, "cgroup": true, "cgroup2": true,
	"mqueue": true, "ramfs": true, "efivarfs": true, "securityfs": true,
}

// humanSize formats bytes like `df -h`.
func humanSize(b uint64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%dB", b)
	}
	v := float64(b)
	for _, u := range []string{"K", "M", "G", "T", "P"} {
		v /= unit
		if v < unit || u == "P" {
			if v < 10 {
				return fmt.Sprintf("%.1f%s", v, u)
			}
			return fmt.Sprintf("%.0f%s", v, u)
		}
	}
	return ""
}

func statfs(path string) (total, free, avail uint64, err error) {
	var st syscall.Statfs_t
	if err = syscall.Statfs(path, &st); err != nil {
		return
	}
	bs := uint64(st.Bsize)
	return st.Blocks * bs, st.Bfree * bs, st.Bavail * bs, nil
}

func createDisplayName(mountPath string) string {
	if len(mountPath) <= 20 {
		return mountPath
	}
	parts := strings.Split(mountPath, "/")
	if len(parts) <= 3 {
		return mountPath
	}
	return "/" + parts[1] + "/…/" + parts[len(parts)-1]
}

func listFilesystems() ([]DiskInfo, error) {
	f, err := os.Open("/proc/mounts")
	if err != nil {
		return nil, err
	}
	defer f.Close()

	seen := map[string]bool{}
	disks := []DiskInfo{}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 3 {
			continue
		}
		dev, mount, fstype := fields[0], strings.ReplaceAll(fields[1], `\040`, " "), fields[2]
		if seen[mount] || strings.HasPrefix(mount, "/proc") || strings.HasPrefix(mount, "/sys") || strings.HasPrefix(mount, "/dev") {
			continue
		}
		if fi, err := os.Stat(mount); err != nil || !fi.IsDir() {
			continue // bind-mounted files such as /etc/hosts
		}
		total, free, avail, err := statfs(mount)
		if err != nil || total == 0 {
			continue
		}
		seen[mount] = true
		used := total - free
		pct := 0.0
		if used+avail > 0 {
			pct = float64(used) / float64(used+avail) * 100
		}
		disks = append(disks, DiskInfo{
			Filesystem:  dev,
			Size:        humanSize(total),
			Used:        humanSize(used),
			Available:   humanSize(avail),
			UsePercent:  float64(int(pct + 0.5)),
			MountedOn:   mount,
			DisplayName: createDisplayName(mount),
			IsVirtualFS: virtualFS[fstype],
		})
	}
	return disks, sc.Err()
}

func (s *Server) getFileSystems(w http.ResponseWriter, r *http.Request) error {
	disks, err := disksCache.get(listFilesystems)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"disks": disks})
	return nil
}

func dirSize(ctx context.Context, path string) (uint64, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "du", "-sb", "--", path).Output()
	if err != nil && len(out) == 0 {
		return 0, err
	}
	fields := strings.Fields(string(out))
	if len(fields) == 0 {
		return 0, fmt.Errorf("unexpected du output")
	}
	return strconv.ParseUint(fields[0], 10, 64)
}

func (s *Server) computeShareSizes(ctx context.Context) ([]ShareSizeInfo, error) {
	f, err := s.Store.Read()
	if err != nil {
		return nil, err
	}
	type job struct{ name, path string }
	var jobs []job
	for _, sec := range f.Sections {
		if system.ReservedSections[strings.ToLower(sec.Name)] {
			continue
		}
		if p, ok := sec.Get("path"); ok && p != "" {
			jobs = append(jobs, job{sec.Name, p})
		}
	}
	results := make([]*ShareSizeInfo, len(jobs))
	sem := make(chan struct{}, 4)
	var wg sync.WaitGroup
	for i, j := range jobs {
		wg.Add(1)
		go func(i int, j job) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			total, _, avail, err := statfs(j.path)
			if err != nil {
				return // directory missing: skip
			}
			info := &ShareSizeInfo{Name: j.name, Path: j.path, Size: humanSize(total), Available: humanSize(avail), Used: "N/A"}
			if used, err := dirSize(ctx, j.path); err == nil {
				info.Used = humanSize(used)
				if total > 0 {
					info.UsePercent = float64(used) / float64(total) * 100
				}
			}
			results[i] = info
		}(i, j)
	}
	wg.Wait()
	out := []ShareSizeInfo{}
	for _, r := range results {
		if r != nil {
			out = append(out, *r)
		}
	}
	return out, nil
}

func (s *Server) getShareSizes(w http.ResponseWriter, r *http.Request) error {
	shares, err := sharesCache.get(func() ([]ShareSizeInfo, error) { return s.computeShareSizes(r.Context()) })
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"shares": shares})
	return nil
}
