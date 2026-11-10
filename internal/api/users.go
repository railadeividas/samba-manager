package api

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
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

func (s *Server) createUser(w http.ResponseWriter, r *http.Request) error {
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
	if exists, err := s.hasSambaUser(r, name); err != nil {
		return err
	} else if exists {
		return conflict("User %s already exists", name)
	}

	ctx := r.Context()
	created := false
	acct, err := system.LookupUser(name)
	if err != nil {
		if err := s.Users.AddUser(ctx, name); err != nil {
			return fmt.Errorf("failed to create system user: %w", err)
		}
		created = true
		if acct, err = system.LookupUser(name); err != nil {
			return fmt.Errorf("system user was created but cannot be read back: %w", err)
		}
	} else if acct.UID < 1000 || acct.UID == 65534 {
		return forbidden("%s is a system account and cannot be used as a Samba user", name)
	}

	pw := req.Password + "\n"
	if _, err := s.Run.Run(ctx, pw+pw, "smbpasswd", "-a", "-s", name); err != nil {
		if created {
			_ = s.Users.DelUser(ctx, name)
		}
		return fmt.Errorf("failed to add Samba user: %w", err)
	}

	if created {
		group := ""
		if g, err := system.LookupGroupByGID(acct.GID); err == nil {
			group = g.Name
		}
		if err := s.State.RecordUser(state.UserRec{Name: name, UID: acct.UID, GID: acct.GID, Group: group, Created: true}); err != nil {
			ok(w, "User created successfully", "User created, but the state file could not be updated: "+err.Error())
			return nil
		}
	}
	ok(w, "User created successfully", "")
	return nil
}

func (s *Server) deleteUser(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	if err := system.ValidateUsername(name); err != nil {
		return badRequest("%v", err)
	}
	exists, err := s.hasSambaUser(r, name)
	if err != nil {
		return err
	}
	if !exists {
		return notFound("User %s not found", name)
	}
	ctx := r.Context()
	if _, err := s.Run.Run(ctx, "", "pdbedit", "-x", "-u", name); err != nil {
		return fmt.Errorf("failed to delete Samba user: %w", err)
	}

	warning := ""
	if s.State.IsUserCreated(name) {
		if err := s.Users.DelUser(ctx, name); err != nil {
			warning = "Samba user removed, but the system account could not be deleted: " + err.Error()
		}
		_ = s.State.ForgetUser(name)
	}
	if refs := s.sharesReferencing(name); len(refs) > 0 {
		warning = strings.TrimSpace(warning + fmt.Sprintf(" The user is still listed in share(s): %s.", strings.Join(refs, ", ")))
	}
	ok(w, "User deleted successfully", warning)
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
	acct, err := system.LookupUser(name)
	if err != nil {
		return notFound("User %s does not exist", name)
	}
	home := filepath.Clean(acct.Home)
	if !filepath.IsAbs(home) || home == "/" || home == "/nonexistent" {
		return badRequest("User %s has no usable home directory (%q)", name, acct.Home)
	}
	if _, err := system.ValidateSharePath(home, append([]string{"/home"}, s.Cfg.Samba.AllowedRoots...)); err != nil {
		return badRequest("home directory %s is outside the allowed locations", home)
	}
	if _, err := os.Stat(home); err == nil {
		return conflict("Home directory for user %s already exists", name)
	}
	if err := os.MkdirAll(home, 0o700); err != nil {
		return fmt.Errorf("failed to create home directory: %w", err)
	}
	if err := os.Chown(home, acct.UID, acct.GID); err != nil {
		return fmt.Errorf("failed to set ownership of %s: %w", home, err)
	}
	if err := os.Chmod(home, 0o700); err != nil {
		return err
	}
	ok(w, fmt.Sprintf("Home directory created for user %s", name), "")
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
