package system

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
)

// Paths of the account databases; variables so tests can point elsewhere.
var (
	PasswdFile = "/etc/passwd"
	GroupFile  = "/etc/group"
)

// UserBackend creates and removes the Unix accounts behind Samba users.
// Accounts have no login shell and no home directory.
type UserBackend interface {
	Name() string
	AddUser(ctx context.Context, name string) error
	AddUserWithID(ctx context.Context, name string, uid, gid int) error
	DelUser(ctx context.Context, name string) error
	AddGroup(ctx context.Context, name string) error
	AddGroupWithID(ctx context.Context, name string, gid int) error
	DelGroup(ctx context.Context, name string) error
	AddToGroup(ctx context.Context, user, group string) error
	RemoveFromGroup(ctx context.Context, user, group string) error
}

// DetectUserBackend picks the shadow-utils or BusyBox implementation.
func DetectUserBackend(r Runner) UserBackend {
	if HaveCommand("useradd") {
		return &shadowBackend{r: r, shell: nologinShell()}
	}
	return &busyboxBackend{r: r, shell: nologinShell()}
}

func nologinShell() string {
	for _, p := range []string{"/usr/sbin/nologin", "/sbin/nologin", "/bin/false"} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "/bin/false"
}

type shadowBackend struct {
	r     Runner
	shell string
}

func (b *shadowBackend) Name() string { return "shadow-utils" }

func (b *shadowBackend) run(ctx context.Context, name string, args ...string) error {
	_, err := b.r.Run(ctx, "", name, args...)
	return err
}

func (b *shadowBackend) AddUser(ctx context.Context, name string) error {
	return b.run(ctx, "useradd", "--no-create-home", "--shell", b.shell, "--user-group", "--", name)
}

func (b *shadowBackend) AddUserWithID(ctx context.Context, name string, uid, gid int) error {
	return b.run(ctx, "useradd", "--no-create-home", "--shell", b.shell,
		"--uid", strconv.Itoa(uid), "--gid", strconv.Itoa(gid), "--", name)
}

func (b *shadowBackend) DelUser(ctx context.Context, name string) error {
	return b.run(ctx, "userdel", "--", name)
}

func (b *shadowBackend) AddGroup(ctx context.Context, name string) error {
	return b.run(ctx, "groupadd", "--", name)
}

func (b *shadowBackend) AddGroupWithID(ctx context.Context, name string, gid int) error {
	return b.run(ctx, "groupadd", "--gid", strconv.Itoa(gid), "--", name)
}

func (b *shadowBackend) DelGroup(ctx context.Context, name string) error {
	return b.run(ctx, "groupdel", "--", name)
}

func (b *shadowBackend) AddToGroup(ctx context.Context, user, group string) error {
	return b.run(ctx, "gpasswd", "--add", user, group)
}

func (b *shadowBackend) RemoveFromGroup(ctx context.Context, user, group string) error {
	return b.run(ctx, "gpasswd", "--delete", user, group)
}

// busyboxBackend covers Alpine and other BusyBox based systems.
type busyboxBackend struct {
	r     Runner
	shell string
}

func (b *busyboxBackend) Name() string { return "busybox" }

func (b *busyboxBackend) run(ctx context.Context, name string, args ...string) error {
	_, err := b.r.Run(ctx, "", name, args...)
	return err
}

func (b *busyboxBackend) AddUser(ctx context.Context, name string) error {
	return b.run(ctx, "adduser", "-D", "-H", "-s", b.shell, name)
}

func (b *busyboxBackend) AddUserWithID(ctx context.Context, name string, uid, gid int) error {
	grp := strconv.Itoa(gid)
	if g, err := LookupGroupByGID(gid); err == nil {
		grp = g.Name
	}
	return b.run(ctx, "adduser", "-D", "-H", "-s", b.shell, "-u", strconv.Itoa(uid), "-G", grp, name)
}

func (b *busyboxBackend) DelUser(ctx context.Context, name string) error {
	return b.run(ctx, "deluser", name)
}

func (b *busyboxBackend) AddGroup(ctx context.Context, name string) error {
	return b.run(ctx, "addgroup", name)
}

func (b *busyboxBackend) AddGroupWithID(ctx context.Context, name string, gid int) error {
	return b.run(ctx, "addgroup", "-g", strconv.Itoa(gid), name)
}

func (b *busyboxBackend) DelGroup(ctx context.Context, name string) error {
	return b.run(ctx, "delgroup", name)
}

func (b *busyboxBackend) AddToGroup(ctx context.Context, user, group string) error {
	return b.run(ctx, "addgroup", user, group)
}

func (b *busyboxBackend) RemoveFromGroup(ctx context.Context, user, group string) error {
	return b.run(ctx, "delgroup", user, group)
}

// ---- reading the account databases (no external commands needed) ----

// PasswdEntry is a line of /etc/passwd.
type PasswdEntry struct {
	Name  string
	UID   int
	GID   int
	Home  string
	Shell string
}

// GroupEntry is a line of /etc/group, plus members whose primary group it is.
type GroupEntry struct {
	Name    string
	GID     int
	Members []string
	// Private is true for a user's own primary group with no other members
	// (the "alice" group created next to user "alice").
	Private bool
}

// ReadPasswd parses the passwd file.
func ReadPasswd() ([]PasswdEntry, error) {
	f, err := os.Open(PasswdFile)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var out []PasswdEntry
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		p := strings.Split(sc.Text(), ":")
		if len(p) < 7 || strings.HasPrefix(p[0], "#") {
			continue
		}
		uid, err1 := strconv.Atoi(p[2])
		gid, err2 := strconv.Atoi(p[3])
		if err1 != nil || err2 != nil {
			continue
		}
		out = append(out, PasswdEntry{Name: p[0], UID: uid, GID: gid, Home: p[5], Shell: p[6]})
	}
	return out, sc.Err()
}

// LookupUser finds a user by name.
func LookupUser(name string) (*PasswdEntry, error) {
	entries, err := ReadPasswd()
	if err != nil {
		return nil, err
	}
	for i := range entries {
		if entries[i].Name == name {
			return &entries[i], nil
		}
	}
	return nil, fmt.Errorf("user %q does not exist", name)
}

// ReadGroups parses the group file and adds primary-group members.
func ReadGroups() ([]GroupEntry, error) {
	f, err := os.Open(GroupFile)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	users, _ := ReadPasswd()
	primary := map[int][]string{}
	for _, u := range users {
		primary[u.GID] = append(primary[u.GID], u.Name)
	}

	var out []GroupEntry
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		p := strings.Split(sc.Text(), ":")
		if len(p) < 4 || strings.HasPrefix(p[0], "#") {
			continue
		}
		gid, err := strconv.Atoi(p[2])
		if err != nil {
			continue
		}
		seen := map[string]bool{}
		members := []string{}
		for _, m := range strings.Split(p[3], ",") {
			if m = strings.TrimSpace(m); m != "" && !seen[m] {
				seen[m] = true
				members = append(members, m)
			}
		}
		explicit := len(members)
		for _, m := range primary[gid] {
			if !seen[m] {
				seen[m] = true
				members = append(members, m)
			}
		}
		sort.Strings(members)
		private := explicit == 0 && len(primary[gid]) == 1 && primary[gid][0] == p[0]
		out = append(out, GroupEntry{Name: p[0], GID: gid, Members: members, Private: private})
	}
	return out, sc.Err()
}

// LookupGroup finds a group by name.
func LookupGroup(name string) (*GroupEntry, error) {
	groups, err := ReadGroups()
	if err != nil {
		return nil, err
	}
	for i := range groups {
		if groups[i].Name == name {
			return &groups[i], nil
		}
	}
	return nil, fmt.Errorf("group %q does not exist", name)
}

// LookupGroupByGID finds a group by numeric id.
func LookupGroupByGID(gid int) (*GroupEntry, error) {
	groups, err := ReadGroups()
	if err != nil {
		return nil, err
	}
	for i := range groups {
		if groups[i].GID == gid {
			return &groups[i], nil
		}
	}
	return nil, fmt.Errorf("group %d does not exist", gid)
}

// IsSystemGID reports whether a gid belongs to the system range.
func IsSystemGID(gid int) bool { return gid < 1000 || gid == 65534 }
