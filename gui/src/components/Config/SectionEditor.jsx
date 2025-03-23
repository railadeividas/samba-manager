import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  IconButton,
  Tooltip,
  Divider,
  Paper,
  Button,
  CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import ConfirmDialog from '../Common/ConfirmDialog';
import LoadingSpinner from '../Common/LoadingSpinner';
import ConnectionError from '../Common/ConnectionError';
import { getSection, updateSection } from '../../services/configService';
import { useApi } from '../../services/useApi';
import { useNotification } from '../../context/NotificationContext';

/**
 * Reusable component for editing any Samba configuration section
 *
 * @param {Object} props
 * @param {string} props.sectionName - Name of the section to edit (e.g., 'global', 'homes')
 * @param {Object} props.paramDescriptions - Object with parameter descriptions for tooltips
 * @param {string} props.title - Title to display at the top of the editor
 * @param {string} props.description - Optional description text
 * @param {function} props.onSaved - Optional callback for when save is successful
 * @param {React.ReactNode} props.headerContent - Optional content to display in the header
 * @param {React.ReactNode} props.footerContent - Optional content to display in the footer
 * @param {React.ReactNode} props.renderCustomField - Optional function to render custom field UI
 * @param {boolean} props.disableParamRemoval - Optional flag to disable parameter removal
 * @param {boolean} props.disableParamAddition - Optional flag to disable parameter addition
 */
const SectionEditor = ({
  sectionName,
  paramDescriptions = {},
  title,
  description,
  onSaved,
  headerContent,
  footerContent,
  renderCustomField,
  disableParamRemoval = false,
  disableParamAddition = false
}) => {
  const { showNotification } = useNotification();
  const [sectionData, setSectionData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [newParam, setNewParam] = useState({ key: '', value: '' });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Use the API hook to fetch the section data
  const {
    data,
    loading,
    error,
    isConnectionError,
    fetchData: fetchSection,
    forceRetry: retryFetch
  } = useApi(() => getSection(sectionName));

  // Update section data when API data changes
  useEffect(() => {
    if (data) {
      setSectionData(data);
      setOriginalData(JSON.parse(JSON.stringify(data))); // Deep copy
      setHasChanges(false);
    }
  }, [data]);

  // Parameter change handler
  const handleParamChange = (key, value) => {
    setSectionData(prev => {
      const updated = { ...prev, [key]: value };
      setHasChanges(true);
      return updated;
    });
  };

  // Delete parameter handler
  const handleDeleteParam = (key) => {
    if (disableParamRemoval) return;

    setSectionData(prev => {
      const updated = { ...prev };
      delete updated[key];
      setHasChanges(true);
      return updated;
    });
  };

  // Add parameter handler
  const handleAddParam = () => {
    if (disableParamAddition || !newParam.key.trim()) return;

    setSectionData(prev => {
      const updated = { ...prev, [newParam.key]: newParam.value };
      setHasChanges(true);
      return updated;
    });

    setNewParam({ key: '', value: '' });
  };

  // Refresh handler
  const handleRefresh = () => {
    fetchSection(true);
  };

  // Save handler
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      await updateSection(sectionName, sectionData);
      showNotification(`${title || sectionName} configuration saved successfully`, 'success');
      setOriginalData(JSON.parse(JSON.stringify(sectionData))); // Deep copy
      setHasChanges(false);

      // Call onSaved callback if provided
      if (onSaved) {
        onSaved(sectionData);
      }
    } catch (error) {
      console.error(`Failed to save ${sectionName} configuration:`, error);

      if (error.isConnectionError) {
        showNotification('Connection failed. Unable to save configuration.', 'error');
      } else {
        showNotification(`Failed to save configuration: ${error.message || 'Something went wrong'}`, 'error');
      }

      setSaveError(error.message || 'Failed to save configuration');
    } finally {
      // Wait a moment before enabling the button again to ensure UI feedback
      setTimeout(() => {
        setSaving(false);
        setConfirmOpen(false);
      }, 500);
    }
  };

  // If there's a connection error, show the ConnectionError component
  if (isConnectionError) {
    return <ConnectionError error={error} onRetry={retryFetch} />;
  }

  if (loading && !data) {
    return <LoadingSpinner message={`Loading ${sectionName} configuration...`} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 2,
      }}>
        <Typography variant="h6">
          {title || `${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)} Configuration`}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading || saving}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={() => setConfirmOpen(true)}
            disabled={loading || saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Box>

      {description && (
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            p: 2,
            mb: 3,
            bgcolor: 'info.50',
            borderColor: 'info.light'
          }}
        >
          <Typography variant="body2">{description}</Typography>
        </Paper>
      )}

      {headerContent}

      <Paper
        elevation={1}
        sx={{
          p: 2,
          flex: 1,
          minHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          {Object.entries(sectionData).map(([key, value]) => (
            <Grid container item spacing={2} alignItems="center" key={key}>
              <Grid item xs={12} sm={4} md={3}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <TextField
                    fullWidth
                    label="Parameter"
                    value={key}
                    disabled
                    size="small"
                    variant="outlined"
                  />
                  {paramDescriptions[key] && (
                    <Tooltip title={paramDescriptions[key]}>
                      <IconButton size="small">
                        <InfoIcon fontSize="small" color="info" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} sm={7} md={8}>
                {renderCustomField ? (
                  renderCustomField(key, value, (newValue) => handleParamChange(key, newValue))
                ) : (
                  <TextField
                    fullWidth
                    label="Value"
                    value={value}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Grid>
              <Grid item xs={12} sm={1} md={1}>
                <IconButton
                  color="error"
                  onClick={() => handleDeleteParam(key)}
                  disabled={loading || saving || disableParamRemoval}
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Grid>
            </Grid>
          ))}

          {!disableParamAddition && (
            <Grid container item spacing={2} alignItems="center">
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  fullWidth
                  label="New Parameter"
                  value={newParam.key}
                  onChange={(e) => setNewParam(prev => ({ ...prev, key: e.target.value }))}
                  placeholder="Enter parameter name"
                  size="small"
                  variant="outlined"
                  disabled={loading || saving}
                />
              </Grid>
              <Grid item xs={12} sm={7} md={8}>
                <TextField
                  fullWidth
                  label="Value"
                  value={newParam.value}
                  onChange={(e) => setNewParam(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="Enter parameter value"
                  size="small"
                  variant="outlined"
                  disabled={loading || saving}
                />
              </Grid>
              <Grid item xs={12} sm={1} md={1}>
                <IconButton
                  color="primary"
                  onClick={handleAddParam}
                  disabled={!newParam.key.trim() || loading || saving}
                  size="small"
                >
                  <AddIcon />
                </IconButton>
              </Grid>
            </Grid>
          )}
        </Grid>
      </Paper>

      {footerContent}

      <ConfirmDialog
        open={confirmOpen}
        title={`Save ${title || sectionName} Configuration`}
        message="Are you sure you want to save changes to the configuration? This will restart the Samba service and could affect active connections."
        confirmText={saving ? "Saving..." : "Save & Restart"}
        confirmColor="warning"
        onConfirm={handleSave}
        onCancel={() => !saving && setConfirmOpen(false)}
        disableConfirm={saving}
        disableCancel={saving}
      />
    </Box>
  );
};

export default SectionEditor;
