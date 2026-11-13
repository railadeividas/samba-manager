import React, { useState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

const formatBytes = (n) => {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
};

/**
 * Shown when a user's home directory already exists and belongs to another
 * UID. The user decides: take the old files over, or delete them.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {string} props.username
 * @param {Object} props.home - { path, ownerUid, ownerName, entries, bytes, truncated }
 * @param {boolean} props.busy
 * @param {function} props.onChoose - called with 'adopt' or 'wipe'
 * @param {function} props.onCancel
 */
const HomeConflictDialog = ({ open, username, home, busy = false, onChoose, onCancel }) => {
  const [choice, setChoice] = useState('adopt');
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) {
      setChoice('adopt');
      setTyped('');
    }
  }, [open]);

  if (!home) return null;

  const owner = home.ownerName ? `${home.ownerName} (UID ${home.ownerUid})` : `UID ${home.ownerUid} (no such user)`;
  const wipe = choice === 'wipe';
  const canConfirm = !busy && (!wipe || typed === username);
  const size = `${home.entries}${home.truncated ? '+' : ''} items, ${formatBytes(home.bytes)}${home.truncated ? '+' : ''}`;

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Home directory already exists</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          <strong>{home.path}</strong> already exists and belongs to {owner}. It holds {size}.
          This usually happens when a user with the same name was deleted and its home was kept.
        </Typography>

        <FormControl>
          <RadioGroup value={choice} onChange={(e) => setChoice(e.target.value)}>
            <FormControlLabel
              value="adopt"
              control={<Radio />}
              label={`Keep the files: give them to "${username}"`}
            />
            <FormControlLabel
              value="wipe"
              control={<Radio color="error" />}
              label="Delete the old files and start with an empty home"
            />
          </RadioGroup>
        </FormControl>

        {wipe && (
          <>
            <Alert severity="warning" sx={{ mt: 2 }}>
              This permanently deletes everything in {home.path}. It cannot be undone.
            </Alert>
            <TextField
              fullWidth
              size="small"
              sx={{ mt: 2 }}
              label={`Type "${username}" to confirm`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCancel} color="inherit" disabled={busy}>Cancel</Button>
        <Button
          onClick={() => onChoose(choice)}
          variant="contained"
          color={wipe ? 'error' : 'primary'}
          disabled={!canConfirm}
        >
          {wipe ? 'Delete files and continue' : 'Keep files and continue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HomeConflictDialog;
