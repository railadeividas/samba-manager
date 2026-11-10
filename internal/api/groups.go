package api

import (
	"fmt"
	"net/http"

	"samba-manager/internal/system"
)

// Group is the API representation of a Unix group.
type Group struct {
	Name      string   `json:"name"`
	Users     []string `json:"users"`
	GID       int      `json:"gid"`
	IsSystem  bool     `json:"isSystem"`
	IsPrivate bool     `json:"isPrivate,omitempty"`
}

func (s *Server) getGroups(w http.ResponseWriter, r *http.Request) error {
	includeSystem := r.URL.Query().Get("includeSystem") == "true"
	includePrivate := r.URL.Query().Get("includePrivate") == "true"
	all, err := system.ReadGroups()
	if err != nil {
		return fmt.Errorf("failed to list groups: %w", err)
	}
	groups := []Group{}
	for _, g := range all {
		sys := system.IsSystemGID(g.GID)
		if (sys && !includeSystem) || (g.Private && !includePrivate && !sys) {
			continue
		}
		groups = append(groups, Group{Name: g.Name, Users: g.Members, GID: g.GID, IsSystem: sys, IsPrivate: g.Private})
	}
	writeJSON(w, http.StatusOK, map[string]any{"groups": groups})
	return nil
}

func (s *Server) createGroup(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	if err := system.ValidateGroupname(name); err != nil {
		return badRequest("%v", err)
	}
	if _, err := system.LookupGroup(name); err == nil {
		return conflict("Group %s already exists", name)
	}
	if err := s.Users.AddGroup(r.Context(), name); err != nil {
		return fmt.Errorf("failed to create group: %w", err)
	}
	warning := ""
	if g, err := system.LookupGroup(name); err == nil {
		if err := s.State.RecordGroup(name, g.GID); err != nil {
			warning = "Group created, but the state file could not be updated: " + err.Error()
		}
	}
	ok(w, "Group created successfully", warning)
	return nil
}

func (s *Server) deleteGroup(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	if err := system.ValidateGroupname(name); err != nil {
		return badRequest("%v", err)
	}
	g, err := system.LookupGroup(name)
	if err != nil {
		return notFound("Group %s not found", name)
	}
	if system.IsSystemGID(g.GID) {
		return forbidden("Cannot delete system groups (GID < 1000)")
	}
	if err := s.Users.DelGroup(r.Context(), name); err != nil {
		return fmt.Errorf("failed to delete group: %w", err)
	}
	_ = s.State.ForgetGroup(name)
	warning := ""
	if refs := s.sharesReferencing("@" + name); len(refs) > 0 {
		warning = fmt.Sprintf("The group is still listed in share(s): %v.", refs)
	}
	ok(w, "Group deleted successfully", warning)
	return nil
}

func (s *Server) addUserToGroup(w http.ResponseWriter, r *http.Request) error {
	group, user := r.PathValue("name"), r.PathValue("user")
	if err := system.ValidateGroupname(group); err != nil {
		return badRequest("%v", err)
	}
	if err := system.ValidateUsername(user); err != nil {
		return badRequest("%v", err)
	}
	if _, err := system.LookupGroup(group); err != nil {
		return notFound("Group %s not found", group)
	}
	if _, err := system.LookupUser(user); err != nil {
		return notFound("User %s not found", user)
	}
	if err := s.Users.AddToGroup(r.Context(), user, group); err != nil {
		return fmt.Errorf("failed to add user to group: %w", err)
	}
	_ = s.State.SetMember(group, user, true)
	ok(w, fmt.Sprintf("User %s added to group %s successfully", user, group),
		"Connected clients pick up the new membership after they reconnect.")
	return nil
}

func (s *Server) removeUserFromGroup(w http.ResponseWriter, r *http.Request) error {
	group, user := r.PathValue("name"), r.PathValue("user")
	if err := system.ValidateGroupname(group); err != nil {
		return badRequest("%v", err)
	}
	if err := system.ValidateUsername(user); err != nil {
		return badRequest("%v", err)
	}
	g, err := system.LookupGroup(group)
	if err != nil {
		return notFound("Group %s not found", group)
	}
	member := false
	for _, m := range g.Members {
		member = member || m == user
	}
	if !member {
		return notFound("User %s is not a member of group %s", user, group)
	}
	if err := s.Users.RemoveFromGroup(r.Context(), user, group); err != nil {
		return fmt.Errorf("failed to remove user from group: %w", err)
	}
	_ = s.State.SetMember(group, user, false)
	ok(w, fmt.Sprintf("User %s removed from group %s successfully", user, group),
		"Connected clients keep the old membership until they reconnect.")
	return nil
}
