package state

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"samba-manager/internal/system"
)

type recorder struct {
	system.UserBackend
	calls []string
}

func (r *recorder) AddGroupWithID(_ context.Context, name string, gid int) error {
	r.calls = append(r.calls, fmt.Sprintf("group %s %d", name, gid))
	return nil
}
func (r *recorder) AddUserWithID(_ context.Context, name string, uid, gid int) error {
	r.calls = append(r.calls, fmt.Sprintf("user %s %d %d", name, uid, gid))
	return nil
}
func (r *recorder) AddToGroup(_ context.Context, user, group string) error {
	r.calls = append(r.calls, fmt.Sprintf("member %s %s", user, group))
	return nil
}

func TestPersistAndRestore(t *testing.T) {
	dir := t.TempDir()
	system.PasswdFile = filepath.Join(dir, "passwd")
	system.GroupFile = filepath.Join(dir, "group")
	os.WriteFile(system.PasswdFile, []byte("root:x:0:0::/root:/bin/sh\n"), 0o644)
	os.WriteFile(system.GroupFile, []byte("root:x:0:\n"), 0o644)

	s, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	s.RecordGroup("team", 2000)
	s.RecordUser(UserRec{Name: "alice", UID: 1001, GID: 1001, Group: "alice", Created: true})
	// membership of a group that is not on this system is not recorded
	s.SetMember("team", "alice", true)

	reopened, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !reopened.IsUserCreated("alice") {
		t.Error("user lost after reopen")
	}

	// a rebuilt container has an empty passwd/group: everything is recreated
	rec := &recorder{}
	n := reopened.Restore(context.Background(), rec)
	got := strings.Join(rec.calls, "|")
	if n != 2 || !strings.Contains(got, "group team 2000") || !strings.Contains(got, "group alice 1001") || !strings.Contains(got, "user alice 1001 1001") {
		t.Errorf("n=%d calls=%v", n, rec.calls)
	}

	// idempotent: existing accounts are left alone
	os.WriteFile(system.PasswdFile, []byte("root:x:0:0::/root:/bin/sh\nalice:x:1001:1001::/home/alice:/bin/false\n"), 0o644)
	os.WriteFile(system.GroupFile, []byte("root:x:0:\nteam:x:2000:\nalice:x:1001:\n"), 0o644)
	rec = &recorder{}
	if n := reopened.Restore(context.Background(), rec); n != 0 {
		t.Errorf("restore recreated existing accounts: %v", rec.calls)
	}
}

func TestForgetUserRemovesMemberships(t *testing.T) {
	dir := t.TempDir()
	system.PasswdFile = filepath.Join(dir, "passwd")
	system.GroupFile = filepath.Join(dir, "group")
	os.WriteFile(system.PasswdFile, []byte("bob:x:1002:1002::/h:/bin/false\n"), 0o644)
	os.WriteFile(system.GroupFile, []byte("team:x:2000:bob\n"), 0o644)
	s, _ := Open(dir)
	s.RecordUser(UserRec{Name: "bob", UID: 1002, GID: 1002, Created: true})
	s.SetMember("team", "bob", true)
	s.ForgetUser("bob")
	raw, _ := os.ReadFile(filepath.Join(dir, "state.json"))
	if strings.Contains(string(raw), "bob") {
		t.Errorf("bob still referenced: %s", raw)
	}
}
