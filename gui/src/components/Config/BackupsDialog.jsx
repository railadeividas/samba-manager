import React, { useEffect, useState, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { listBackups, getBackup, restoreBackup } from '../../services/infoService';
import { useNotification } from '../../context/NotificationContext';

/** Lists saved copies of smb.conf (one is made before every change) and restores one. */
const BackupsDialog = ({ open, onClose, onRestored }) => {
  const { showNotification } = useNotification();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBackups();
      setBackups(data.backups || []);
    } catch (e) {
      showNotification(`Failed to load backups: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setPreview('');
      load();
    }
  }, [open, load]);

  const select = async (name) => {
    setSelected(name);
    setPreview('Loading…');
    try {
      setPreview((await getBackup(name)).content);
    } catch (e) {
      setPreview(`Cannot read backup: ${e.message}`);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      await restoreBackup(selected);
      showNotification(`Restored ${selected}`, 'success');
      onRestored && onRestored();
      onClose();
    } catch (e) {
      showNotification(`Restore failed: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Configuration backups</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          A copy of smb.conf is saved automatically before every change. Restoring one also saves the current file first.
        </Alert>
        {loading ? (
          <Box sx={{ textAlign: 'center', p: 3 }}><CircularProgress size={28} /></Box>
        ) : backups.length === 0 ? (
          <Typography color="text.secondary">No backups yet.</Typography>
        ) : (
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
            <List dense sx={{ width: { md: 280 }, maxHeight: 360, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
              {backups.map((b) => (
                <ListItem key={b.name} button selected={b.name === selected} onClick={() => select(b.name)}>
                  <ListItemText
                    primary={new Date(b.time).toLocaleString()}
                    secondary={`${b.size} bytes`}
                  />
                </ListItem>
              ))}
            </List>
            <Box
              component="pre"
              sx={{ flex: 1, m: 0, p: 1.5, maxHeight: 360, overflow: 'auto', bgcolor: 'action.hover', borderRadius: 1, fontSize: '0.8rem' }}
            >
              {selected ? preview : 'Select a backup to preview it.'}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        <Button variant="contained" color="warning" onClick={restore} disabled={!selected || busy}>
          {busy ? 'Restoring…' : 'Restore selected'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BackupsDialog;
