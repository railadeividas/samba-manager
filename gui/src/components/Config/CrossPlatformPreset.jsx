import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import ConfirmDialog from '../Common/ConfirmDialog';
import { getSection, updateSection } from '../../services/configService';
import { getInfo } from '../../services/infoService';
import { useNotification } from '../../context/NotificationContext';
import { applyPreset } from '../../utils/crossPlatform';

const CrossPlatformPreset = () => {
  const { showNotification } = useNotification();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  React.useEffect(() => {
    getInfo().then((i) => setUnsupported(i.fruitSupported === false)).catch(() => {});
  }, []);

  const apply = async () => {
    setBusy(true);
    try {
      const current = (await getSection('global')) || {};
      await updateSection('global', applyPreset(current));
      showNotification('Cross-platform settings applied', 'success');
      setOpen(false);
      window.dispatchEvent(new CustomEvent('config-changed'));
    } catch (e) {
      showNotification(`Failed to apply settings: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 3, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 260 }}>
          <Typography variant="subtitle1" gutterBottom>Windows + macOS + Linux preset</Typography>
          <Typography variant="body2" color="text.secondary">
            Requires SMB2 or newer and enables Apple's compatibility module (Finder metadata, Time Machine) next to Windows
            and Linux access. Existing settings are kept.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => setOpen(true)} disabled={unsupported}>Apply preset</Button>
      </Box>
      {unsupported && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          The Samba module "vfs_fruit" is not installed on this server (Debian/Ubuntu: package samba-vfs-modules).
        </Alert>
      )}
      <ConfirmDialog
        open={open}
        title="Apply cross-platform settings"
        message="This updates the [global] section and reloads Samba. Existing connections stay open."
        confirmText={busy ? 'Applying…' : 'Apply'}
        onConfirm={apply}
        onCancel={() => !busy && setOpen(false)}
        disableConfirm={busy}
        disableCancel={busy}
      />
    </Paper>
  );
};

export default CrossPlatformPreset;
