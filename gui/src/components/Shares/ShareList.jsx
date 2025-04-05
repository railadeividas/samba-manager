import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FolderIcon from '@mui/icons-material/Folder';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PersonIcon from '@mui/icons-material/Person';
import EditNoteIcon from '@mui/icons-material/EditNote';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CommentIcon from '@mui/icons-material/Comment';
import { deleteSection } from '../../services/configService';
import { useNotification } from '../../context/NotificationContext';
import ConfirmDialog from '../Common/ConfirmDialog';
import ShareUsage from './ShareUsage';

const ShareList = ({ shares, onEdit, onRefresh, loading, sharesSizeData }) => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareToDelete, setShareToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Convert shares object to array and sort by name
  const sharesList = Object.entries(shares).map(([name, config]) => ({
    name,
    ...config
  })).sort((a, b) => a.name.localeCompare(b.name));

  // Find share size info for a given share
  const findShareSizeInfo = (shareName, sharePath) => {
    if (!sharesSizeData || !sharesSizeData.length) return null;

    return sharesSizeData.find(
      shareSize => shareSize.name === shareName || shareSize.path === sharePath
    );
  };

  const handleDeleteClick = (share) => {
    setShareToDelete(share);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!shareToDelete) return;

    setDeleteLoading(true);
    try {
      await deleteSection(shareToDelete.name);
      showNotification(`Share "${shareToDelete.name}" deleted successfully`, 'success');
      onRefresh();
    } catch (error) {
      showNotification(`Failed to delete share: ${error.message}`, 'error');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setShareToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setShareToDelete(null);
  };

  // Format user list into a display element
  const formatUserList = (users, type = 'valid') => {
    if (!users) return null;

    const userList = users.split(/,\s*/).filter(user => user.trim());
    if (userList.length === 0) return null;

    const displayCount = 2;
    const displayUsers = userList.slice(0, displayCount).join(', ');
    const remainingCount = userList.length - displayCount;

    const label = type === 'valid' ? 'Valid users' : 'Write access';
    const icon = type === 'valid' ? <PersonIcon fontSize="small" sx={{ mr: 0.5 }} /> : <EditNoteIcon fontSize="small" sx={{ mr: 0.5 }} />;
    const tooltipTitle = type === 'valid'
      ? `Valid users: ${userList.join(', ')}`
      : `Write access: ${userList.join(', ')}`;

    const textColor = type === 'valid' ? 'primary.main' : 'success.main';

    return (
      <Tooltip title={tooltipTitle} placement="top">
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {icon}
          <Typography variant="body2" color={textColor} sx={{ fontWeight: 500 }}>
            {label}:
          </Typography>
          <Typography variant="body2" sx={{ ml: 0.5 }}>
            {remainingCount > 0
              ? `${displayUsers} +${remainingCount}`
              : displayUsers}
          </Typography>
        </Box>
      </Tooltip>
    );
  };

  if (sharesList.length === 0) {
    return (
      <Paper
        elevation={1}
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 2,
          textAlign: 'center'
        }}
      >
        <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          No Shares Available
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Create your first share to get started.
        </Typography>
      </Paper>
    );
  }

  return (
    <>
      <Paper
        elevation={1}
        sx={{
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <List sx={{ width: '100%', bgcolor: 'background.paper', p: 0 }}>
          {sharesList.map((share, index) => {
            const shareUsageInfo = findShareSizeInfo(share.name, share.path);
            const validUsersList = formatUserList(share['valid users'], 'valid');
            const writeListUsers = formatUserList(share['write list'], 'write');

            return (
              <React.Fragment key={share.name}>
                <ListItem
                  alignItems="flex-start"
                  sx={{
                    py: 1.5,
                    px: 2
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <FolderIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="subtitle1" component="span" fontWeight="500">
                          {share.name}
                        </Typography>
                        <Tooltip title={`Browseable: ${share.browseable || 'yes'}`}>
                          <Chip
                            icon={(share.browseable || 'yes') === 'yes' ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                            label={(share.browseable || 'yes') === 'yes' ? "Visible" : "Hidden"}
                            size="small"
                            color={(share.browseable || 'yes') === 'yes' ? 'primary' : 'default'}
                            variant="outlined"
                            sx={{ height: 24, fontSize: '0.75rem' }}
                          />
                        </Tooltip>
                        <Tooltip title={`Read-only: ${share['read only'] || 'no'}`}>
                          <Chip
                            icon={(share['read only'] || 'no') === 'no' ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                            label={(share['read only'] || 'no') === 'no' ? "Writable" : "Read-only"}
                            size="small"
                            color={(share['read only'] || 'no') === 'no' ? 'success' : 'error'}
                            variant="outlined"
                            sx={{ height: 24, fontSize: '0.75rem' }}
                          />
                        </Tooltip>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        {/* User Access Line */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 0.75 }}>
                          {validUsersList}
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 0.75 }}>
                          {writeListUsers}
                        </Box>

                        {/* Path and Comment Line */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                          <Typography variant="body2" component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                            <FolderOpenIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                            <Typography component="span" variant="body2" color="text.secondary">Path:&nbsp;</Typography>
                            {share.path || 'No path set'}
                          </Typography>

                          {share.comment && (
                            <Typography variant="body2" component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                              <CommentIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                              <Typography component="span" variant="body2" color="text.secondary">Comment:&nbsp;</Typography>
                              {share.comment}
                            </Typography>
                          )}
                        </Box>

                        {/* Share Usage Information */}
                        <ShareUsage shareSize={shareUsageInfo} />
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex' }}>
                      <IconButton
                        edge="end"
                        aria-label="edit"
                        onClick={() => onEdit(share.name, share)}
                        disabled={loading}
                        size="small"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleDeleteClick(share)}
                        disabled={loading || deleteLoading}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < sharesList.length - 1 && <Divider component="li" />}
              </React.Fragment>
            );
          })}
        </List>
      </Paper>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Share"
        message={
          <>
            <Typography variant="body1" gutterBottom>
              Are you sure you want to delete the share "{shareToDelete?.name}"?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Note: This action will only remove the share configuration. The actual files and directories will remain intact on the filesystem.
            </Typography>
          </>
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        loading={deleteLoading}
        confirmColor="error"
      />
    </>
  );
};

export default ShareList;
