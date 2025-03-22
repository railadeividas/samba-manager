import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import PeopleIcon from '@mui/icons-material/People';
import GroupsIcon from '@mui/icons-material/Groups';
import CodeIcon from '@mui/icons-material/Code';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useApp } from '../../context/AppContext';

// Import version from package.json
import packageInfo from '../../../package.json';
const appVersion = packageInfo.version;

// Get build date - this will be the date when the app is built
const buildDate = process.env.REACT_APP_BUILD_DATE || new Date().toISOString().split('T')[0];

const Sidebar = () => {
  const { sidebarOpen } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Shares', icon: <FolderSharedIcon />, path: '/shares' },
    { text: 'Users', icon: <PeopleIcon />, path: '/users' },
    { text: 'Groups', icon: <GroupsIcon />, path: '/groups' },
    { text: 'Raw Config', icon: <CodeIcon />, path: '/config' },
  ];

  const drawerWidth = sidebarOpen ? 240 : 64;

  return (
    <Drawer
      variant="permanent"
      anchor="left"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid rgba(0, 0, 0, 0.12)',
          transition: (theme) => theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Toolbar /> {/* This creates space for the app bar */}
      <Divider />
      <List disablePadding sx={{ flexGrow: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{
                minHeight: 48,
                justifyContent: sidebarOpen ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: sidebarOpen ? 3 : 'auto',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{
                  opacity: sidebarOpen ? 1 : 0,
                  whiteSpace: 'nowrap',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {/* Version information at the bottom */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid rgba(0, 0, 0, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          minHeight: 48,
        }}
      >
        <InfoOutlinedIcon
          fontSize="small"
          sx={{
            color: 'text.secondary',
            mr: sidebarOpen ? 1 : 0,
            opacity: 0.8,
            fontSize: 18
          }}
        />
        {sidebarOpen ? (
          <Box sx={{ lineHeight: 1.2 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontWeight: 500,
                letterSpacing: 0.3,
                display: 'block',
                lineHeight: 1.2
              }}
            >
              Version {appVersion}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                opacity: 0.8,
                fontSize: '0.7rem',
                lineHeight: 1.2
              }}
            >
              Built on {buildDate}
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Drawer>
  );
};

export default Sidebar;
