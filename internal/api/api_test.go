package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"

	"samba-manager/internal/auth"
	"samba-manager/internal/config"
	"samba-manager/internal/smbconf"
	"samba-manager/internal/state"
	"samba-manager/internal/system"
)

// fakeRunner records commands and answers a few of them.
type fakeRunner struct {
	mu      sync.Mutex
	calls   []string
	samba   []string // users in the fake passdb
	failOn  string   // command prefix that should fail
	stdins  map[string]string
	sambaOn bool
}

func (f *fakeRunner) Run(_ context.Context, stdin string, name string, args ...string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	line := name + " " + strings.Join(args, " ")
	f.calls = append(f.calls, line)
	if f.stdins == nil {
		f.stdins = map[string]string{}
	}
	f.stdins[line] = stdin
	if f.failOn != "" && strings.HasPrefix(line, f.failOn) {
		return "", &system.CmdError{Cmd: name, Err: fmt.Errorf("exit status 1"), Output: "simulated failure"}
	}
	switch name {
	case "pdbedit":
		if len(args) > 0 && args[0] == "-L" {
			var b strings.Builder
			for _, u := range f.samba {
				fmt.Fprintf(&b, "%s:1000:\n", u)
			}
			return b.String(), nil
		}
		if len(args) > 2 && args[0] == "-x" {
			out := f.samba[:0]
			for _, u := range f.samba {
				if u != args[2] {
					out = append(out, u)
				}
			}
			f.samba = out
		}
	case "smbpasswd":
		if args[0] == "-a" {
			f.samba = append(f.samba, args[2])
		}
	}
	return "", nil
}

func (f *fakeRunner) ran(prefix string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, c := range f.calls {
		if strings.HasPrefix(c, prefix) {
			return true
		}
	}
	return false
}

// fakeUsers edits temporary passwd/group files.
type fakeUsers struct {
	passwd, group string
	nextID        int
	home          string // base directory for home directories
}

func (u *fakeUsers) Name() string { return "fake" }
func (u *fakeUsers) append(path, line string) error {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.WriteString(line + "\n")
	return err
}
func (u *fakeUsers) AddUser(_ context.Context, name string) error {
	u.nextID++
	id := strconv.Itoa(u.nextID)
	if err := u.append(u.group, name+":x:"+id+":"); err != nil {
		return err
	}
	return u.append(u.passwd, name+":x:"+id+":"+id+"::"+filepath.Join(u.home, name)+":/usr/sbin/nologin")
}
func (u *fakeUsers) AddUserWithID(ctx context.Context, name string, uid, gid int) error {
	return u.append(u.passwd, fmt.Sprintf("%s:x:%d:%d::%s:/usr/sbin/nologin", name, uid, gid, filepath.Join(u.home, name)))
}
func (u *fakeUsers) DelUser(_ context.Context, name string) error {
	return filterLines(u.passwd, func(l string) bool { return !strings.HasPrefix(l, name+":") })
}
func (u *fakeUsers) AddGroup(_ context.Context, name string) error {
	u.nextID++
	return u.append(u.group, name+":x:"+strconv.Itoa(u.nextID)+":")
}
func (u *fakeUsers) AddGroupWithID(_ context.Context, name string, gid int) error {
	return u.append(u.group, fmt.Sprintf("%s:x:%d:", name, gid))
}
func (u *fakeUsers) DelGroup(_ context.Context, name string) error {
	return filterLines(u.group, func(l string) bool { return !strings.HasPrefix(l, name+":") })
}
func (u *fakeUsers) AddToGroup(_ context.Context, user, group string) error { return nil }
func (u *fakeUsers) RemoveFromGroup(_ context.Context, user, group string) error {
	return nil
}

func filterLines(path string, keep func(string) bool) error {
	raw, _ := os.ReadFile(path)
	var out []string
	for _, l := range strings.Split(strings.TrimSpace(string(raw)), "\n") {
		if keep(l) {
			out = append(out, l)
		}
	}
	return os.WriteFile(path, []byte(strings.Join(out, "\n")+"\n"), 0o644)
}

type fakeSvc struct {
	reloads int
	err     error
}

func (f *fakeSvc) Name() string { return "fake" }
func (f *fakeSvc) Status(context.Context) (system.ServiceStatus, error) {
	return system.ServiceStatus{Active: true, Backend: "fake"}, nil
}
func (f *fakeSvc) Reload(context.Context) error  { f.reloads++; return f.err }
func (f *fakeSvc) Restart(context.Context) error { return f.err }

type env struct {
	t     *testing.T
	srv   *Server
	h     http.Handler
	run   *fakeRunner
	svc   *fakeSvc
	root  string
	users *fakeUsers
	owner map[string]int // fake file owners (chown needs root)
}

func newEnv(t *testing.T) *env {
	t.Helper()
	dir := t.TempDir()
	root := filepath.Join(dir, "data")
	os.MkdirAll(root, 0o755)

	system.PasswdFile = filepath.Join(dir, "passwd")
	system.GroupFile = filepath.Join(dir, "group")
	os.WriteFile(system.PasswdFile, []byte("root:x:0:0::/root:/bin/bash\n"), 0o644)
	os.WriteFile(system.GroupFile, []byte("root:x:0:\nusers:x:100:\n"), 0o644)

	smb := filepath.Join(dir, "smb.conf")
	os.WriteFile(smb, []byte("[global]\n    workgroup = TEST\n"), 0o644)

	cfg := config.Default()
	cfg.Samba.ConfigPath = smb
	cfg.Samba.AllowedRoots = []string{root}
	cfg.Samba.LogDir = filepath.Join(dir, "log")

	run := &fakeRunner{}
	svc := &fakeSvc{}
	st, _ := state.Open(filepath.Join(dir, "state"))
	a, _, _ := auth.New(auth.Options{Username: "admin", Password: "test-password"})
	u := &fakeUsers{passwd: system.PasswdFile, group: system.GroupFile, nextID: 1000, home: filepath.Join(root, "home")}
	owner := map[string]int{}
	oldChown, oldOwner := lchown, fileOwner
	lchown = func(p string, uid, gid int) error { owner[p] = uid; return nil }
	fileOwner = func(p string, _ os.FileInfo) (int, bool) { return owner[p], true }
	t.Cleanup(func() { lchown, fileOwner = oldChown, oldOwner })

	s := &Server{
		Cfg: cfg, Store: &smbconf.Store{Path: smb, BackupDir: filepath.Join(dir, "backups")},
		Svc: svc, Users: u, State: st, Auth: a, Run: run, Version: "test",
	}
	return &env{t: t, srv: s, h: s.Handler(), run: run, svc: svc, root: root, users: u, owner: owner}
}

func (e *env) do(method, path string, body any) (int, map[string]any) {
	e.t.Helper()
	var rdr *bytes.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		rdr = bytes.NewReader(raw)
	} else {
		rdr = bytes.NewReader(nil)
	}
	r := httptest.NewRequest(method, path, rdr)
	w := httptest.NewRecorder()
	e.h.ServeHTTP(w, r)
	var out map[string]any
	json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func (e *env) conf() string {
	raw, _ := os.ReadFile(e.srv.Cfg.Samba.ConfigPath)
	return string(raw)
}

func TestCreateShareSambaMode(t *testing.T) {
	e := newEnv(t)
	e.run.samba = []string{"alice"}
	path := filepath.Join(e.root, "docs")

	code, body := e.do("POST", "/shares/docs", map[string]any{
		"path": path, "valid users": "alice", "write list": "alice", "browseable": "yes", "_access": "samba",
	})
	if code != 200 {
		t.Fatalf("code %d: %v", code, body)
	}
	if fi, err := os.Stat(path); err != nil || !fi.IsDir() {
		t.Fatal("directory not created")
	}
	conf := e.conf()
	for _, want := range []string{"[docs]", "path = " + path, "valid users = alice", "create mask = 0664", "# samba-manager:access = samba"} {
		if !strings.Contains(conf, want) {
			t.Errorf("config lacks %q:\n%s", want, conf)
		}
	}
	if e.svc.reloads != 1 {
		t.Errorf("reloads = %d, want 1", e.svc.reloads)
	}
	if e.run.ran("setfacl") {
		t.Error("samba-only mode must not run setfacl")
	}
	if w, _ := body["warning"].(string); !strings.Contains(w, "Force User") {
		t.Errorf("expected a force-user warning, got %q", w)
	}

	// listing exposes meta, hides reserved sections
	code, list := e.do("GET", "/shares", nil)
	if code != 200 || list["docs"] == nil || list["global"] != nil {
		t.Fatalf("list: %v", list)
	}
	if list["docs"].(map[string]any)["_access"] != "samba" {
		t.Errorf("meta missing: %v", list["docs"])
	}
}

func TestShareValidation(t *testing.T) {
	e := newEnv(t)
	cases := []struct {
		name, path string
		body       map[string]any
		want       int
	}{
		{"outside root", "/shares/x", map[string]any{"path": "/etc"}, 400},
		{"root fs", "/shares/x", map[string]any{"path": "/"}, 400},
		{"relative", "/shares/x", map[string]any{"path": "foo"}, 400},
		{"missing path", "/shares/x", map[string]any{"comment": "hi"}, 400},
		{"reserved name", "/shares/global", map[string]any{"path": filepath.Join(e.root, "g")}, 403},
		{"homes", "/shares/homes", map[string]any{"path": filepath.Join(e.root, "g")}, 400},
		{"bad mode", "/shares/x", map[string]any{"path": filepath.Join(e.root, "x"), "_permissions": "99"}, 400},
		{"newline injection", "/shares/x", map[string]any{"path": filepath.Join(e.root, "x"), "comment": "a\n[global]\nsecurity = share"}, 400},
		{"unknown user", "/shares/x", map[string]any{"path": filepath.Join(e.root, "x"), "valid users": "ghost"}, 400},
		{"unknown group", "/shares/x", map[string]any{"path": filepath.Join(e.root, "x"), "valid users": "@ghosts"}, 400},
		{"bad access", "/shares/x", map[string]any{"path": filepath.Join(e.root, "x"), "_access": "magic"}, 400},
		{"setuid", "/shares/x", map[string]any{"path": filepath.Join(e.root, "x"), "_permissions": "4755"}, 400},
	}
	for _, c := range cases {
		if code, body := e.do("POST", c.path, c.body); code != c.want {
			t.Errorf("%s: code %d (%v), want %d", c.name, code, body, c.want)
		}
	}
	if strings.Contains(e.conf(), "[x]") || strings.Contains(e.conf(), "security = share") {
		t.Errorf("rejected requests changed the config:\n%s", e.conf())
	}
	entries, _ := os.ReadDir(e.root)
	if len(entries) != 0 {
		t.Errorf("rejected requests created directories: %v", entries)
	}
}

func TestEditKeepsUnknownParametersAndRemovesFormKeys(t *testing.T) {
	e := newEnv(t)
	path := filepath.Join(e.root, "tm")
	os.WriteFile(e.srv.Cfg.Samba.ConfigPath, []byte("[global]\n    workgroup = TEST\n\n[tm]\n    path = "+path+"\n    comment = old\n    vfs objects = catia fruit streams_xattr\n    fruit:time machine = yes\n"), 0o644)

	code, body := e.do("POST", "/shares/tm", map[string]any{"path": path, "comment": "", "browseable": "no"})
	if code != 200 {
		t.Fatalf("%d %v", code, body)
	}
	conf := e.conf()
	if !strings.Contains(conf, "fruit:time machine = yes") || !strings.Contains(conf, "vfs objects = catia fruit streams_xattr") {
		t.Errorf("unknown parameters were dropped:\n%s", conf)
	}
	if strings.Contains(conf, "comment") {
		t.Errorf("emptied form key must be removed:\n%s", conf)
	}
	if !strings.Contains(conf, "browseable = no") {
		t.Errorf("browseable missing:\n%s", conf)
	}
}

func TestDeleteShareRemovesSectionCompletely(t *testing.T) {
	e := newEnv(t)
	path := filepath.Join(e.root, "gone")
	e.do("POST", "/shares/gone", map[string]any{"path": path})
	if code, _ := e.do("DELETE", "/shares/gone", nil); code != 200 {
		t.Fatal("delete failed")
	}
	if strings.Contains(e.conf(), "gone") {
		t.Errorf("section left behind:\n%s", e.conf())
	}
	if _, err := os.Stat(path); err != nil {
		t.Error("deleting a share must not delete its files")
	}
	if code, _ := e.do("DELETE", "/shares/gone", nil); code != 404 {
		t.Errorf("second delete = %d, want 404", code)
	}
	if code, _ := e.do("DELETE", "/shares/global", nil); code != 403 {
		t.Errorf("deleting global via shares = %d, want 403", code)
	}
}

func TestACLModeRunsSetfaclIncrementally(t *testing.T) {
	if !system.HaveCommand("setfacl") {
		t.Skip("setfacl not installed")
	}
	e := newEnv(t)
	e.run.samba = []string{"alice", "bob"}
	// the users must exist for ACL entries
	e.users.AddUser(context.Background(), "alice")
	e.users.AddUser(context.Background(), "bob")
	path := filepath.Join(e.root, "acl")

	code, body := e.do("POST", "/shares/acl", map[string]any{"path": path, "_access": "acl", "valid users": "alice, bob", "write list": "alice"})
	if code != 200 {
		t.Fatalf("%d %v", code, body)
	}
	var setfacl []string
	for _, c := range e.run.calls {
		if strings.HasPrefix(c, "setfacl") {
			setfacl = append(setfacl, c)
		}
	}
	if len(setfacl) != 1 || !strings.Contains(setfacl[0], "u:alice:rwX,d:u:alice:rwX,u:bob:rX,d:u:bob:rX") {
		t.Fatalf("unexpected setfacl calls: %v", setfacl)
	}
	if strings.Contains(setfacl[0], "-b") || strings.Contains(setfacl[0], "-R") {
		t.Errorf("must neither reset nor recurse by default: %s", setfacl[0])
	}
	if !strings.Contains(e.conf(), "inherit acls = yes") {
		t.Error("inherit acls missing")
	}

	// remove bob, recurse once
	e.run.calls = nil
	code, body = e.do("POST", "/shares/acl", map[string]any{"path": path, "_access": "acl", "valid users": "alice", "write list": "alice", "_recursive": true})
	if code != 200 {
		t.Fatalf("%d %v", code, body)
	}
	joined := strings.Join(e.run.calls, "\n")
	if !strings.Contains(joined, "setfacl -R -x u:bob,d:u:bob") {
		t.Errorf("stale entry for bob not removed:\n%s", joined)
	}
	if !strings.Contains(joined, "setfacl -R -m u:alice:rwX") {
		t.Errorf("recursive apply missing:\n%s", joined)
	}
}

func TestConfigFailureRollsBackNewDirectory(t *testing.T) {
	e := newEnv(t)
	e.srv.Store.Path = filepath.Join(e.root, "..", "missing", "smb.conf") // Read fails first
	path := filepath.Join(e.root, "orphan")
	code, _ := e.do("POST", "/shares/orphan", map[string]any{"path": path})
	if code == 200 {
		t.Fatal("expected failure")
	}
	if _, err := os.Stat(path); err == nil {
		t.Error("directory must not be created when the config cannot be saved")
	}
}

func TestReloadFailureIsAWarningNotAnError(t *testing.T) {
	e := newEnv(t)
	e.svc.err = fmt.Errorf("smbd is not running")
	code, body := e.do("POST", "/config/sections/global", map[string]any{"global": map[string]string{"workgroup": "NEW"}})
	if code != 200 {
		t.Fatalf("code %d: %v", code, body)
	}
	if w, _ := body["warning"].(string); !strings.Contains(w, "not running") {
		t.Errorf("warning missing: %v", body)
	}
	if !strings.Contains(e.conf(), "workgroup = NEW") {
		t.Error("config must be saved even if reload fails")
	}
}

func TestConfigSectionAPI(t *testing.T) {
	e := newEnv(t)
	if code, _ := e.do("DELETE", "/config/sections/global", nil); code != 403 {
		t.Errorf("deleting [global] = %d, want 403", code)
	}
	if code, _ := e.do("POST", "/config/sections/x", map[string]any{"x": map[string]string{"a\nb": "c"}}); code != 400 {
		t.Errorf("newline key = %d, want 400", code)
	}
	if code, _ := e.do("POST", "/config/sections/s", map[string]any{"s": map[string]string{"path": "/tmp"}}); code != 200 {
		t.Error("section update failed")
	}
	if code, _ := e.do("POST", "/config/raw", map[string]any{"content": ""}); code != 400 {
		t.Errorf("empty raw config = %d, want 400", code)
	}
	code, body := e.do("GET", "/config/backups", nil)
	if code != 200 || len(body["backups"].([]any)) != 1 {
		t.Errorf("expected one backup after one write: %v", body)
	}
}

func TestCreateAndDeleteUser(t *testing.T) {
	e := newEnv(t)
	code, body := e.do("POST", "/users/alice", map[string]string{"password": "correct horse"})
	if code != 200 {
		t.Fatalf("%d %v", code, body)
	}
	if !e.run.ran("smbpasswd -a -s alice") {
		t.Errorf("smbpasswd not called: %v", e.run.calls)
	}
	if in := e.run.stdins["smbpasswd -a -s alice"]; in != "correct horse\ncorrect horse\n" {
		t.Errorf("password not fed through stdin correctly: %q", in)
	}
	if _, err := system.LookupUser("alice"); err != nil {
		t.Error("system account not created")
	}
	if !e.srv.State.IsUserCreated("alice") {
		t.Error("state not recorded")
	}
	if code, _ := e.do("POST", "/users/alice", map[string]string{"password": "correct horse"}); code != 409 {
		t.Errorf("duplicate = %d, want 409", code)
	}

	// listing
	code, list := e.do("GET", "/users", nil)
	if code != 200 || len(list["users"].([]any)) != 1 {
		t.Errorf("users: %v", list)
	}

	code, body = e.do("DELETE", "/users/alice", nil)
	if code != 200 {
		t.Fatalf("%d %v", code, body)
	}
	if _, err := system.LookupUser("alice"); err == nil {
		t.Error("created account must be removed with the user")
	}
	if code, _ := e.do("DELETE", "/users/alice", nil); code != 404 {
		t.Errorf("delete missing = %d, want 404", code)
	}
}

func TestCreateUserValidationAndRollback(t *testing.T) {
	e := newEnv(t)
	for name, pw := range map[string]string{"Bad-Name": "longenough1", "-rf": "longenough1", "good": "short"} {
		if code, _ := e.do("POST", "/users/"+name, map[string]string{"password": pw}); code != 400 {
			t.Errorf("user %q pw %q = %d, want 400", name, pw, code)
		}
	}
	if len(e.run.calls) != 0 {
		t.Errorf("validation must happen before any command: %v", e.run.calls)
	}

	e.run.failOn = "smbpasswd"
	if code, _ := e.do("POST", "/users/carol", map[string]string{"password": "longenough1"}); code != 500 {
		t.Fatalf("want 500 when smbpasswd fails")
	}
	if _, err := system.LookupUser("carol"); err == nil {
		t.Error("system account must be rolled back when the Samba step fails")
	}
}

func TestRefuseSystemAccounts(t *testing.T) {
	e := newEnv(t)
	if code, _ := e.do("POST", "/users/root", map[string]string{"password": "longenough1"}); code != 403 {
		t.Errorf("root as samba user = %d, want 403", code)
	}
}

func TestGroups(t *testing.T) {
	e := newEnv(t)
	if code, _ := e.do("POST", "/groups/team", nil); code != 200 {
		t.Fatal("create group failed")
	}
	if code, _ := e.do("POST", "/groups/team", nil); code != 409 {
		t.Error("duplicate group must be 409")
	}
	if code, _ := e.do("POST", "/groups/bad%20name", nil); code != 400 {
		t.Error("invalid group name must be 400")
	}
	code, body := e.do("GET", "/groups", nil)
	if code != 200 {
		t.Fatal(code)
	}
	groups := body["groups"].([]any)
	if len(groups) != 1 || groups[0].(map[string]any)["name"] != "team" {
		t.Errorf("only the user-created group should be listed by default: %v", groups)
	}
	if code, _ := e.do("DELETE", "/groups/users", nil); code != 403 {
		t.Error("system group delete must be 403")
	}
	if code, _ := e.do("DELETE", "/groups/team", nil); code != 200 {
		t.Error("delete group failed")
	}
	if code, _ := e.do("DELETE", "/groups/team", nil); code != 404 {
		t.Error("delete missing group must be 404")
	}
}

func TestStatusAndInfo(t *testing.T) {
	e := newEnv(t)
	code, body := e.do("GET", "/status", nil)
	if code != 200 || body["status"] != "running" || body["active"] != true {
		t.Errorf("status: %v", body)
	}
	code, body = e.do("GET", "/info", nil)
	if code != 200 || body["version"] != "test" || body["allowedRoots"] == nil {
		t.Errorf("info: %v", body)
	}
}

func TestChangeAdminPasswordEndpoint(t *testing.T) {
	e := newEnv(t)
	if code, _ := e.do("POST", "/auth/password", map[string]string{"current": "nope", "new": "new-password-1"}); code != 403 {
		t.Errorf("wrong current = %d, want 403", code)
	}
	if code, _ := e.do("POST", "/auth/password", map[string]string{"current": "test-password", "new": "x"}); code != 400 {
		t.Errorf("weak new = %d, want 400", code)
	}
	if code, _ := e.do("POST", "/auth/password", map[string]string{"current": "test-password", "new": "new-password-1"}); code != 200 {
		t.Error("valid change failed")
	}
}

func TestParseGetfacl(t *testing.T) {
	out := "# file: srv/x\n# owner: root\n# group: staff\nuser::rwx\nuser:alice:rwx\ngroup::r-x\ngroup:team:r-x\t#effective:r--\nmask::rwx\nother::r-x\ndefault:user:alice:rwx\n"
	acl := parseGetfacl("/srv/x", out)
	if acl.Owner != "root" || acl.Group != "staff" || len(acl.Entries) != 3 {
		t.Fatalf("%+v", acl)
	}
	if acl.Entries[1].User != "team" || acl.Entries[1].Permission != "r-x" || !acl.Entries[2].Default {
		t.Errorf("%+v", acl.Entries)
	}
}

func TestTailFile(t *testing.T) {
	p := filepath.Join(t.TempDir(), "log.smbd")
	var b strings.Builder
	for i := 0; i < 1000; i++ {
		fmt.Fprintf(&b, "line %d\n", i)
	}
	os.WriteFile(p, []byte(b.String()), 0o644)
	lines, err := tailFile(p, 3)
	if err != nil || len(lines) != 3 || lines[2] != "line 999" {
		t.Errorf("%v %v", lines, err)
	}
}

func TestLogsRejectTraversal(t *testing.T) {
	e := newEnv(t)
	os.MkdirAll(e.srv.Cfg.Samba.LogDir, 0o755)
	os.WriteFile(filepath.Join(e.srv.Cfg.Samba.LogDir, "log.smbd"), []byte("hello\n"), 0o644)
	if code, body := e.do("GET", "/logs", nil); code != 200 || body["file"] != "log.smbd" {
		t.Errorf("%d %v", code, body)
	}
	if code, _ := e.do("GET", "/logs?file=../../etc/passwd", nil); code == 200 {
		t.Error("path traversal accepted")
	}
}

func TestHumanSize(t *testing.T) {
	cases := map[uint64]string{0: "0B", 512: "512B", 1024: "1.0K", 1536: "1.5K", 10 * 1024 * 1024: "10M", 5 * 1024 * 1024 * 1024: "5.0G"}
	for in, want := range cases {
		if got := humanSize(in); got != want {
			t.Errorf("humanSize(%d) = %s, want %s", in, got, want)
		}
	}
}

func (e *env) createUser(name string, extra map[string]any) (int, map[string]any) {
	body := map[string]any{"password": "correct horse"}
	for k, v := range extra {
		body[k] = v
	}
	return e.do("POST", "/users/"+name, body)
}

func (e *env) homeOf(name string) string { return filepath.Join(e.root, "home", name) }

func TestCreateUserAlwaysCreatesHome(t *testing.T) {
	e := newEnv(t)
	if code, body := e.createUser("alice", nil); code != 200 {
		t.Fatalf("%d %v", code, body)
	}
	fi, err := os.Stat(e.homeOf("alice"))
	if err != nil || !fi.IsDir() || fi.Mode().Perm() != 0o700 {
		t.Fatalf("home not created with 0700: %v %v", fi, err)
	}
	if got := e.owner[e.homeOf("alice")]; got != 1001 {
		t.Errorf("home owner = %d, want the new user's uid", got)
	}
}

func TestLeftoverHomeNeedsAChoice(t *testing.T) {
	e := newEnv(t)
	home := e.homeOf("alice")
	os.MkdirAll(home, 0o700)
	os.WriteFile(filepath.Join(home, "old.txt"), []byte("data"), 0o600)
	e.owner[home] = 4242

	code, body := e.createUser("alice", nil)
	if code != 409 || body["code"] != "home_conflict" {
		t.Fatalf("want 409 home_conflict, got %d %v", code, body)
	}
	data := body["data"].(map[string]any)
	if data["path"] != home || data["ownerUid"] != float64(4242) || data["entries"] != float64(1) {
		t.Errorf("conflict details: %v", data)
	}
	// the refusal must leave nothing behind
	if _, err := system.LookupUser("alice"); err == nil {
		t.Error("system user must be rolled back")
	}
	if !e.run.ran("pdbedit -x -u alice") {
		t.Error("samba user must be rolled back")
	}
	if _, err := os.Stat(filepath.Join(home, "old.txt")); err != nil {
		t.Error("the old files must not be touched")
	}

	// adopt keeps the files and hands them over
	e.run.calls = nil
	code, body = e.createUser("alice", map[string]any{"existingHome": "adopt"})
	if code != 200 {
		t.Fatalf("adopt: %d %v", code, body)
	}
	if _, err := os.Stat(filepath.Join(home, "old.txt")); err != nil {
		t.Error("adopt must keep the files")
	}
	acct, _ := system.LookupUser("alice")
	if e.owner[home] != acct.UID || e.owner[filepath.Join(home, "old.txt")] != acct.UID {
		t.Errorf("adopt must chown everything: %v", e.owner)
	}
}

func TestWipeReplacesTheOldHome(t *testing.T) {
	e := newEnv(t)
	home := e.homeOf("alice")
	os.MkdirAll(home, 0o700)
	os.WriteFile(filepath.Join(home, "old.txt"), []byte("data"), 0o600)
	e.owner[home] = 4242

	if code, body := e.createUser("alice", map[string]any{"existingHome": "wipe"}); code != 200 {
		t.Fatalf("%d %v", code, body)
	}
	if _, err := os.Stat(filepath.Join(home, "old.txt")); !os.IsNotExist(err) {
		t.Error("wipe must delete the old files")
	}
	if fi, err := os.Stat(home); err != nil || !fi.IsDir() {
		t.Error("wipe must leave an empty home")
	}
}

func TestHomeRefusals(t *testing.T) {
	e := newEnv(t)
	// symlink instead of a directory
	target := t.TempDir()
	os.MkdirAll(filepath.Dir(e.homeOf("eve")), 0o755)
	os.Symlink(target, e.homeOf("eve"))
	if code, _ := e.createUser("eve", map[string]any{"existingHome": "wipe"}); code != 400 {
		t.Errorf("symlinked home = %d, want 400", code)
	}
	if _, err := os.Stat(target); err != nil {
		t.Error("the symlink target must survive")
	}
	// home that a share uses
	e.users.AddUser(context.Background(), "tmp")
	home := e.homeOf("bob")
	os.MkdirAll(home, 0o700)
	e.owner[home] = 4242
	e.do("POST", "/shares/bobshare", map[string]any{"path": home, "_access": "samba"})
	if code, _ := e.createUser("bob", map[string]any{"existingHome": "wipe"}); code != 400 {
		t.Errorf("wipe of a share directory = %d, want 400", code)
	}
	// bad mode
	if code, _ := e.createUser("zed", map[string]any{"existingHome": "nuke"}); code != 400 {
		t.Errorf("bad existingHome = %d, want 400", code)
	}
}

func TestDeleteUserKeepsOrRemovesHome(t *testing.T) {
	e := newEnv(t)
	e.createUser("alice", nil)
	e.createUser("bob", nil)

	code, body := e.do("DELETE", "/users/alice", nil)
	if code != 200 || !strings.Contains(body["warning"].(string), "was kept") {
		t.Fatalf("delete should say the home was kept: %d %v", code, body)
	}
	if _, err := os.Stat(e.homeOf("alice")); err != nil {
		t.Error("home must be kept by default")
	}

	code, body = e.do("DELETE", "/users/bob?deleteHome=true", nil)
	if code != 200 {
		t.Fatalf("%d %v", code, body)
	}
	if _, err := os.Stat(e.homeOf("bob")); !os.IsNotExist(err) {
		t.Error("deleteHome must remove the home")
	}
}

func TestDeleteHomeOnlyForManagedAccounts(t *testing.T) {
	e := newEnv(t)
	e.users.AddUser(context.Background(), "carol") // exists on the host, not created by the manager
	home := e.homeOf("carol")
	os.MkdirAll(home, 0o700)
	acct, _ := system.LookupUser("carol")
	e.owner[home] = acct.UID
	e.srv.State.RecordUser(state.UserRec{Name: "carol", UID: acct.UID, GID: acct.GID})
	e.run.samba = append(e.run.samba, "carol")

	if code, _ := e.do("DELETE", "/users/carol?deleteHome=true", nil); code != 200 {
		t.Fatal("delete should succeed")
	}
	if _, err := os.Stat(home); err != nil {
		t.Error("the home of an account the manager did not create must be kept")
	}
}

func TestRecreatedUserGetsItsIDsBack(t *testing.T) {
	e := newEnv(t)
	e.createUser("alice", nil)
	old, _ := system.LookupUser("alice")
	e.do("DELETE", "/users/alice", nil)
	// someone else is created in between and would take the next free id
	e.createUser("bob", nil)

	code, body := e.createUser("alice", nil)
	if code != 200 {
		t.Fatalf("%d %v", code, body)
	}
	again, err := system.LookupUser("alice")
	if err != nil || again.UID != old.UID || again.GID != old.GID {
		t.Fatalf("ids not restored: %+v vs %+v (%v)", again, old, err)
	}
	if !strings.Contains(body["warning"].(string), "Restored UID") {
		t.Errorf("expected the restore notice: %v", body)
	}
	// the old home is owned by the same uid, so it is simply reused
	if !strings.Contains(body["warning"].(string), "already owned") {
		t.Errorf("expected the reuse notice: %v", body)
	}
}
