import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Tooltip from '@mui/material/Tooltip';

const StatCard = ({
  title,
  value,
  subtext,
  icon,
  status,
  actionText,
  onAction,
  actionDisabled,
  additionalInfo
}) => {
  const getIcon = () => {
    switch (icon) {
      case 'shares':
        return <FolderSharedIcon sx={{ fontSize: 48, color: 'primary.main' }} />;
      case 'users':
        return <PeopleIcon sx={{ fontSize: 48, color: 'primary.main' }} />;
      case 'status':
        return status ?
          <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main' }} /> :
          <ErrorIcon sx={{ fontSize: 48, color: 'error.main' }} />;
      default:
        return <SettingsIcon sx={{ fontSize: 48, color: 'primary.main' }} />;
    }
  };

  return (
    <Paper
      elevation={1}
      sx={{
        p: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: 2
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h3" component="div" sx={{ fontWeight: 'bold' }}>
            {value}
          </Typography>
          {subtext && (
            <Typography variant="body2" color="text.secondary">
              {subtext}
            </Typography>
          )}
          {additionalInfo && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0 }}>
              <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} />
              <Tooltip title={`Service running since: ${additionalInfo.since}`} arrow>
                <Typography variant="body2" color="text.secondary">
                  Uptime: {additionalInfo.uptime}
                </Typography>
              </Tooltip>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {getIcon()}
        </Box>
      </Box>
      {actionText && (
        <Button
          variant="outlined"
          color="primary"
          onClick={onAction}
          disabled={actionDisabled}
          sx={{ mt: 2, alignSelf: 'flex-start' }}
        >
          {actionText}
        </Button>
      )}
    </Paper>
  );
};

export default StatCard;
