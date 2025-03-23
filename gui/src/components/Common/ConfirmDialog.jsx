import React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import CircularProgress from '@mui/material/CircularProgress';

/**
 * Reusable confirmation dialog component
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {string} props.title - Dialog title
 * @param {string|React.ReactNode} props.message - Dialog message or content
 * @param {string} props.confirmText - Text for confirm button
 * @param {string} props.cancelText - Text for cancel button
 * @param {string} props.confirmColor - Color for confirm button
 * @param {function} props.onConfirm - Function to call when confirm is clicked
 * @param {function} props.onCancel - Function to call when cancel is clicked
 * @param {boolean} props.disableConfirm - Whether to disable the confirm button
 * @param {boolean} props.disableCancel - Whether to disable the cancel button
 * @param {string} props.maxWidth - Dialog max width
 * @param {boolean} props.fullWidth - Whether dialog should take full width
 */
const ConfirmDialog = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'error',
  onConfirm,
  onCancel,
  disableConfirm = false,
  disableCancel = false,
  maxWidth = "xs",
  fullWidth = false
}) => {
  // Check if we're loading based on confirm button being disabled and text
  const isLoading = disableConfirm && confirmText.toLowerCase().includes('...');

  return (
    <Dialog
      open={open}
      onClose={disableCancel ? undefined : onCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      maxWidth={maxWidth}
      fullWidth={fullWidth}
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {typeof message === 'string' ? (
          <DialogContentText id="confirm-dialog-description">
            {message}
          </DialogContentText>
        ) : (
          message
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onCancel}
          color="inherit"
          disabled={disableCancel}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant="contained"
          autoFocus
          disabled={disableConfirm}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
