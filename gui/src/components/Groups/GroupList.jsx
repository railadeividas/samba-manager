import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import GroupsIcon from '@mui/icons-material/Groups';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import LockIcon from '@mui/icons-material/Lock';
import { deleteGroup, addUserToGroup, removeUserFromGroup } from '../../services/groupsService';
import { useNotification } from '../../context/NotificationContext';
import ConfirmDialog from '../Common/ConfirmDialog';
import UserSelectorDialog from './UserSelectorDialog';

const GroupList = ({ groups, allUsers, onEdit, onRefresh, loading }) => {
  const { showNotification } = useNotification();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [removeUserDialogOpen, setRemoveUserDialogOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);

  const handleDeleteClick = (group) => {
    setGroupToDelete(group);
    setConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (!groupToDelete) return;

    setDeleting(true);
    try {
      await deleteGroup(groupToDelete.name);
      showNotification(`Group "${groupToDelete.name}" deleted successfully`, 'success');
      setConfirmDelete(false);
      setGroupToDelete(null);
      onRefresh();
    } catch (error) {
      showNotification(`Failed to delete group: ${error.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete(false);
    setGroupToDelete(null);
  };

  const handleAddUser = (group) => {
    setCurrentGroup(group);
    setAddUserDialogOpen(true);
  };

  const handleRemoveUser = (group) => {
    setCurrentGroup(group);
    setRemoveUserDialogOpen(true);
  };

  const handleAddUserSubmit = async (selectedUser) => {
    if (!currentGroup || !selectedUser) return;

    try {
      await addUserToGroup(currentGroup.name, selectedUser);
      showNotification(`User added to group successfully`, 'success');
      setAddUserDialogOpen(false);
      onRefresh();
    } catch (error) {
      showNotification(`Failed to add user to group: ${error.message}`, 'error');
    }
  };

  const handleRemoveUserSubmit = async (selectedUser) => {
    if (!currentGroup || !selectedUser) return;

    try {
      await removeUserFromGroup(currentGroup.name, selectedUser);
      showNotification(`User removed from group successfully`, 'success');
      setRemoveUserDialogOpen(false);
      onRefresh();
    } catch (error) {
      showNotification(`Failed to remove user from group: ${error.message}`, 'error');
    }
  };

  if (groups.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No groups available. Click "Add Group" to create one.
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
        <Table sx={{ minWidth: 650 }} aria-label="groups table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>GID</TableCell>
              <TableCell>Members</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group) => (
              <TableRow
                key={group.name}
                sx={{
                  '&:last-child td, &:last-child th': { border: 0 },
                  bgcolor: group.isSystem ? 'action.selected' : 'inherit'
                }}
              >
                <TableCell component="th" scope="row">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{
                      bgcolor: group.isSystem ? 'warning.main' : 'primary.main',
                      width: 32,
                      height: 32
                    }}>
                      {group.isSystem ? <LockIcon /> : <GroupsIcon />}
                    </Avatar>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {group.name}
                      </Typography>
                      {group.isSystem && (
                        <Typography variant="caption" color="warning.main">
                          System Group
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{group.gid}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {group.users && group.users.length > 0 ? (
                      group.users.map((user) => (
                        <Chip
                          key={user}
                          label={user}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No members
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Add User">
                    <IconButton
                      color="success"
                      onClick={() => handleAddUser(group)}
                      disabled={loading || deleting}
                    >
                      <PersonAddIcon />
                    </IconButton>
                  </Tooltip>

                  {group.users && group.users.length > 0 && (
                    <Tooltip title="Remove User">
                      <IconButton
                        color="warning"
                        onClick={() => handleRemoveUser(group)}
                        disabled={loading || deleting}
                      >
                        <PersonRemoveIcon />
                      </IconButton>
                    </Tooltip>
                  )}

                  {!group.isSystem && (
                    <Tooltip title="Delete Group">
                      <IconButton
                        color="error"
                        onClick={() => handleDeleteClick(group)}
                        disabled={loading || deleting}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}

                  {group.isSystem && (
                    <Tooltip title="System groups cannot be deleted">
                      <span>
                        <IconButton
                          color="error"
                          disabled={true}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Group"
        message={`Are you sure you want to delete the group "${groupToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Dialog for adding users to a group */}
      <UserSelectorDialog
        open={addUserDialogOpen}
        title={`Add User to ${currentGroup?.name || ''}`}
        users={allUsers.filter(user =>
          !currentGroup?.users.includes(user)
        )}
        onClose={() => setAddUserDialogOpen(false)}
        onSubmit={handleAddUserSubmit}
      />

      {/* Dialog for removing users from a group */}
      <UserSelectorDialog
        open={removeUserDialogOpen}
        title={`Remove User from ${currentGroup?.name || ''}`}
        users={currentGroup?.users.map(username => ({name: username})) || []}
        onClose={() => setRemoveUserDialogOpen(false)}
        onSubmit={handleRemoveUserSubmit}
      />
    </>
  );
};

export default GroupList;
