// Package state remembers the Unix users and groups created through the
// manager so they can be recreated with the same ids (for example when a
// container is rebuilt and /etc/passwd starts out empty).
package state

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sort"
	"sync"

	"samba-manager/internal/system"
)

// UserRec is a managed user.
type UserRec struct {
	Name  string `json:"name"`
	UID   int    `json:"uid"`
	GID   int    `json:"gid"`
	Group string `json:"group"` // primary group name
	// Created is true when the manager created the Unix account itself, so
	// removing the Samba user may remove the account again. Accounts that
	// already existed on the host are never deleted.
	Created bool `json:"created"`
}

// GroupRec is a managed group.
type GroupRec struct {
	Name    string   `json:"name"`
	GID     int      `json:"gid"`
	Members []string `json:"members,omitempty"`
}

type data struct {
	Users  []UserRec  `json:"users"`
	Groups []GroupRec `json:"groups"`
}

// State is persisted as JSON in the state directory.
type State struct {
	path string
	mu   sync.Mutex
	d    data
}

// Open loads (or creates) the state file in dir.
func Open(dir string) (*State, error) {
	s := &State{path: filepath.Join(dir, "state.json")}
	raw, err := os.ReadFile(s.path)
	if err == nil {
		if err := json.Unmarshal(raw, &s.d); err != nil {
			return nil, err
		}
	} else if !os.IsNotExist(err) {
		return nil, err
	}
	return s, nil
}

func (s *State) save() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(s.d, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

// IsUserCreated reports whether the manager created this user's Unix account.
func (s *State) IsUserCreated(name string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, u := range s.d.Users {
		if u.Name == name {
			return u.Created
		}
	}
	return false
}

// RecordUser stores a user (replacing any previous record).
func (s *State) RecordUser(u UserRec) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.removeUser(u.Name)
	s.d.Users = append(s.d.Users, u)
	return s.save()
}

func (s *State) removeUser(name string) {
	out := s.d.Users[:0]
	for _, u := range s.d.Users {
		if u.Name != name {
			out = append(out, u)
		}
	}
	s.d.Users = out
	for i := range s.d.Groups {
		s.d.Groups[i].Members = without(s.d.Groups[i].Members, name)
	}
}

// ForgetUser drops a user and its group memberships.
func (s *State) ForgetUser(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.removeUser(name)
	return s.save()
}

// RecordGroup stores a group.
func (s *State) RecordGroup(name string, gid int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.d.Groups {
		if s.d.Groups[i].Name == name {
			s.d.Groups[i].GID = gid
			return s.save()
		}
	}
	s.d.Groups = append(s.d.Groups, GroupRec{Name: name, GID: gid})
	return s.save()
}

// ForgetGroup drops a group.
func (s *State) ForgetGroup(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := s.d.Groups[:0]
	for _, g := range s.d.Groups {
		if g.Name != name {
			out = append(out, g)
		}
	}
	s.d.Groups = out
	return s.save()
}

// SetMember adds or removes a membership; unmanaged groups are tracked too so
// memberships survive a rebuild.
func (s *State) SetMember(group, user string, member bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := -1
	for i := range s.d.Groups {
		if s.d.Groups[i].Name == group {
			idx = i
		}
	}
	if idx < 0 {
		if !member {
			return nil
		}
		if g, err := system.LookupGroup(group); err == nil {
			s.d.Groups = append(s.d.Groups, GroupRec{Name: group, GID: g.GID})
			idx = len(s.d.Groups) - 1
		} else {
			return nil
		}
	}
	g := &s.d.Groups[idx]
	g.Members = without(g.Members, user)
	if member {
		g.Members = append(g.Members, user)
		sort.Strings(g.Members)
	}
	return s.save()
}

func without(list []string, v string) []string {
	out := make([]string, 0, len(list))
	for _, x := range list {
		if x != v {
			out = append(out, x)
		}
	}
	return out
}

// Restore recreates missing groups, users and memberships. Anything that
// already exists is left alone. It returns the number of objects created.
func (s *State) Restore(ctx context.Context, b system.UserBackend) int {
	s.mu.Lock()
	d := data{Users: append([]UserRec(nil), s.d.Users...), Groups: append([]GroupRec(nil), s.d.Groups...)}
	s.mu.Unlock()

	n := 0
	for _, g := range d.Groups {
		if _, err := system.LookupGroup(g.Name); err == nil {
			continue
		}
		if err := b.AddGroupWithID(ctx, g.Name, g.GID); err != nil {
			log.Printf("restore: group %s: %v", g.Name, err)
			continue
		}
		log.Printf("restore: recreated group %s (gid %d)", g.Name, g.GID)
		n++
	}
	for _, u := range d.Users {
		if _, err := system.LookupUser(u.Name); err == nil {
			continue
		}
		if _, err := system.LookupGroupByGID(u.GID); err != nil && u.Group != "" {
			if err := b.AddGroupWithID(ctx, u.Group, u.GID); err != nil {
				log.Printf("restore: primary group %s: %v", u.Group, err)
			}
		}
		if err := b.AddUserWithID(ctx, u.Name, u.UID, u.GID); err != nil {
			log.Printf("restore: user %s: %v", u.Name, err)
			continue
		}
		log.Printf("restore: recreated user %s (uid %d)", u.Name, u.UID)
		n++
	}
	for _, g := range d.Groups {
		current, err := system.LookupGroup(g.Name)
		if err != nil {
			continue
		}
		have := map[string]bool{}
		for _, m := range current.Members {
			have[m] = true
		}
		for _, m := range g.Members {
			if have[m] {
				continue
			}
			if _, err := system.LookupUser(m); err != nil {
				continue
			}
			if err := b.AddToGroup(ctx, m, g.Name); err != nil {
				log.Printf("restore: add %s to %s: %v", m, g.Name, err)
			}
		}
	}
	return n
}
