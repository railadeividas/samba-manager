package api

import (
	"context"
	"fmt"
	"strings"

	"samba-manager/internal/smbconf"
	"samba-manager/internal/system"
)

// accessPlan is what an access strategy decides for one share save.
type accessPlan struct {
	// Params are defaults, only used when the request did not set them.
	Params map[string]string
	// Force are parameters the strategy requires.
	Force map[string]string
	// DefaultOwner/DefaultGroup/DefaultMode apply to directories created by this request.
	DefaultOwner, DefaultGroup, DefaultMode string
	// ChownDefaults also applies DefaultOwner/DefaultGroup to an existing directory.
	ChownDefaults bool
	// Apply performs filesystem work (ACLs) once the directory exists.
	Apply    func(ctx context.Context) error
	Warnings []string
}

// accessStrategy turns the "who may do what" settings of a share into
// smb.conf parameters and filesystem permissions.
type accessStrategy interface {
	Prepare(ctx context.Context, s *Server, in *shareInput, prev *smbconf.Section) (*accessPlan, error)
}

func strategyFor(mode string) accessStrategy {
	if mode == "acl" {
		return aclStrategy{}
	}
	return sambaStrategy{}
}

// ---- Samba-only ----

// sambaStrategy leaves access control entirely to Samba ("valid users",
// "write list", ...). Files on disk belong to one account via "force user" /
// "force group", so Unix permissions and ACLs stay out of the way.
type sambaStrategy struct{}

func (sambaStrategy) Prepare(_ context.Context, _ *Server, in *shareInput, _ *smbconf.Section) (*accessPlan, error) {
	p := &accessPlan{
		Params:      map[string]string{"create mask": "0664", "directory mask": "0775"},
		DefaultMode: "0775",
	}
	fu, fg := valueOf(in.Params, "force user"), strings.TrimLeft(valueOf(in.Params, "force group"), "+@&")
	p.DefaultOwner, p.DefaultGroup = fu, fg
	if fg != "" {
		p.DefaultMode = "2775"
	}
	if fu == "" && fg == "" {
		p.Warnings = append(p.Warnings,
			"No Force User or Force Group is set: files are owned by whoever creates them, so other users may be unable to change them. "+
				"Set a Force User/Group (recommended for this mode) or switch the share to POSIX ACL mode.")
	}
	return p, nil
}

// ---- POSIX ACL ----

// aclStrategy mirrors "valid users" and "write list" into POSIX ACLs on the
// share directory, so access is enforced by the filesystem for every user and
// files keep their real owners.
type aclStrategy struct{}

type aclSpec struct {
	kind byte // 'u' or 'g'
	name string
	perm string
}

func (e aclSpec) key() string { return string(e.kind) + ":" + e.name }

// aclSpecs derives the wanted entries; "write list" beats "valid users".
func aclSpecs(validUsers, writeList string) map[string]aclSpec {
	out := map[string]aclSpec{}
	add := func(list, perm string) {
		for _, e := range listEntries(list) {
			if strings.ContainsAny(e, `%\"*`) {
				continue
			}
			spec := aclSpec{kind: 'u', name: e, perm: perm}
			if strings.HasPrefix(e, "@") || strings.HasPrefix(e, "+") || strings.HasPrefix(e, "&") {
				spec.kind, spec.name = 'g', strings.TrimLeft(e, "@+&")
			}
			if spec.name == "" {
				continue
			}
			if old, exists := out[spec.key()]; exists && old.perm == "rwX" {
				continue
			}
			out[spec.key()] = spec
		}
	}
	add(validUsers, "rX")
	add(writeList, "rwX")
	return out
}

func (aclStrategy) Prepare(_ context.Context, s *Server, in *shareInput, prev *smbconf.Section) (*accessPlan, error) {
	if !system.HaveCommand("setfacl") {
		return nil, badRequest("POSIX ACL mode needs the 'setfacl' command (package 'acl') on the server")
	}
	p := &accessPlan{
		Params:      map[string]string{"inherit acls": "yes", "create mask": "0664", "directory mask": "0775"},
		DefaultMode: "0775",
	}
	if valueOf(in.Params, "force user") != "" || valueOf(in.Params, "force group") != "" {
		p.Warnings = append(p.Warnings, "Force User/Group makes every file belong to one account, which defeats per-user ownership in POSIX ACL mode.")
	}

	want := aclSpecs(valueOf(in.Params, "valid users"), valueOf(in.Params, "write list"))
	var old map[string]aclSpec
	if prev != nil {
		vu, _ := prev.Get("valid users")
		wl, _ := prev.Get("write list")
		old = aclSpecs(vu, wl)
	}

	p.Apply = func(ctx context.Context) error {
		path := in.Path
		// drop entries for users/groups that were removed from the lists
		var stale []string
		for k, spec := range old {
			if _, still := want[k]; !still {
				stale = append(stale, fmt.Sprintf("%c:%s", spec.kind, spec.name), fmt.Sprintf("d:%c:%s", spec.kind, spec.name))
			}
		}
		recursive := []string{}
		if in.Recursive {
			recursive = []string{"-R"}
		}
		if len(stale) > 0 {
			args := append(append([]string{}, recursive...), "-x", strings.Join(stale, ","), "--", path)
			if _, err := s.Run.Run(ctx, "", "setfacl", args...); err != nil {
				return fmt.Errorf("failed to remove old ACL entries: %w", err)
			}
		}
		if len(want) == 0 {
			return nil
		}
		var entries []string
		for _, k := range sortedKeys(want) {
			spec := want[k]
			if spec.kind == 'u' {
				if _, err := system.LookupUser(spec.name); err != nil {
					return badRequest("cannot set ACL: user %q does not exist on this system", spec.name)
				}
			} else if _, err := system.LookupGroup(spec.name); err != nil {
				return badRequest("cannot set ACL: group %q does not exist on this system", spec.name)
			}
			entries = append(entries, fmt.Sprintf("%c:%s:%s", spec.kind, spec.name, spec.perm), fmt.Sprintf("d:%c:%s:%s", spec.kind, spec.name, spec.perm))
		}
		args := append(append([]string{}, recursive...), "-m", strings.Join(entries, ","), "--", path)
		if _, err := s.Run.Run(ctx, "", "setfacl", args...); err != nil {
			return fmt.Errorf("failed to set ACLs: %w", err)
		}
		return nil
	}
	return p, nil
}
