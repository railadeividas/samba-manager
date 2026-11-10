// Samba Manager: a web UI and API for managing a Samba file server.
package main

import (
	"fmt"
	"os"
)

// version is set at build time: -ldflags "-X main.version=1.2.3".
var version = "dev"

const usage = `Samba Manager %s

Usage: samba-manager <command> [flags]

Commands:
  serve         Run the web UI and API (default)
  install       Install or upgrade the binary, config and systemd service
  uninstall     Remove the systemd service and binary (--purge also removes config and state)
  doctor        Check that everything Samba Manager needs is installed
  healthcheck   Exit 0 if a running instance (and Samba) is healthy
  version       Print the version

Run "samba-manager <command> -h" for the flags of a command.
`

func main() {
	cmd := "serve"
	args := os.Args[1:]
	if len(args) > 0 && len(args[0]) > 0 && args[0][0] != '-' {
		cmd, args = args[0], args[1:]
	}

	var err error
	switch cmd {
	case "serve":
		err = runServe(args)
	case "install":
		err = runInstall(args)
	case "uninstall":
		err = runUninstall(args)
	case "doctor":
		err = runDoctor(args)
	case "healthcheck":
		err = runHealthcheck(args)
	case "version", "--version":
		fmt.Println(version)
	case "help", "-h", "--help":
		fmt.Printf(usage, version)
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", cmd)
		fmt.Fprintf(os.Stderr, usage, version)
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
