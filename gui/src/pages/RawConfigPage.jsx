import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Paper, Divider, CircularProgress } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import ConfirmDialog from '../components/Common/ConfirmDialog';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { getRawConfig, saveRawConfig } from '../services/rawConfigService';
import { useNotification } from '../context/NotificationContext';

const RawConfigPage = () => {
  const { showNotification } = useNotification();
  const [configContent, setConfigContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState('');

  // Load configuration on component mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await getRawConfig();
      setConfigContent(response.content);
      setOriginalContent(response.content);
      setHasChanges(false);
    } catch (error) {
      showNotification(`Failed to load configuration: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveRawConfig(configContent);
      showNotification('Configuration saved successfully', 'success');
      setOriginalContent(configContent);
      setHasChanges(false);
    } catch (error) {
      showNotification(`Failed to save configuration: ${error.message}`, 'error');
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  const handleContentChange = (e) => {
    setConfigContent(e.target.value);
    setHasChanges(e.target.value !== originalContent);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 2,
        pb: 1,
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
      }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'linear-gradient(45deg, #90caf9 10%, #64b5f6 90%)'
                : 'linear-gradient(45deg, #2196f3 30%, #1976d2 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mr: 2
          }}
        >
          Raw Configuration
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={loadConfig}
            disabled={loading || saving}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={() => setConfirmOpen(true)}
            disabled={loading || saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 3,
          bgcolor: 'warning.50',
          border: '1px solid',
          borderColor: 'warning.light'
        }}
      >
        <Typography variant="subtitle1" color="warning.main" gutterBottom>
          Warning: Advanced Configuration
        </Typography>
        <Typography variant="body2">
          Editing the raw Samba configuration file directly can cause issues if not done correctly.
          It's recommended to use the Shares, Users, and Groups interfaces for most configuration tasks.
          Changes made here will restart the Samba service.
        </Typography>
      </Paper>

      {loading ? (
        <LoadingSpinner message="Loading configuration..." />
      ) : (
        <Paper
          elevation={1}
          sx={{
            p: 2,
            borderRadius: 2,
            flex: 1,
            minHeight: '500px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            /etc/samba/smb.conf
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {/* Using a plain textarea for better control */}
          <textarea
            value={configContent}
            onChange={handleContentChange}
            style={{
              flex: '1',
              minHeight: '400px',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              resize: 'vertical',
              overflow: 'auto'
            }}
          />
        </Paper>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Save Configuration"
        message="Are you sure you want to save changes to the Samba configuration? This will restart the Samba service and could affect active connections."
        confirmText="Save & Restart"
        confirmColor="warning"
        onConfirm={handleSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </Box>
  );
};

export default RawConfigPage;
