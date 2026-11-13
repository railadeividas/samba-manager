package api

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"samba-manager/internal/smbconf"
	"samba-manager/internal/state"
	"samba-manager/internal/system"
)

// PasswordRequest carries a password.
type PasswordRequest struct {
	Password string `json:"password"`
}

// sambaUsers lists the users in Samba's password database.
func (s *Server) sambaUsers(r *http.Request) ([]string, error) {
	out, err := s.Run.Run(r.Context(), "", "pdbedit", "-L")
	if err != nil {
		return nil, fmt.Errorf("failed to list Samba users: %w", err)
	}
	users := []string{}
	for _, line := range strings.Split(out, "\n") {
		name, _, found := strings.Cut(line, ":")
		name = strings.TrimSpace(name)
		if found && name != "" && !strings.HasPrefix(name, "#") {
			users = append(users, name)
		}
	}
	return users, nil
}

func (s *Server) hasSambaUser(r *http.Request, name string) (bool, error) {
	users, err := s.sambaUsers(r)
	if err != nil {
		return false, err
	}
	for _, u := range users {
		if u == name {
			return true, nil
		}
	}
	return false, nil
}

func (s *Server) getUsers(w http.ResponseWriter, r *http.Request) error {
	users, err := s.sambaUsers(r)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": users})
	return nil
}

// CreateUserRequest is the body of POST /users/{name}.
type CreateUserRequest struct {
	Password string `json:"password"`
	// ExistingHome says what to do when /home/<name> already exists and
	// belongs to another UID: "adopt" it or "wipe" it. Empty refuses.
	ExistingHome string `json:"existingHome"`
}

// uidInUse reports whether a passwd entry already has uid.
func uidInUse(uid int) bool { return lookupUID(uid) != "" }

// addUser creates the Unix account. A user that was deleted before gets the
// same UID/GID back when they are still free, so the files it left behind
// (home, share contents) belong to it again. It reports whether ids were reused.
func (s *Server) addUser(ctx context.Context, name string) (bool, error) {
	if rec, ok := s.State.RemovedUser(name); ok && rec.UID >= 1000 && rec.Group != "" && !uidInUse(rec.UID) {
		if s.addUserWithOldIDs(ctx, name, rec) {
			return true, nil
		}
	}
	return false, s.Users.AddUser(ctx, name)
}

// addUserWithOldIDs recreates the user with its remembered UID and GID. It
// gives up (leaving nothing behind) when the group name or id is taken.
func (s *Server) addUserWithOldIDs(ctx context.Context, name string, rec state.UserRec) bool {
	createdGroup := false
	if g, err := system.LookupGroupByGID(rec.GID); err == nil {
		if g.Name != rec.Group {
			return false
		}
	} else {
		if _, err := system.LookupGroup(rec.Group); err == nil {
			return false
		}
		if s.Users.AddGroupWithID(ctx, rec.Group, rec.GID) != nil {
			return false
		}
		createdGroup = true
	}
	if err := s.Users.AddUserWithID(ctx, name, rec.UID, rec.GID); err != nil {
		if createdGroup {
			_ = s.Users.DelGroup(ctx, rec.Group)
		}
		return false
	}
	return true
}

func (s *Server) createUser(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	if err := system.ValidateUsername(name); err != nil {
		return badRequest("%v", err)
	}
	var req CreateUserRequest
	if err := decode(w, r, &req); err != nil {
		return err
	}
	if err := system.ValidatePassword(req.Password); err != nil {
		return badRequest("%v", err)
	}
	if req.ExistingHome != homeKeep && req.ExistingHome != homeAdopt && req.ExistingHome != homeWipe {
		return badRequest("invalid existingHome %q (use \"adopt\" or \"wipe\")", req.ExistingHome)
	}
	if exists, err := s.hasSambaUser(r, name); err != nil {
		return err
	} else if exists {
		return conflict("User %s already exists", name)
	}

	ctx := r.Context()
	var warnings []string
	created, reusedIDs := false, false
	acct, err := system.LookupUser(name)
	if err != nil {
		if reusedIDs, err = s.addUser(ctx, name); err != nil {
			return fmt.Errorf("failed to create system user: %w", err)
		}
		created = true
		if acct, err = system.LookupUser(name); err != nil {
			return fmt.Errorf("system user was created but cannot be read back: %w", err)
		}
	} else if acct.UID < 1000 || acct.UID == 65534 {
		return forbidden("%s is a system account and cannot be used as a Samba user", name)
	} else {
		warnings = append(warnings, fmt.Sprintf("The existing system account %s was used; it will not be deleted with the Samba user.", name))
	}

	rollback := func(sambaAdded bool) {
		if sambaAdded {
			_, _ = s.Run.Run(ctx, "", "pdbedit", "-x", "-u", name)
		}
		if created {
			_ = s.Users.DelUser(ctx, name)
		}
	}

	pw := req.Password + "\n"
	if _, err := s.Run.Run(ctx, pw+pw, "smbpasswd", "-a", "-s", name); err != nil {
		rollback(false)
		return fmt.Errorf("failed to add Samba user: %w", err)
	}

	// Every user gets a home directory.
	action, err := s.ensureHome(acct, req.ExistingHome)
	if err != nil {
		if created {
			rollback(true)
			return err
		}
		warnings = append(warnings, fmt.Sprintf("No home directory was prepared: %v", err))
	} else if msg := homeMessage(action, acct.Home); msg != "" {
		warnings = append(warnings, msg)
	}

	if created {
		if reusedIDs {
			warnings = append(warnings, fmt.Sprintf("Restored UID %d from the previous user of this name, so files it left behind belong to it again.", acct.UID))
		} else if other, ok := s.State.RemovedByUID(acct.UID); ok && other != name {
			warnings = append(warnings, fmt.Sprintf("UID %d was used by the deleted user %q: files that user left behind now belong to %s.", acct.UID, other, name))
		}
		group := ""
		if g, err := system.LookupGroupByGID(acct.GID); err == nil {
			group = g.Name
		}
		if err := s.State.RecordUser(state.UserRec{Name: name, UID: acct.UID, GID: acct.GID, Group: group, Created: true}); err != nil {
			warnings = append(warnings, "The state file could not be updated: "+err.Error())
		}
		_ = s.State.ForgetRemoved(name)
	}
	ok(w, "User created successfully", strings.Join(warnings, " "))
	return nil
}

func (s *Server) deleteUser(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	if err := system.ValidateUsername(name); err != nil {
		return badRequest("%v", err)
	}
	deleteHome := r.URL.Query().Get("deleteHome") == "true"
	exists, err := s.hasSambaUser(r, name)
	if err != nil {
		return err
	}
	if !exists {
		return notFound("User %s not found", name)
	}
	ctx := r.Context()
	acct, acctErr := system.LookupUser(name)
	managed := s.State.IsUserCreated(name)
	if deleteHome && acctErr == nil && managed {
		// check before anything is removed, so a refusal leaves the user intact
		if _, err := s.homePath(acct); err != nil {
			return err
		}
	}
	if _, err := s.Run.Run(ctx, "", "pdbedit", "-x", "-u", name); err != nil {
		return fmt.Errorf("failed to delete Samba user: %w", err)
	}

	var warnings []string
	if managed {
		if err := s.Users.DelUser(ctx, name); err != nil {
			warnings = append(warnings, "Samba user removed, but the system account could not be deleted: "+err.Error())
		} else if acctErr == nil {
			group := ""
			if g, err := system.LookupGroupByGID(acct.GID); err == nil {
				group = g.Name
			}
			_ = s.State.RememberRemoved(state.UserRec{Name: name, UID: acct.UID, GID: acct.GID, Group: group})
		}
		_ = s.State.ForgetUser(name)
	}

	if acctErr == nil {
		switch {
		case deleteHome && managed:
			if msg, err := s.removeHome(acct); err != nil {
				warnings = append(warnings, "The user was deleted, but its home directory was not: "+err.Error())
			} else if msg != "" {
				warnings = append(warnings, msg)
			}
		case deleteHome:
			warnings = append(warnings, fmt.Sprintf("The account %s was not created by the manager, so its home directory was kept.", name))
		default:
			if home, err := s.homePath(acct); err == nil {
				if _, err := os.Lstat(home); err == nil {
					warnings = append(warnings, fmt.Sprintf("The home directory %s was kept.", home))
				}
			}
		}
		if managed {
			warnings = append(warnings, fmt.Sprintf("Files owned by UID %d stay on disk; creating %s again restores that ownership.", acct.UID, name))
		}
	}
	if refs := s.sharesReferencing(name); len(refs) > 0 {
		warnings = append(warnings, fmt.Sprintf("The user is still listed in share(s): %s.", strings.Join(refs, ", ")))
	}
	ok(w, "User deleted successfully", strings.Join(warnings, " "))
	return nil
}

func (s *Server) changePassword(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	if err := system.ValidateUsername(name); err != nil {
		return badRequest("%v", err)
	}
	var req PasswordRequest
	if err := decode(w, r, &req); err != nil {
		return err
	}
	if err := system.ValidatePassword(req.Password); err != nil {
		return badRequest("%v", err)
	}
	exists, err := s.hasSambaUser(r, name)
	if err != nil {
		return err
	}
	if !exists {
		return notFound("User %s not found", name)
	}
	pw := req.Password + "\n"
	if _, err := s.Run.Run(r.Context(), pw+pw, "smbpasswd", "-s", name); err != nil {
		return fmt.Errorf("failed to change password: %w", err)
	}
	ok(w, "Password changed successfully", "")
	return nil
}

func (s *Server) createHome(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	if err := system.ValidateUsername(name); err != nil {
		return badRequest("%v", err)
	}
	var req struct {
		ExistingHome string `json:"existingHome"`
	}
	if r.ContentLength != 0 {
		if err := decode(w, r, &req); err != nil {
			return err
		}
	}
	acct, err := system.LookupUser(name)
	if err != nil {
		return notFound("User %s does not exist", name)
	}
	action, err := s.ensureHome(acct, req.ExistingHome)
	if err != nil {
		return err
	}
	switch action {
	case "created":
		ok(w, fmt.Sprintf("Home directory created for user %s", name), "")
	default:
		ok(w, fmt.Sprintf("Home directory ready for user %s", name), homeMessage(action, acct.Home))
	}
	return nil
}

// sharesReferencing lists shares whose access lists mention name (a user or group).
func (s *Server) sharesReferencing(name string) []string {
	f, err := s.Store.Read()
	if err != nil {
		return nil
	}
	want := strings.TrimLeft(name, "@+&")
	var out []string
	for _, sec := range f.Sections {
		if system.ReservedSections[strings.ToLower(sec.Name)] {
			continue
		}
		if sectionMentions(sec, want) {
			out = append(out, sec.Name)
		}
	}
	return out
}

func sectionMentions(sec *smbconf.Section, bare string) bool {
	for _, key := range []string{"valid users", "write list", "read list", "admin users", "force user", "force group"} {
		v, _ := sec.Get(key)
		for _, e := range listEntries(v) {
			if strings.TrimLeft(e, "@+&") == bare {
				return true
			}
		}
	}
	return false
}
