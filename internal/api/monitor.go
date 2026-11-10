package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// Session is one connected SMB session.
type Session struct {
	ID         string `json:"id"`
	Username   string `json:"username"`
	Group      string `json:"group"`
	Machine    string `json:"machine"`
	Protocol   string `json:"protocol"`
	Encryption string `json:"encryption"`
	Signing    string `json:"signing"`
	Since      string `json:"since"`
}

// TreeConnect is a client connected to one share.
type TreeConnect struct {
	Share   string `json:"share"`
	Machine string `json:"machine"`
	Session string `json:"session"`
	Since   string `json:"since"`
}

func str(m map[string]any, key string) string {
	switch v := m[key].(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	}
	return ""
}

func sub(m map[string]any, key string) map[string]any {
	v, _ := m[key].(map[string]any)
	return v
}

// getSessions reports connected clients using `smbstatus --json`.
func (s *Server) getSessions(w http.ResponseWriter, r *http.Request) error {
	resp := map[string]any{"available": true, "sessions": []Session{}, "connections": []TreeConnect{}, "openFiles": 0}
	out, err := s.Run.Run(r.Context(), "", "smbstatus", "--json")
	if err != nil {
		resp["available"] = false
		resp["error"] = err.Error()
		writeJSON(w, http.StatusOK, resp)
		return nil
	}
	var raw map[string]any
	if err := json.Unmarshal([]byte(out), &raw); err != nil {
		resp["available"] = false
		resp["error"] = "unexpected smbstatus output"
		writeJSON(w, http.StatusOK, resp)
		return nil
	}

	sessions := []Session{}
	for id, v := range sub(raw, "sessions") {
		m, _ := v.(map[string]any)
		enc, sig := sub(m, "encryption"), sub(m, "signing")
		sessions = append(sessions, Session{
			ID: id, Username: str(m, "username"), Group: str(m, "groupname"),
			Machine:  firstNonEmpty(str(m, "hostname"), str(m, "remote_machine")),
			Protocol: str(m, "session_dialect"), Encryption: str(enc, "cipher"), Signing: str(sig, "cipher"),
			Since: str(m, "creation_time"),
		})
	}
	sort.Slice(sessions, func(i, j int) bool { return sessions[i].ID < sessions[j].ID })

	conns := []TreeConnect{}
	for _, v := range sub(raw, "tcons") {
		m, _ := v.(map[string]any)
		conns = append(conns, TreeConnect{
			Share: str(m, "service"), Machine: str(m, "machine"), Session: str(m, "session_id"), Since: str(m, "connected_at"),
		})
	}
	sort.Slice(conns, func(i, j int) bool { return conns[i].Share+conns[i].Session < conns[j].Share+conns[j].Session })

	resp["sessions"], resp["connections"], resp["openFiles"] = sessions, conns, len(sub(raw, "open_files"))
	writeJSON(w, http.StatusOK, resp)
	return nil
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// getLogs returns the tail of a Samba log file.
func (s *Server) getLogs(w http.ResponseWriter, r *http.Request) error {
	dir := s.Cfg.Samba.LogDir
	matches, _ := filepath.Glob(filepath.Join(dir, "log.*"))
	files := []string{}
	for _, m := range matches {
		if fi, err := os.Lstat(m); err == nil && fi.Mode().IsRegular() {
			files = append(files, filepath.Base(m))
		}
	}
	sort.Strings(files)

	name := r.URL.Query().Get("file")
	if name == "" {
		for _, f := range files {
			if f == "log.smbd" {
				name = f
			}
		}
		if name == "" && len(files) > 0 {
			name = files[0]
		}
	}
	lines := 200
	if v, err := strconv.Atoi(r.URL.Query().Get("lines")); err == nil && v > 0 && v <= 2000 {
		lines = v
	}

	resp := map[string]any{"files": files, "file": name, "lines": []string{}}
	if name != "" {
		if filepath.Base(name) != name || !strings.HasPrefix(name, "log.") {
			return badRequest("invalid log file")
		}
		found := false
		for _, f := range files {
			found = found || f == name
		}
		if !found {
			return notFound("Log file not found")
		}
		tail, err := tailFile(filepath.Join(dir, name), lines)
		if err != nil {
			return err
		}
		resp["lines"] = tail
	}
	writeJSON(w, http.StatusOK, resp)
	return nil
}

func tailFile(path string, n int) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	fi, err := f.Stat()
	if err != nil {
		return nil, err
	}
	const maxRead = 512 * 1024
	start := int64(0)
	if fi.Size() > maxRead {
		start = fi.Size() - maxRead
	}
	if _, err := f.Seek(start, io.SeekStart); err != nil {
		return nil, err
	}
	data, err := io.ReadAll(f)
	if err != nil {
		return nil, fmt.Errorf("cannot read log: %w", err)
	}
	lines := strings.Split(strings.TrimRight(string(data), "\n"), "\n")
	if start > 0 && len(lines) > 0 {
		lines = lines[1:] // first line is probably cut
	}
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return lines, nil
}
