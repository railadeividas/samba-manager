package api

import (
	"net/http"
	"strings"

	"samba-manager/internal/smbconf"
	"samba-manager/internal/system"
)

// ConfigResponse is the body for configuration reads/writes.
type ConfigResponse struct {
	Config map[string]map[string]string `json:"config"`
	Error  string                       `json:"error,omitempty"`
}

// RawConfigResponse carries the raw smb.conf text.
type RawConfigResponse struct {
	Content string `json:"content"`
	Error   string `json:"error,omitempty"`
}

func validateSection(name string, params map[string]string) error {
	if strings.TrimSpace(name) == "" || strings.ContainsAny(name, "[]\r\n\x00") {
		return badRequest("invalid section name %q", name)
	}
	for k, v := range params {
		if err := system.ValidateParamKey(k); err != nil {
			return badRequest("%v", err)
		}
		if err := system.ValidateParamValue(v); err != nil {
			return badRequest("%v", err)
		}
	}
	return nil
}

func (s *Server) getConfig(w http.ResponseWriter, r *http.Request) error {
	f, err := s.Store.Read()
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, ConfigResponse{Config: f.ToMap()})
	return nil
}

func (s *Server) getSection(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	f, err := s.Store.Read()
	if err != nil {
		return err
	}
	section := map[string]string{}
	if sec := f.Section(name); sec != nil {
		section = sec.Map()
	}
	writeJSON(w, http.StatusOK, map[string]map[string]string{name: section})
	return nil
}

func (s *Server) updateSection(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	var body map[string]map[string]string
	if err := decode(w, r, &body); err != nil {
		return err
	}
	section, exists := body[name]
	if !exists {
		return badRequest("Section data not found in request")
	}
	if err := validateSection(name, section); err != nil {
		return err
	}
	err := s.Store.Update(r.Context(), func(f *smbconf.File) error {
		f.SetSection(name, section)
		return nil
	})
	if err != nil {
		return err
	}
	ok(w, "Section '"+name+"' updated successfully", s.reload(r.Context()))
	return nil
}

func (s *Server) updateConfig(w http.ResponseWriter, r *http.Request) error {
	var req ConfigResponse
	if err := decode(w, r, &req); err != nil {
		return err
	}
	for name, params := range req.Config {
		if err := validateSection(name, params); err != nil {
			return err
		}
	}
	err := s.Store.Update(r.Context(), func(f *smbconf.File) error {
		for name, params := range req.Config {
			f.SetSection(name, params)
		}
		return nil
	})
	if err != nil {
		return err
	}
	ok(w, "Configuration updated successfully", s.reload(r.Context()))
	return nil
}

func (s *Server) deleteSection(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	if strings.EqualFold(name, "global") {
		return forbidden("The [global] section cannot be deleted")
	}
	err := s.Store.Update(r.Context(), func(f *smbconf.File) error {
		if !f.DeleteSection(name) {
			return notFound("Section '%s' not found", name)
		}
		return nil
	})
	if err != nil {
		return err
	}
	ok(w, "Section '"+name+"' deleted successfully", s.reload(r.Context()))
	return nil
}

func (s *Server) getRawConfig(w http.ResponseWriter, r *http.Request) error {
	content, err := s.Store.ReadRaw()
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, RawConfigResponse{Content: content})
	return nil
}

func (s *Server) saveRawConfig(w http.ResponseWriter, r *http.Request) error {
	var req RawConfigResponse
	if err := decode(w, r, &req); err != nil {
		return err
	}
	if strings.TrimSpace(req.Content) == "" {
		return badRequest("Configuration must not be empty")
	}
	if err := s.Store.WriteRaw(r.Context(), req.Content); err != nil {
		return err
	}
	ok(w, "Configuration saved successfully", s.reload(r.Context()))
	return nil
}

func (s *Server) listBackups(w http.ResponseWriter, r *http.Request) error {
	list, err := s.Store.ListBackups()
	if err != nil {
		return err
	}
	if list == nil {
		list = []smbconf.Backup{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"backups": list})
	return nil
}

func (s *Server) getBackup(w http.ResponseWriter, r *http.Request) error {
	content, err := s.Store.ReadBackup(r.PathValue("name"))
	if err != nil {
		return notFound("Backup not found")
	}
	writeJSON(w, http.StatusOK, RawConfigResponse{Content: content})
	return nil
}

func (s *Server) restoreBackup(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	if _, err := s.Store.ReadBackup(name); err != nil {
		return notFound("Backup not found")
	}
	if err := s.Store.RestoreBackup(r.Context(), name); err != nil {
		return err
	}
	ok(w, "Configuration restored from "+name, s.reload(r.Context()))
	return nil
}
