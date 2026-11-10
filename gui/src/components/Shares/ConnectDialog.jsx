import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { connectInfo, isLocalHost } from '../../utils/connect';
import { useNotification } from '../../context/NotificationContext';

const CopyBlock = ({ label, value }) => {
  const { showNotification } = useNotification();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      showNotification('Copied to clipboard', 'success', 2000);
    } catch (e) {
      showNotification('Copy failed - select the text and copy it manually', 'warning');
    }
  };
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box
          component="pre"
          data-testid="connect-value"
          sx={{
            flex: 1, m: 0, p: 1.5, borderRadius: 1, overflowX: 'auto',
            bgcolor: 'action.hover', fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap',
          }}
        >
          {value}
        </Box>
        <Tooltip title="Copy">
          <IconButton size="small" onClick={copy} aria-label="copy"><ContentCopyIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

/** Shows how to open a share from Windows, macOS and Linux. */
const ConnectDialog = ({ open, shareName, onClose }) => {
  const [tab, setTab] = useState(0);
  const host = window.location.hostname;
  const info = connectInfo(host, shareName || '');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Connect to "{shareName}"</DialogTitle>
      <DialogContent>
        {isLocalHost(host) && (
          <Alert severity="info" sx={{ mb: 2 }}>
            You opened this page through "{host}". Replace it with the server's name or IP address on your network.
          </Alert>
        )}
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Windows" />
          <Tab label="macOS" />
          <Tab label="Linux" />
        </Tabs>

        {tab === 0 && (
          <>
            <Typography variant="body2" paragraph>
              Open File Explorer, paste this into the address bar and sign in with a Samba user from the Users page.
            </Typography>
            <CopyBlock label="Address" value={info.windows} />
            <CopyBlock label="Or map a drive (Command Prompt)" value={info.windowsNetUse} />
            <Typography variant="caption" color="text.secondary">
              Windows 11 does not allow guest logons by default, so use a named user.
            </Typography>
          </>
        )}
        {tab === 1 && (
          <>
            <Typography variant="body2" paragraph>
              In Finder choose <b>Go &gt; Connect to Server…</b> (⌘K), paste the address and sign in as a registered user.
            </Typography>
            <CopyBlock label="Address" value={info.mac} />
          </>
        )}
        {tab === 2 && (
          <>
            <Typography variant="body2" paragraph>
              File managers (Nautilus, Dolphin, Thunar…) accept the address under "Other Locations" / "Network".
            </Typography>
            <CopyBlock label="File manager address" value={info.linuxFiles} />
            <CopyBlock label="Or mount it from a terminal (needs cifs-utils)" value={info.linuxMount} />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConnectDialog;
