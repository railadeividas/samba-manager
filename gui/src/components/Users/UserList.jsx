import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import KeyIcon from '@mui/icons-material/Key';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import FolderIcon from '@mui/icons-material/Folder';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import LinearProgress from '@mui/material/LinearProgress';
import { deleteUser, createUserHomeDirectory } from '../../services/usersService';
import { useNotification } from '../../context/NotificationContext';
import ConfirmDialog from '../Common/ConfirmDialog';
import HomeConflictDialog from './HomeConflictDialog';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import DialogContentText from '@mui/material/DialogContentText';

const UserList = ({ users, onChangePassword, onRefresh, loading }) => {
  const { showNotification } = useNotification();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmHomeDir, setConfirmHomeDir] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [userToCreateHomeDir, setUserToCreateHomeDir] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [creatingHomeDir, setCreatingHomeDir] = useState(false);
  const [deleteHome, setDeleteHome] = useState(false);
  const [homeConflict, setHomeConflict] = useState(null);

  const handleChangePasswordClick = (username) => {
    onChangePassword(username);
  };

  const handleDeleteClick = (username) => {
    setUserToDelete(username);
    setDeleteHome(false);
    setConfirmDelete(true);
  };

  const handleCreateHomeDirClick = (username) => {
    setUserToCreateHomeDir(username);
    setConfirmHomeDir(true);
  };

  const handleConfirmCreateHomeDirectory = async (existingHome = '') => {
    if (!userToCreateHomeDir) return;

    setCreatingHomeDir(true);
    try {
      await createUserHomeDirectory(userToCreateHomeDir, existingHome);
      showNotification(`Home directory ready for user "${userToCreateHomeDir}"`, 'success');
      setHomeConflict(null);
      setConfirmHomeDir(false);
      setUserToCreateHomeDir(null);
      onRefresh();
    } catch (error) {
      if (error.data?.code === 'home_conflict') {
        setConfirmHomeDir(false);
        setHomeConflict(error.data.data);
      } else {
        setHomeConflict(null);
        setConfirmHomeDir(false);
        setUserToCreateHomeDir(null);
        showNotification(`Failed to create home directory: ${error.message}`, 'error');
      }
    } finally {
      setCreatingHomeDir(false);
    }
  };

  const handleCancelCreateHomeDirectory = () => {
    setHomeConflict(null);
    setConfirmHomeDir(false);
    setUserToCreateHomeDir(null);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    try {
      await deleteUser(userToDelete, deleteHome);
      showNotification(`User "${userToDelete}" deleted successfully`, 'success');
      setConfirmDelete(false);
      setUserToDelete(null);
      onRefresh();
    } catch (error) {
      showNotification(`Failed to delete user: ${error.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete(false);
    setUserToDelete(null);
  };

  if (users.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No users available. Click "Add User" to create one.
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
        <Table sx={{ minWidth: 650 }} aria-label="users table">
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((username) => (
              <TableRow
                key={username}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                      <PersonIcon fontSize="small" />
                    </Avatar>
                    <Typography variant="body1" fontWeight="medium">
                      {username}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>Samba User</TableCell>
                <TableCell align="right">
                  <Tooltip title="Create Home Directory">
                    <IconButton
                      aria-label="create home directory"
                      color="secondary"
                      onClick={() => handleCreateHomeDirClick(username)}
                      disabled={loading || deleting || creatingHomeDir}
                    >
                      <FolderIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Change Password">
                    <IconButton
                      aria-label="change password"
                      color="primary"
                      onClick={() => handleChangePasswordClick(username)}
                      disabled={loading || deleting || creatingHomeDir}
                    >
                      <KeyIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete User">
                    <IconButton
                      aria-label="delete"
                      color="error"
                      onClick={() => handleDeleteClick(username)}
                      disabled={loading || deleting || creatingHomeDir}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete User"
        message={
          <>
            <DialogContentText>
              Are you sure you want to delete the user "{userToDelete}"? This action cannot be undone.
            </DialogContentText>
            <FormControlLabel
              sx={{ mt: 1 }}
              control={<Checkbox checked={deleteHome} onChange={(e) => setDeleteHome(e.target.checked)} color="error" />}
              label="Also delete the home directory and its files"
            />
            {!deleteHome && (
              <DialogContentText variant="caption" component="div">
                Otherwise the home directory is kept on disk.
              </DialogContentText>
            )}
          </>
        }
        confirmText="Delete"
        confirmColor="error"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      <ConfirmDialog
        open={confirmHomeDir}
        title="Create Home Directory"
        message={`Are you sure you want to create a home directory for user "${userToCreateHomeDir}"?`}
        confirmText="Create"
        confirmColor="secondary"
        onConfirm={() => handleConfirmCreateHomeDirectory()}
        onCancel={handleCancelCreateHomeDirectory}
        disableConfirm={creatingHomeDir}
      />

      <HomeConflictDialog
        open={Boolean(homeConflict)}
        username={userToCreateHomeDir}
        home={homeConflict}
        busy={creatingHomeDir}
        onChoose={(choice) => handleConfirmCreateHomeDirectory(choice)}
        onCancel={handleCancelCreateHomeDirectory}
      />
    </>
  );
};

export default UserList;
