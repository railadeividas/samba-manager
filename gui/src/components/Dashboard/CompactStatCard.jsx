import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Tooltip from '@mui/material/Tooltip';

const CompactStatCard = ({
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
        p: 2,
        height: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 2
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box
          sx={{
            bgcolor: icon === 'status' ? (status ? 'success.lighter' : 'error.lighter') : 'primary.lighter',
            p: 1.5,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 2
          }}
        >
          {getIcon()}
        </Box>

        <Box>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h6" component="div" fontWeight="medium">
            {value}
          </Typography>
          {additionalInfo && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5, fontSize: 14 }} />
              <Tooltip title={`Service running since: ${additionalInfo.since}`} arrow>
                <Typography variant="caption" color="text.secondary">
                  {additionalInfo.uptime}
                </Typography>
              </Tooltip>
            </Box>
          )}
        </Box>
      </Box>

      {actionText && (
        icon === 'status' ? (
          <Button
            variant="outlined"
            color="primary"
            size="small"
            onClick={onAction}
            disabled={actionDisabled}
          >
            {actionText}
          </Button>
        ) : (
          <Tooltip title={actionText}>
            <IconButton
              color="primary"
              size="small"
              onClick={onAction}
              disabled={actionDisabled}
            >
              <ArrowForwardIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )
      )}
    </Paper>
  );
};

export default CompactStatCard;
