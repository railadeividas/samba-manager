package api

import (
	"fmt"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"syscall"

	"samba-manager/internal/smbconf"
	"samba-manager/internal/system"
)

// Keys starting with "_" in share payloads are manager settings, not smb.conf
// parameters. They are stored as "# samba-manager:" comments in the section.
const (
	metaAccess      = "_access"      // "samba" or "acl"
	metaOwner       = "_owner"       // directory owner
	metaGroup       = "_group"       // directory group
	metaPermissions = "_permissions" // directory mode, e.g. 0775
	metaRecursive   = "_recursive"   // apply ACLs to existing files too (one-off)
)

// formKeys are the parameters the share form always sends. When a save does
// not include one of them it is removed; any other existing parameter (set
// through the raw editor, say) is kept as is.
var formKeys = []string{
	"path", "comment", "browseable", "read only", "guest ok", "valid users",
	"write list", "read list", "create mask", "directory mask", "force user", "force group",
}

// shareInput is a validated share save request.
type shareInput struct {
	Name        string
	Path        string
	Params      map[string]string // all smb.conf parameters after merging
	Access      string
	Owner       string
	Group       string
	Permissions string
	Recursive   bool
}

func isReserved(name string) bool { return system.ReservedSections[strings.ToLower(name)] }

// shareView renders a section the way the UI wants it.
func shareView(sec *smbconf.Section) map[string]string {
	m := sec.Map()
	for k, v := range sec.Meta {
		m["_"+k] = v
	}
	if m[metaAccess] == "" {
		// shares created before access modes existed relied on ACLs
		if m["force user"] == "" && m["force group"] == "" {
			m[metaAccess] = "acl"
		} else {
			m[metaAccess] = "samba"
		}
	}
	return m
}

func (s *Server) getShares(w http.ResponseWriter, r *http.Request) error {
	f, err := s.Store.Read()
	if err != nil {
		return err
	}
	out := map[string]map[string]string{}
	for _, sec := range f.Sections {
		if !isReserved(sec.Name) {
			out[sec.Name] = shareView(sec)
		}
	}
	writeJSON(w, http.StatusOK, out)
	return nil
}

func (s *Server) getShare(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	f, err := s.Store.Read()
	if err != nil {
		return err
	}
	sec := f.Section(name)
	if sec == nil || isReserved(sec.Name) {
		return notFound("Share not found")
	}
	writeJSON(w, http.StatusOK, map[string]map[string]string{sec.Name: shareView(sec)})
	return nil
}

func (s *Server) deleteShare(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	if isReserved(name) {
		return forbidden("%q is not a share", name)
	}
	err := s.Store.Update(r.Context(), func(f *smbconf.File) error {
		if !f.DeleteSection(name) {
			return notFound("Share not found")
		}
		return nil
	})
	if err != nil {
		return err
	}
	warning := s.reload(r.Context())
	if warning == "" {
		warning = "The share was removed. Its files were left untouched on disk."
	}
	ok(w, "Share deleted successfully", warning)
	return nil
}

// parseShareInput validates the request and merges it with the existing section.
func (s *Server) parseShareInput(r *http.Request, name string, body map[string]any, prev *smbconf.Section) (*shareInput, error) {
	if err := system.ValidateShareName(name); err != nil {
		return nil, badRequest("%v", err)
	}
	req := map[string]string{}
	for k, v := range body {
		switch t := v.(type) {
		case nil:
			req[k] = ""
		case string:
			req[k] = strings.TrimSpace(t)
		case bool:
			if t {
				req[k] = "yes"
			} else {
				req[k] = "no"
			}
		case float64:
			req[k] = strconv.FormatFloat(t, 'f', -1, 64)
		default:
			return nil, badRequest("parameter %q must be a string", k)
		}
	}
	delete(req, "name")

	in := &shareInput{Name: name, Params: map[string]string{}}

	// start from what is there, minus the form-managed keys
	if prev != nil {
		in.Params = prev.Map()
		for _, k := range formKeys {
			for existing := range in.Params {
				if smbconf.NormKey(existing) == k {
					delete(in.Params, existing)
				}
			}
		}
	}
	for k, v := range req {
		if strings.HasPrefix(k, "_") {
			continue
		}
		if err := system.ValidateParamKey(k); err != nil {
			return nil, badRequest("%v", err)
		}
		if err := system.ValidateParamValue(v); err != nil {
			return nil, badRequest("%v", err)
		}
		for existing := range in.Params {
			if smbconf.NormKey(existing) == smbconf.NormKey(k) {
				delete(in.Params, existing)
			}
		}
		if v != "" {
			in.Params[k] = v
		}
	}

	path, err := system.ValidateSharePath(valueOf(in.Params, "path"), s.Cfg.Samba.AllowedRoots)
	if err != nil {
		return nil, badRequest("%v", err)
	}
	in.Path = path
	in.Params["path"] = path

	in.Access = req[metaAccess]
	if in.Access == "" && prev != nil {
		in.Access = shareView(prev)[metaAccess]
	}
	if in.Access == "" {
		in.Access = "samba"
	}
	if in.Access != "samba" && in.Access != "acl" {
		return nil, badRequest("invalid access mode %q (use \"samba\" or \"acl\")", in.Access)
	}

	in.Owner, in.Group, in.Permissions = req[metaOwner], req[metaGroup], req[metaPermissions]
	if in.Owner != "" {
		if err := system.ValidateUsername(in.Owner); err != nil {
			return nil, badRequest("owner: %v", err)
		}
		if _, err := system.LookupUser(in.Owner); err != nil {
			return nil, badRequest("owner %q does not exist", in.Owner)
		}
	}
	if in.Group != "" {
		if err := system.ValidateGroupname(in.Group); err != nil {
			return nil, badRequest("group: %v", err)
		}
		if _, err := system.LookupGroup(in.Group); err != nil {
			return nil, badRequest("group %q does not exist", in.Group)
		}
	}
	if in.Permissions != "" {
		if err := system.ValidateOctalMode(in.Permissions); err != nil {
			return nil, badRequest("%v", err)
		}
		if mode, _ := strconv.ParseUint(in.Permissions, 8, 32); mode&0o4000 != 0 {
			return nil, badRequest("the setuid bit is not allowed on share directories")
		}
	}
	for _, k := range []string{"create mask", "directory mask", "force create mode", "force directory mode"} {
		if v := in.Params[k]; v != "" {
			if err := system.ValidateOctalMode(v); err != nil {
				return nil, badRequest("%s: %v", k, err)
			}
		}
	}
	rec := strings.ToLower(req[metaRecursive])
	in.Recursive = rec == "yes" || rec == "true" || rec == "1"

	if err := s.validateAccessLists(r, in.Params); err != nil {
		return nil, err
	}
	return in, nil
}

func valueOf(m map[string]string, key string) string {
	for k, v := range m {
		if smbconf.NormKey(k) == key {
			return v
		}
	}
	return ""
}

// validateAccessLists checks that users and groups named in the share exist.
func (s *Server) validateAccessLists(r *http.Request, params map[string]string) error {
	var samba map[string]bool
	for _, key := range []string{"valid users", "write list", "read list", "admin users"} {
		for _, e := range listEntries(valueOf(params, key)) {
			if strings.ContainsAny(e, `%\"*`) {
				continue // variables, domain users, quoted names: cannot check
			}
			if strings.HasPrefix(e, "@") || strings.HasPrefix(e, "+") || strings.HasPrefix(e, "&") {
				g := strings.TrimLeft(e, "@+&")
				if _, err := system.LookupGroup(g); err != nil {
					return badRequest("Group '%s' from '%s' does not exist", g, key)
				}
				continue
			}
			if samba == nil {
				users, err := s.sambaUsers(r)
				if err != nil {
					return err
				}
				samba = map[string]bool{}
				for _, u := range users {
					samba[u] = true
				}
			}
			if !samba[e] {
				return badRequest("User '%s' from '%s' does not exist in Samba", e, key)
			}
		}
	}
	for _, key := range []string{"force user"} {
		if v := valueOf(params, key); v != "" {
			if _, err := system.LookupUser(v); err != nil {
				return badRequest("'%s': user %q does not exist", key, v)
			}
		}
	}
	for _, key := range []string{"force group"} {
		if v := valueOf(params, key); v != "" {
			if _, err := system.LookupGroup(strings.TrimLeft(v, "+@&")); err != nil {
				return badRequest("'%s': group %q does not exist", key, v)
			}
		}
	}
	return nil
}

// saveShare creates or updates a share: directory, access control and
// smb.conf in one step. If writing smb.conf fails, a directory created by this
// request is removed again.
func (s *Server) saveShare(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	var body map[string]any
	if err := decode(w, r, &body); err != nil {
		return err
	}
	ctx := r.Context()

	var prev *smbconf.Section
	f, err := s.Store.Read()
	if err != nil {
		return err
	}
	if p := f.Section(name); p != nil {
		if isReserved(p.Name) {
			return forbidden("%q is not a share", name)
		}
		prev = p
		name = p.Name // keep the existing spelling
	}
	isNew := prev == nil

	in, err := s.parseShareInput(r, name, body, prev)
	if err != nil {
		return err
	}

	guestWarnings, err := applyGuestAccess(f, in)
	if err != nil {
		return err
	}

	strategy := strategyFor(in.Access)
	plan, err := strategy.Prepare(ctx, s, in, prev)
	if err != nil {
		return err
	}
	plan.Warnings = append(plan.Warnings, guestWarnings...)
	for k, v := range plan.Params {
		if valueOf(in.Params, k) == "" {
			in.Params[k] = v
		}
	}
	for k, v := range plan.Force {
		in.Params[k] = v
	}

	createdDir, err := prepareDirectory(in, plan)
	if err != nil {
		return err
	}
	if plan.Apply != nil {
		if err := plan.Apply(ctx); err != nil {
			if createdDir {
				_ = os.Remove(in.Path)
			}
			return err
		}
	}

	meta := map[string]string{"access": in.Access}
	for k, v := range map[string]string{"owner": in.Owner, "group": in.Group, "permissions": in.Permissions} {
		if v != "" {
			meta[k] = v
		}
	}
	err = s.Store.Update(ctx, func(f *smbconf.File) error {
		sec := f.SetSection(in.Name, in.Params)
		sec.Meta = meta
		return nil
	})
	if err != nil {
		if createdDir {
			_ = os.Remove(in.Path)
		}
		return err
	}

	warning := strings.Join(plan.Warnings, " ")
	if rw := s.reload(ctx); rw != "" {
		warning = strings.TrimSpace(warning + " " + rw)
	}
	verb := "updated"
	if isNew {
		verb = "created"
	}
	ok(w, fmt.Sprintf("Share %s successfully.", verb), warning)
	return nil
}

// applyGuestAccess makes "guest ok = yes" work without further setup.
//   - "valid users" is dropped: it would lock anonymous users out. Who may
//     change files is still controlled by "write list" and "read only".
//   - Guests run as Samba's guest account, so unless a Force User/Group is
//     chosen the share is forced to that account (Samba-only mode) and the
//     directory is handed to it.
//
// It returns warnings for the UI.
func applyGuestAccess(f *smbconf.File, in *shareInput) ([]string, error) {
	if !isYes(valueOf(in.Params, "guest ok")) {
		return nil, nil
	}
	var warnings []string
	in.Access = "samba" // ACLs cannot grant anything to anonymous users
	for k := range in.Params {
		if smbconf.NormKey(k) == "valid users" {
			if in.Params[k] != "" {
				warnings = append(warnings, "Guest access is on, so the Valid Users list was not saved: it would keep guests out. Use the Write List to limit who can change files.")
			}
			delete(in.Params, k)
		}
	}
	if valueOf(in.Params, "force user") != "" || valueOf(in.Params, "force group") != "" {
		return warnings, nil
	}
	account := "nobody"
	if g := f.Section("global"); g != nil {
		if v, ok := g.Get("guest account"); ok && v != "" {
			account = v
		}
	}
	u, err := system.LookupUser(account)
	if err != nil {
		return nil, badRequest("guest access needs the guest account %q, which does not exist on this system", account)
	}
	in.Params["force user"] = u.Name
	if g, err := system.LookupGroupByGID(u.GID); err == nil {
		in.Params["force group"] = g.Name
	}
	if info, err := os.Stat(in.Path); err == nil {
		if st, ok := info.Sys().(*syscall.Stat_t); ok && int(st.Uid) != u.UID && !isYes(valueOf(in.Params, "read only")) {
			warnings = append(warnings, fmt.Sprintf("Guests are saved as %q, but %s is owned by another account, so guest writes may fail. Set the owner to %q (or make the directory world-writable).", u.Name, in.Path, u.Name))
		}
	}
	return warnings, nil
}

func isYes(v string) bool {
	switch strings.ToLower(v) {
	case "yes", "true", "1", "on":
		return true
	}
	return false
}

// prepareDirectory creates the share directory if needed and applies
// ownership and permissions. It reports whether it created the directory.
func prepareDirectory(in *shareInput, plan *accessPlan) (created bool, err error) {
	info, statErr := os.Stat(in.Path)
	switch {
	case statErr == nil && !info.IsDir():
		return false, badRequest("%s exists and is not a directory", in.Path)
	case statErr != nil && !os.IsNotExist(statErr):
		return false, fmt.Errorf("cannot access %s: %w", in.Path, statErr)
	case statErr != nil:
		if err := os.MkdirAll(in.Path, 0o755); err != nil {
			return false, fmt.Errorf("failed to create directory: %w", err)
		}
		created = true
	}

	owner, group := in.Owner, in.Group
	if owner == "" && (created || plan.ChownDefaults) {
		owner = plan.DefaultOwner
	}
	if group == "" && (created || plan.ChownDefaults) {
		group = plan.DefaultGroup
	}
	uid, gid := -1, -1
	if owner != "" {
		if u, err := system.LookupUser(owner); err == nil {
			uid = u.UID
		}
	}
	if group != "" {
		if g, err := system.LookupGroup(group); err == nil {
			gid = g.GID
		}
	}
	rollback := func() {
		if created {
			_ = os.Remove(in.Path)
		}
	}
	if uid != -1 || gid != -1 {
		if err := os.Chown(in.Path, uid, gid); err != nil {
			rollback()
			return false, fmt.Errorf("failed to set owner/group: %w", err)
		}
	}

	perm := in.Permissions
	if perm == "" && created {
		perm = plan.DefaultMode
	}
	if perm != "" {
		v, _ := strconv.ParseUint(perm, 8, 32)
		mode := os.FileMode(v & 0o777)
		if v&0o2000 != 0 {
			mode |= os.ModeSetgid
		}
		if v&0o1000 != 0 {
			mode |= os.ModeSticky
		}
		if err := os.Chmod(in.Path, mode); err != nil {
			rollback()
			return false, fmt.Errorf("failed to set permissions: %w", err)
		}
	}
	return created, nil
}

// ---- ACL listing ----

// ACLEntry is one named ACL entry.
type ACLEntry struct {
	User       string `json:"user"`
	Permission string `json:"permission"`
	Type       string `json:"type"`
	Default    bool   `json:"default"`
}

// ShareACLs lists the ACLs of a share directory.
type ShareACLs struct {
	Path    string     `json:"path"`
	Owner   string     `json:"owner"`
	Group   string     `json:"group"`
	Entries []ACLEntry `json:"entries"`
}

func parseGetfacl(path, out string) ShareACLs {
	res := ShareACLs{Path: path, Entries: []ACLEntry{}}
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		switch {
		case line == "":
		case strings.HasPrefix(line, "# owner:"):
			res.Owner = strings.TrimSpace(strings.TrimPrefix(line, "# owner:"))
		case strings.HasPrefix(line, "# group:"):
			res.Group = strings.TrimSpace(strings.TrimPrefix(line, "# group:"))
		case strings.HasPrefix(line, "#"):
		default:
			isDefault := strings.HasPrefix(line, "default:")
			line = strings.TrimPrefix(line, "default:")
			parts := strings.Split(line, ":")
			if len(parts) < 3 || parts[1] == "" || (parts[0] != "user" && parts[0] != "group") {
				continue
			}
			perm := strings.Fields(parts[2])[0]
			res.Entries = append(res.Entries, ACLEntry{Type: parts[0], User: parts[1], Permission: perm, Default: isDefault})
		}
	}
	return res
}

func (s *Server) getShareACLs(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	f, err := s.Store.Read()
	if err != nil {
		return err
	}
	sec := f.Section(name)
	if sec == nil || isReserved(sec.Name) {
		return notFound("Share not found")
	}
	path, found := sec.Get("path")
	if !found {
		return notFound("Share path not found")
	}
	out, err := s.Run.Run(r.Context(), "", "getfacl", "--absolute-names", "--", path)
	if err != nil {
		return fmt.Errorf("failed to get ACLs: %w", err)
	}
	writeJSON(w, http.StatusOK, parseGetfacl(path, out))
	return nil
}

// sortedKeys is a small helper for deterministic output.
func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
