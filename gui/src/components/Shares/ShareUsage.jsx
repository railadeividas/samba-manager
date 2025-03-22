import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import StorageIcon from '@mui/icons-material/Storage';

const ShareUsage = ({ shareSize }) => {
  if (!shareSize) {
    return null;
  }

  // Function to determine color based on usage percentage
  const getColorByUsage = (percent) => {
    if (percent < 70) return 'success';
    if (percent < 90) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1.5, maxWidth: '100%' }}>
      <StorageIcon sx={{ color: 'text.secondary', fontSize: 18 }} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.2 }}>
          <Typography variant="body2" noWrap>
            {`${shareSize.used} used`}
          </Typography>
          <Tooltip title={`${shareSize.available} available on disk`}>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {`${Math.round(shareSize.usePercent)}%`}
            </Typography>
          </Tooltip>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(shareSize.usePercent, 100)} // Ensure we don't exceed 100%
          color={getColorByUsage(shareSize.usePercent)}
          sx={{
            height: 4,
            borderRadius: 2,
            '& .MuiLinearProgress-bar': {
              borderRadius: 2
            }
          }}
        />
      </Box>
    </Box>
  );
};

export default ShareUsage;
