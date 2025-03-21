import React from 'react';
import { useNavigate } from 'react-router-dom';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import FolderIcon from '@mui/icons-material/Folder';
import EditIcon from '@mui/icons-material/Edit';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

const SharesList = ({ shares, limit = 5 }) => {
  const navigate = useNavigate();

  // Convert shares object to array
  const sharesList = Object.entries(shares).map(([name, config]) => ({
    name,
    ...config
  }));

  // Sort by name and limit
  const displayShares = sharesList
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);

  const handleEditShare = (shareName) => {
    navigate('/shares', { state: { action: 'edit', shareName } });
  };

  if (displayShares.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No shares available
        </Typography>
      </Box>
    );
  }

  return (
    <List sx={{ width: '100%', bgcolor: 'background.paper', p: 0 }}>
      {displayShares.map((share) => (
        <ListItem
          key={share.name}
          secondaryAction={
            <IconButton edge="end" aria-label="edit" onClick={() => handleEditShare(share.name)}>
              <EditIcon />
            </IconButton>
          }
          divider
        >
          <ListItemAvatar>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <FolderIcon />
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={share.name}
            secondary={
              <React.Fragment>
                <Typography
                  sx={{ display: 'block' }}
                  component="span"
                  variant="body2"
                  color="text.primary"
                >
                  {share.path || 'No path set'}
                </Typography>
                <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
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
                </Box>
              </React.Fragment>
            }
          />
        </ListItem>
      ))}

      {sharesList.length > limit && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography
            component="span"
            variant="body2"
            color="primary"
            sx={{ cursor: 'pointer' }}
            onClick={() => navigate('/shares')}
          >
            View all {sharesList.length} shares
          </Typography>
        </Box>
      )}
    </List>
  );
};

export default SharesList;
