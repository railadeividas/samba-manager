import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import FolderIcon from '@mui/icons-material/Folder';
import Chip from '@mui/material/Chip';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { deleteShare } from '../../services/sharesService';
import { useNotification } from '../../context/NotificationContext';
import ConfirmDialog from '../Common/ConfirmDialog';

const ShareList = ({ shares, onEdit, onRefresh, loading }) => {
  const { showNotification } = useNotification();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareToDelete, setShareToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Convert shares object to array
  const sharesList = Object.entries(shares).map(([name, config]) => ({
    name,
    ...config
  }));

  const handleEditClick = (shareName, shareData) => {
    onEdit(shareName, shareData);
  };

  const handleDeleteClick = (shareName) => {
    setShareToDelete(shareName);
    setConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (!shareToDelete) return;

    setDeleting(true);
    try {
      await deleteShare(shareToDelete);
      showNotification(`Share "${shareToDelete}" deleted successfully`, 'success');
      setConfirmDelete(false);
      setShareToDelete(null);
      onRefresh();
    } catch (error) {
      showNotification(`Failed to delete share: ${error.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete(false);
    setShareToDelete(null);
  };

  if (sharesList.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No shares available. Click "Add Share" to create one.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <TableContainer component={Paper} sx={{ borderRadius: 2, position: 'relative' }}>
        {loading && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
        )}
        <Table sx={{ minWidth: 650 }} aria-label="shares table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Path</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sharesList.map((share) => (
              <TableRow
                key={share.name}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                      <FolderIcon />
                    </Avatar>
                    <Typography variant="body1" fontWeight="medium">
                    {share.name}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>{share.path || 'Not set'}</TableCell>
                <TableCell>{share.comment || 'No description'}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      label={`Browseable: ${share.browseable || 'yes'}`}
                      size="small"
                      color={(share.browseable || 'yes') === 'yes' ? 'primary' : 'default'}
                      variant="outlined"
                    />
                    <Chip
                      label={`Read-only: ${share['read only'] || 'no'}`}
                      size="small"
                      color={(share['read only'] || 'no') === 'no' ? 'success' : 'error'}
                      variant="outlined"
                    />
                    <Chip
                      label={`Guest: ${share['guest ok'] || 'no'}`}
                      size="small"
                      color={(share['guest ok'] || 'no') === 'yes' ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    aria-label="edit"
                    onClick={() => handleEditClick(share.name, share)}
                    disabled={loading || deleting}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    aria-label="delete"
                    color="error"
                    onClick={() => handleDeleteClick(share.name)}
                    disabled={loading || deleting}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Share"
        message={`Are you sure you want to delete the share "${shareToDelete}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
};

export default ShareList;
