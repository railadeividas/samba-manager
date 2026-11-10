// Package smbconf reads and edits smb.conf while keeping comments and order.
package smbconf

import (
	"regexp"
	"sort"
	"strings"
)

// Param is one "key = value" line.
type Param struct {
	Key   string
	Value string
	Pre   []string // comments / blank lines directly above
	raw   []string // original physical lines, reused while unchanged
}

// Section is a [section] with its parameters.
type Section struct {
	Name   string
	Pre    []string // comments / blank lines above the header
	Params []*Param
	Meta   map[string]string // "# samba-manager:key=value" annotations
	Post   []string          // trailing comments (last section only)
}

// File is a parsed smb.conf.
type File struct {
	Preamble []string
	Sections []*Section
}

var (
	sectionRe = regexp.MustCompile(`^\[(.+)\]\s*$`)
	metaRe    = regexp.MustCompile(`^[#;]\s*samba-manager:([A-Za-z0-9_-]+)\s*=\s*(.*)$`)
)

// MetaPrefix marks comment lines that carry manager-only data.
const MetaPrefix = "# samba-manager:"

// NormKey normalises a parameter name the way Samba compares them.
func NormKey(k string) string {
	return strings.ToLower(strings.Join(strings.Fields(k), " "))
}

func sameName(a, b string) bool { return strings.EqualFold(strings.TrimSpace(a), strings.TrimSpace(b)) }

// Parse reads smb.conf text.
func Parse(content string) *File {
	f := &File{}
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	// A trailing newline produces one empty element we don't want.
	if n := len(lines); n > 0 && lines[n-1] == "" {
		lines = lines[:n-1]
	}

	var pending []string
	var cur *Section
	for i := 0; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)

		switch {
		case trimmed == "":
			pending = append(pending, line)
		case trimmed[0] == '#' || trimmed[0] == ';':
			if m := metaRe.FindStringSubmatch(trimmed); m != nil && cur != nil {
				if cur.Meta == nil {
					cur.Meta = map[string]string{}
				}
				cur.Meta[m[1]] = strings.TrimSpace(m[2])
				continue
			}
			pending = append(pending, line)
		default:
			if m := sectionRe.FindStringSubmatch(trimmed); m != nil {
				cur = &Section{Name: strings.TrimSpace(m[1])}
				if len(f.Sections) == 0 {
					f.Preamble = pending // lines above the first section
				} else {
					cur.Pre = pending
				}
				pending = nil
				f.Sections = append(f.Sections, cur)
				continue
			}
			// join "\" continuation lines
			raw := []string{line}
			joined := trimmed
			for strings.HasSuffix(joined, "\\") && i+1 < len(lines) {
				joined = strings.TrimSpace(strings.TrimSuffix(joined, "\\"))
				i++
				raw = append(raw, lines[i])
				joined += " " + strings.TrimSpace(lines[i])
			}
			eq := strings.Index(joined, "=")
			if eq < 0 || cur == nil {
				// not a parameter: keep it as a comment-like line
				pending = append(pending, raw...)
				continue
			}
			cur.Params = append(cur.Params, &Param{
				Key:   strings.TrimSpace(joined[:eq]),
				Value: strings.TrimSpace(joined[eq+1:]),
				Pre:   pending,
				raw:   raw,
			})
			pending = nil
		}
	}
	if cur == nil {
		f.Preamble = pending
	} else {
		cur.Post = pending
	}
	return f
}

// Render writes the file back out.
func (f *File) Render() string {
	var b strings.Builder
	w := func(lines ...string) {
		for _, l := range lines {
			b.WriteString(l)
			b.WriteByte('\n')
		}
	}
	w(f.Preamble...)
	for i, s := range f.Sections {
		if len(s.Pre) == 0 && (i > 0 || len(f.Preamble) > 0) {
			// make sure sections are separated by a blank line
			last := ""
			if i > 0 {
				prev := f.Sections[i-1]
				if len(prev.Post) > 0 {
					last = prev.Post[len(prev.Post)-1]
				} else if n := len(prev.Params); n > 0 {
					last = "x"
				}
			}
			if last != "" {
				w("")
			}
		}
		w(s.Pre...)
		w("[" + s.Name + "]")
		keys := make([]string, 0, len(s.Meta))
		for k := range s.Meta {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			w("    " + MetaPrefix + k + " = " + s.Meta[k])
		}
		for _, p := range s.Params {
			w(p.Pre...)
			if p.raw != nil {
				w(p.raw...)
			} else {
				w("    " + p.Key + " = " + p.Value)
			}
		}
		w(s.Post...)
	}
	return b.String()
}

// Section returns the named section (case-insensitive) or nil.
func (f *File) Section(name string) *Section {
	for _, s := range f.Sections {
		if sameName(s.Name, name) {
			return s
		}
	}
	return nil
}

// Get returns a parameter value (case/space-insensitive key).
func (s *Section) Get(key string) (string, bool) {
	nk := NormKey(key)
	val, ok := "", false
	for _, p := range s.Params {
		if NormKey(p.Key) == nk {
			val, ok = p.Value, true // last one wins, like Samba
		}
	}
	return val, ok
}

// Map returns the section's parameters as a map (original key spelling).
func (s *Section) Map() map[string]string {
	m := make(map[string]string, len(s.Params))
	for _, p := range s.Params {
		m[p.Key] = p.Value
	}
	return m
}

// ToMap returns all sections as name -> parameters.
func (f *File) ToMap() map[string]map[string]string {
	m := make(map[string]map[string]string, len(f.Sections))
	for _, s := range f.Sections {
		if existing, ok := m[s.Name]; ok {
			for k, v := range s.Map() {
				existing[k] = v
			}
			continue
		}
		m[s.Name] = s.Map()
	}
	return m
}

// SetSection replaces a section's parameters, creating the section if needed.
// Parameters that stay keep their position and comments; removed ones are
// dropped; new ones are appended in alphabetical order.
func (f *File) SetSection(name string, params map[string]string) *Section {
	s := f.Section(name)
	if s == nil {
		s = &Section{Name: name}
		f.Sections = append(f.Sections, s)
	}

	want := make(map[string]string, len(params))
	order := make([]string, 0, len(params))
	for k, v := range params {
		want[NormKey(k)] = v
		order = append(order, k)
	}
	sort.Strings(order)

	var kept []*Param
	used := map[string]bool{}
	for _, p := range s.Params {
		nk := NormKey(p.Key)
		v, ok := want[nk]
		if !ok || used[nk] {
			continue
		}
		used[nk] = true
		if p.Value != v {
			p.Value = v
			p.raw = nil
		}
		kept = append(kept, p)
	}
	for _, k := range order {
		nk := NormKey(k)
		if used[nk] {
			continue
		}
		used[nk] = true
		kept = append(kept, &Param{Key: k, Value: want[nk]})
	}
	s.Params = kept
	return s
}

// SetParam sets one parameter, keeping the others.
func (f *File) SetParam(section, key, value string) {
	s := f.Section(section)
	if s == nil {
		s = &Section{Name: section}
		f.Sections = append(f.Sections, s)
	}
	nk := NormKey(key)
	for _, p := range s.Params {
		if NormKey(p.Key) == nk {
			if p.Value != value {
				p.Value = value
				p.raw = nil
			}
			return
		}
	}
	s.Params = append(s.Params, &Param{Key: key, Value: value})
}

// DeleteSection removes a section; it reports whether one existed.
func (f *File) DeleteSection(name string) bool {
	for i, s := range f.Sections {
		if sameName(s.Name, name) {
			// keep the section's leading comment block attached to the next one
			f.Sections = append(f.Sections[:i], f.Sections[i+1:]...)
			return true
		}
	}
	return false
}
