import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import StorageIcon from '@mui/icons-material/Storage';

const FilesystemCard = ({ filesystemInfo }) => {
  if (!filesystemInfo) return null;

  // Function to determine color based on usage percentage
  const getColorByUsage = (percent) => {
    if (percent < 70) return 'success';
    if (percent < 90) return 'warning';
    return 'error';
  };

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        height: '100%',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Tooltip title={filesystemInfo.mountedOn} placement="top">
              <Typography variant="h6" component="div">
                {filesystemInfo.displayName || filesystemInfo.mountedOn}
              </Typography>
            </Tooltip>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {filesystemInfo.filesystem}
          </Typography>
        </Box>
        <StorageIcon sx={{ fontSize: 36, color: 'primary.main' }} />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2">
            {`${filesystemInfo.used} / ${filesystemInfo.size} (${filesystemInfo.usePercent}%)`}
          </Typography>
          <Typography variant="body2">
            {`Available: ${filesystemInfo.available}`}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={filesystemInfo.usePercent}
          color={getColorByUsage(filesystemInfo.usePercent)}
          sx={{
            height: 8,
            borderRadius: 4,
            '& .MuiLinearProgress-bar': {
              borderRadius: 4
            }
          }}
        />
      </Box>
    </Paper>
  );
};

export default FilesystemCard;
