import api from './api';

/** Server information: version, allowed share roots, capabilities, warnings. */
export const getInfo = async () => (await api.get('/info')).data;

/** Change the web UI admin password. */
export const changeAdminPassword = async (current, next) =>
  (await api.post('/auth/password', { current, new: next })).data;

/** Connected SMB sessions, share connections and open file count. */
export const getSessions = async () => (await api.get('/sessions')).data;

/** Tail of a Samba log file. */
export const getLogs = async (file, lines = 200) => {
  const params = { lines };
  if (file) params.file = file;
  return (await api.get('/logs', { params })).data;
};

/** Reload smb.conf without disconnecting clients. */
export const reloadService = async () => (await api.post('/reload')).data;

/** Saved copies of smb.conf, newest first. */
export const listBackups = async () => (await api.get('/config/backups')).data;

export const getBackup = async (name) =>
  (await api.get(`/config/backups/${encodeURIComponent(name)}`)).data;

export const restoreBackup = async (name) =>
  (await api.post(`/config/backups/${encodeURIComponent(name)}/restore`)).data;
