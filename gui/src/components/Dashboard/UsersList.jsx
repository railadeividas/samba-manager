import React from 'react';
import { useNavigate } from 'react-router-dom';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

const UsersList = ({ users = [], limit = 5 }) => {
  const navigate = useNavigate();

  // Sort users by name and limit
  const displayUsers = [...users]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit);

  const handleEditUser = (username) => {
    navigate('/users', { state: { action: 'edit', username } });
  };

  if (displayUsers.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No users available
        </Typography>
      </Box>
    );
  }

  return (
    <List sx={{ width: '100%', bgcolor: 'background.paper', p: 0 }}>
      {displayUsers.map((username) => (
        <ListItem
          key={username}
          secondaryAction={
            <IconButton edge="end" aria-label="edit" onClick={() => handleEditUser(username)}>
              <EditIcon />
            </IconButton>
          }
          divider
        >
          <ListItemAvatar>
            <Avatar sx={{ bgcolor: 'secondary.main' }}>
              <PersonIcon />
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={username}
            secondary="Samba user"
          />
        </ListItem>
      ))}

      {users.length > limit && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography
            component="span"
            variant="body2"
            color="primary"
            sx={{ cursor: 'pointer' }}
            onClick={() => navigate('/users')}
          >
            View all {users.length} users
          </Typography>
        </Box>
      )}
    </List>
  );
};

export default UsersList;
