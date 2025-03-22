import React from 'react';
import { Paper, Typography, Button, AlertTitle } from '@mui/material';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import RefreshIcon from '@mui/icons-material/Refresh';

/**
 * A reusable component for displaying connection errors
 *
 * @param {Object} props - Component props
 * @param {string} props.error - Error message to display
 * @param {Function} props.onRetry - Function to call when retry button is clicked
 * @param {Object} props.sx - Additional styles to apply to the component
 * @returns {JSX.Element} - Connection error component
 */
const ConnectionError = ({ error, onRetry, sx = {} }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        textAlign: 'center',
        border: '1px solid',
        borderColor: 'error.light',
        borderRadius: 2,
        bgcolor: 'error.lighter',
        maxWidth: 600,
        mx: 'auto',
        mt: 4,
        ...sx
      }}
    >
      <SignalWifiOffIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
      <AlertTitle sx={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
        Connection Failed
      </AlertTitle>
      <Typography variant="body1" paragraph>
        {error || 'Unable to connect to server'}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        The application is unable to connect to the server. This could be due to network issues or the server might be down.
      </Typography>
      <Button
        variant="contained"
        color="primary"
        onClick={onRetry}
        startIcon={<RefreshIcon />}
      >
        Try Again
      </Button>
    </Paper>
  );
};

export default ConnectionError;
