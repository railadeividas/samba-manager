import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Badge from '@mui/material/Badge';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import FolderIcon from '@mui/icons-material/Folder';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import LockIcon from '@mui/icons-material/Lock';
import { getShareACLs } from '../../services/configService';
import { useNotification } from '../../context/NotificationContext';

const ShareACLDialog = ({ open, shareName, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [aclData, setAclData] = useState(null);
  const [showAllACLs, setShowAllACLs] = useState(false);
  const { showNotification } = useNotification();

  useEffect(() => {
    if (open && shareName) {
      loadACLData();
    }
  }, [open, shareName]);

  const loadACLData = async () => {
    setLoading(true);
    try {
      const data = await getShareACLs(shareName);
      setAclData(data);
    } catch (error) {
      showNotification(`Failed to load ACL data: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to render permission chip
  const renderPermissionChip = (permission) => {
    // Map permission string to readable format and color
    const permMap = {
      'r': { text: 'Read', color: 'primary' },
      'w': { text: 'Write', color: 'success' },
      'x': { text: 'Execute', color: 'secondary' }
    };

    return (
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {permission.split('').map((p, index) => {
          if (p === '-') return null; // Skip dashes
          return permMap[p] ? (
            <Chip
              key={index}
              label={permMap[p].text}
              color={permMap[p].color}
              size="small"
              variant="outlined"
            />
          ) : null;
        })}
      </Box>
    );
  };

  const renderAclType = (type) => {
    const isGroup = type === 'group';
    return (
      <Chip
        icon={isGroup ? <GroupsIcon /> : <PersonIcon />}
        label={isGroup ? 'Group' : 'User'}
        color={isGroup ? 'warning' : 'info'}
        size="small"
        variant="outlined"
      />
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <LockIcon sx={{ mr: 1 }} />
          ACL Permissions for {shareName}
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : !aclData ? (
          <Typography variant="body1" color="text.secondary" sx={{ p: 2 }}>
            No ACL data available for this share.
          </Typography>
        ) : (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Directory Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FolderIcon color="primary" />
                      <Typography variant="body2">
                        <strong>Path:</strong> {aclData.path}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon color="primary" />
                      <Typography variant="body2">
                        <strong>Owner:</strong> {aclData.owner || 'Unknown'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GroupsIcon color="primary" />
                      <Typography variant="body2">
                        <strong>Group:</strong> {aclData.group || 'Unknown'}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="medium">
                User & Group Permissions
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={showAllACLs}
                    onChange={(e) => setShowAllACLs(e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography variant="body2">Show Default ACLs</Typography>}
              />
            </Box>

            {!aclData.entries || aclData.entries.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No specific user or group permissions have been set.
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Type</strong></TableCell>
                      <TableCell><strong>Name</strong></TableCell>
                      <TableCell><strong>Permissions</strong></TableCell>
                      <TableCell><strong>Scope</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {aclData.entries
                      .filter(entry => showAllACLs || !entry.default)
                      .map((entry, index) => (
                        <TableRow key={index}>
                          <TableCell>{renderAclType(entry.type)}</TableCell>
                          <TableCell>{entry.user}</TableCell>
                          <TableCell>{renderPermissionChip(entry.permission)}</TableCell>
                          <TableCell>
                            {entry.default ? (
                              <Chip label="New Files (Default)" color="info" size="small" variant="outlined" />
                            ) : (
                              <Chip label="Existing Files" color="default" size="small" variant="outlined" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
              These ACLs are automatically set based on the "valid users" and "write list" settings in your share configuration.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">Close</Button>
        {!loading && aclData && (
          <Button onClick={loadACLData} color="primary">Refresh</Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ShareACLDialog;
