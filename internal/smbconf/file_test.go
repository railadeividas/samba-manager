package smbconf

import (
	"strings"
	"testing"
)

const sample = `# top comment
[global]
   workgroup = WORKGROUP
   # keep this comment
   server string = Test \
      continued

[data]
    # samba-manager:access = samba
   path = /srv/samba/data
   Valid Users = alice, @team
`

func TestParseRenderRoundTrip(t *testing.T) {
	f := Parse(sample)
	if got := f.Render(); got != sample {
		t.Fatalf("round trip changed the file:\n--- got\n%s\n--- want\n%s", got, sample)
	}
}

func TestParseValues(t *testing.T) {
	f := Parse(sample)
	g := f.Section("GLOBAL")
	if g == nil {
		t.Fatal("section lookup must be case-insensitive")
	}
	if v, _ := g.Get("server string"); v != "Test continued" {
		t.Errorf("continuation not joined: %q", v)
	}
	d := f.Section("data")
	if v, ok := d.Get("valid users"); !ok || v != "alice, @team" {
		t.Errorf("case-insensitive key lookup failed: %q %v", v, ok)
	}
	if d.Meta["access"] != "samba" {
		t.Errorf("meta not parsed: %v", d.Meta)
	}
	m := f.ToMap()
	if m["data"]["path"] != "/srv/samba/data" {
		t.Errorf("ToMap: %v", m)
	}
}

func TestSetSectionKeepsCommentsAndOrder(t *testing.T) {
	f := Parse(sample)
	f.SetSection("global", map[string]string{"workgroup": "HOME", "server string": "Test continued", "log level": "1"})
	out := f.Render()
	for _, want := range []string{"# keep this comment", "workgroup = HOME", "log level = 1", "# top comment"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
	// unchanged parameter keeps its original multi-line form
	if !strings.Contains(out, "server string = Test \\\n      continued") {
		t.Errorf("unchanged parameter was rewritten:\n%s", out)
	}
	if strings.Index(out, "workgroup") > strings.Index(out, "log level") {
		t.Error("existing keys must stay before new keys")
	}
}

func TestSetSectionRemovesAndAdds(t *testing.T) {
	f := Parse(sample)
	f.SetSection("data", map[string]string{"path": "/srv/samba/other"})
	f.SetSection("new", map[string]string{"path": "/srv/samba/new", "read only": "yes"})
	out := f.Render()
	if strings.Contains(out, "Valid Users") {
		t.Error("removed key still present")
	}
	if !strings.Contains(out, "# samba-manager:access = samba") {
		t.Error("meta must survive SetSection")
	}
	if !strings.Contains(out, "\n[new]\n    path = /srv/samba/new\n    read only = yes\n") {
		t.Errorf("new section not rendered properly:\n%s", out)
	}
	again := Parse(out)
	if again.Section("new") == nil || again.Section("data") == nil {
		t.Error("output does not parse back")
	}
}

func TestDeleteSection(t *testing.T) {
	f := Parse(sample)
	if !f.DeleteSection("DATA") {
		t.Fatal("delete failed")
	}
	if f.DeleteSection("data") {
		t.Error("second delete should report false")
	}
	out := f.Render()
	if strings.Contains(out, "[data]") || strings.Contains(out, "/srv/samba/data") {
		t.Errorf("section not fully removed:\n%s", out)
	}
	if !strings.Contains(out, "[global]") {
		t.Error("other sections must remain")
	}
}

func TestSetMetaRoundTrip(t *testing.T) {
	f := Parse("[global]\n   a = b\n")
	s := f.SetSection("share", map[string]string{"path": "/x"})
	s.Meta = map[string]string{"access": "acl", "owner": "bob"}
	again := Parse(f.Render())
	if got := again.Section("share").Meta; got["access"] != "acl" || got["owner"] != "bob" {
		t.Errorf("meta lost: %v", got)
	}
}

func TestEmptyAndCRLF(t *testing.T) {
	if Parse("").Render() != "" {
		t.Error("empty file")
	}
	f := Parse("[global]\r\n  a = b\r\n")
	if v, _ := f.Section("global").Get("a"); v != "b" {
		t.Errorf("CRLF not handled: %q", v)
	}
}
