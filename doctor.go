package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"samba-manager/internal/config"
	"samba-manager/internal/system"
)

type checkLevel int

const (
	levelOK checkLevel = iota
	levelWarn
	levelFail
)

type check struct {
	level  checkLevel
	name   string
	detail string
}

// distroHint returns the package install command for this Linux distribution.
func distroHint() string {
	raw, _ := os.ReadFile("/etc/os-release")
	ids := ""
	for _, line := range strings.Split(string(raw), "\n") {
		if k, v, ok := strings.Cut(line, "="); ok && (k == "ID" || k == "ID_LIKE") {
			ids += " " + strings.Trim(v, `"`)
		}
	}
	has := func(s string) bool { return strings.Contains(ids, s) }
	switch {
	case has("debian") || has("ubuntu"):
		return "sudo apt install samba samba-vfs-modules acl wsdd2 avahi-daemon"
	case has("fedora") || has("rhel") || has("centos"):
		return "sudo dnf install samba samba-common-tools acl avahi"
	case has("alpine"):
		return "sudo apk add samba acl wsdd2 avahi dbus"
	case has("arch"):
		return "sudo pacman -S samba acl avahi"
	case has("suse"):
		return "sudo zypper install samba acl avahi"
	}
	return "install the samba and acl packages with your package manager"
}

// runChecks inspects the host. Required problems are FAIL, optional ones WARN.
func runChecks(cfg *config.Config) []check {
	var out []check
	add := func(l checkLevel, name, detail string) { out = append(out, check{l, name, detail}) }
	have := func(cmd string, required bool, why string) {
		if p, err := system.LookupPath(cmd); err == nil {
			add(levelOK, cmd, p)
			return
		}
		lvl := levelWarn
		if required {
			lvl = levelFail
		}
		add(lvl, cmd, "not found - "+why)
	}

	if os.Geteuid() == 0 {
		add(levelOK, "root privileges", "running as root")
	} else {
		add(levelFail, "root privileges", "must run as root to manage users, groups and Samba")
	}

	have("smbd", true, "the Samba server")
	have("smbpasswd", true, "needed to set Samba passwords")
	have("pdbedit", true, "needed to list and remove Samba users")
	have("smbcontrol", true, "needed to reload Samba without dropping clients")
	have("testparm", false, "used to validate smb.conf before saving")
	have("smbstatus", false, "needed for the Sessions page")
	have("nmbd", false, "NetBIOS name service (legacy Windows discovery)")

	if system.HaveCommand("useradd") {
		for _, c := range []string{"useradd", "userdel", "groupadd", "groupdel", "gpasswd"} {
			have(c, true, "shadow-utils is needed to manage users and groups")
		}
	} else {
		for _, c := range []string{"adduser", "deluser", "addgroup", "delgroup"} {
			have(c, true, "needed to manage users and groups")
		}
	}

	have("setfacl", false, "needed for POSIX ACL access mode")
	have("getfacl", false, "needed to show share ACLs")
	have("du", false, "used for share size statistics")
	have("wsdd2", false, "lets Windows 10/11 discover the server (or install wsdd)")
	have("avahi-daemon", false, "lets macOS Finder and Linux file managers discover the server")

	if system.HasVFSModule("fruit") {
		add(levelOK, "vfs_fruit", "macOS compatibility module present")
	} else {
		add(levelWarn, "vfs_fruit", "module not found - macOS features disabled (Debian/Ubuntu: samba-vfs-modules)")
	}

	if fi, err := os.Stat("/run/systemd/system"); err == nil && fi.IsDir() {
		add(levelOK, "service manager", "systemd")
	} else {
		add(levelWarn, "service manager", "no systemd - set SAMBA_MANAGER_SUPERVISE=true to let Samba Manager run smbd itself")
	}

	if _, err := os.Stat(cfg.Samba.ConfigPath); err != nil {
		add(levelWarn, "smb.conf", cfg.Samba.ConfigPath+" does not exist yet (a default is created on first start)")
	} else if system.HaveCommand("testparm") {
		if _, err := (system.ExecRunner{}).Run(context.Background(), "", "testparm", "--suppress-prompt", cfg.Samba.ConfigPath); err != nil {
			add(levelFail, "smb.conf", fmt.Sprintf("%s is invalid: %v", cfg.Samba.ConfigPath, err))
		} else {
			add(levelOK, "smb.conf", cfg.Samba.ConfigPath+" is valid")
		}
	}

	for _, root := range cfg.Samba.AllowedRoots {
		fi, err := os.Stat(root)
		if err != nil || !fi.IsDir() {
			add(levelWarn, "share root", root+" does not exist yet (created on first start)")
			continue
		}
		add(levelOK, "share root", root)
		if system.HaveCommand("setfacl") {
			tmp, err := os.MkdirTemp(root, ".acl-check-")
			if err != nil {
				add(levelWarn, "ACL support", "cannot write to "+root+": "+err.Error())
				continue
			}
			if _, err := (system.ExecRunner{}).Run(context.Background(), "", "setfacl", "-m", "u::rwx", tmp); err != nil {
				add(levelWarn, "ACL support", root+" does not support POSIX ACLs (mount with 'acl' or use Samba-only access mode)")
			} else {
				add(levelOK, "ACL support", root+" supports POSIX ACLs")
			}
			os.Remove(tmp)
		}
	}
	return out
}

func runDoctor(args []string) error {
	flags := flag.NewFlagSet("doctor", flag.ExitOnError)
	cfgPath := flags.String("config", "", "path to config.yaml")
	flags.Parse(args)
	cfg, _, err := config.Load(*cfgPath)
	if err != nil {
		return err
	}

	checks := runChecks(cfg)
	fails, warns := 0, 0
	for _, c := range checks {
		tag := "  OK  "
		switch c.level {
		case levelWarn:
			tag, warns = " WARN ", warns+1
		case levelFail:
			tag, fails = " FAIL ", fails+1
		}
		fmt.Printf("[%s] %-16s %s\n", tag, c.name, c.detail)
	}
	fmt.Println()
	if fails > 0 || warns > 0 {
		fmt.Println("To install the missing packages:")
		fmt.Println("  " + distroHint())
		fmt.Println()
	}
	if fails > 0 {
		return fmt.Errorf("%d required check(s) failed", fails)
	}
	if warns > 0 {
		fmt.Printf("Ready, with %d optional item(s) missing.\n", warns)
	} else {
		fmt.Println("All checks passed.")
	}
	return nil
}
