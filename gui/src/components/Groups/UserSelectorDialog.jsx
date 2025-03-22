import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Radio from '@mui/material/Radio';
import Avatar from '@mui/material/Avatar';
import PersonIcon from '@mui/icons-material/Person';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';

const UserSelectorDialog = ({ open, title, users, onSubmit, onClose }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleUserSelect = (user) => {
    setSelectedUser(user.name || user);
  };

  const handleSubmit = () => {
    if (selectedUser) {
      onSubmit(selectedUser);
    }
  };

  const handleClose = () => {
    setSelectedUser(null);
    setSearchQuery('');
    onClose();
  };

  // Filter users based on search query
  const filteredUsers = searchQuery
    ? users.filter(user =>
        (user.name || user).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {filteredUsers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No users available
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: 350, overflow: 'auto' }}>
            {filteredUsers.map((user) => (
              <ListItem
                key={user.name || user}
                button
                onClick={() => handleUserSelect(user)}
                selected={selectedUser === (user.name || user)}
              >
                <Radio
                  checked={selectedUser === (user.name || user)}
                  onChange={() => handleUserSelect(user)}
                />
                <ListItemAvatar>
                  <Avatar>
                    <PersonIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary={user.name || user} />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">Cancel</Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          variant="contained"
          disabled={!selectedUser}
        >
          Select
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserSelectorDialog;
