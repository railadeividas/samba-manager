import React, { useState } from 'react';
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
import SettingsIcon from '@mui/icons-material/Settings';
import TuneIcon from '@mui/icons-material/Tune';
import HomeIcon from '@mui/icons-material/Home';
import CodeIcon from '@mui/icons-material/Code';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useApp } from '../../context/AppContext';
import Collapse from '@mui/material/Collapse';

// Import version from package.json
import packageInfo from '../../../package.json';
const appVersion = packageInfo.version;

// Get build date - this will be the date when the app is built
const buildDate = process.env.REACT_APP_BUILD_DATE || new Date().toISOString().split('T')[0];

const Sidebar = () => {
  const { sidebarOpen } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Check if we're in any settings page
  const isInSettingsSection = ['/settings/homes', '/settings/global', '/settings/advanced'].includes(location.pathname);

  // Auto-open settings section if we're in a settings page
  React.useEffect(() => {
    if (isInSettingsSection && !settingsOpen) {
      setSettingsOpen(true);
    }
  }, [location.pathname, isInSettingsSection, settingsOpen]);

  const mainMenuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Shares', icon: <FolderSharedIcon />, path: '/shares' },
    { text: 'Users', icon: <PeopleIcon />, path: '/users' },
    { text: 'Groups', icon: <GroupsIcon />, path: '/groups' },
  ];

  const settingsMenuItems = [
    { text: 'User Homes', icon: <HomeIcon />, path: '/settings/homes' },
    { text: 'Global & Printers', icon: <TuneIcon />, path: '/settings/global' },
    { text: 'Advanced Editor', icon: <CodeIcon />, path: '/settings/advanced' },
  ];

  const drawerWidth = sidebarOpen ? 240 : 64;

  const handleSettingsClick = () => {
    setSettingsOpen(!settingsOpen);
  };

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
        {mainMenuItems.map((item) => (
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

        {/* Settings Section */}
        <ListItem disablePadding>
          <ListItemButton
            onClick={handleSettingsClick}
            selected={isInSettingsSection}
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
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText
              primary="Settings"
              sx={{
                opacity: sidebarOpen ? 1 : 0,
                whiteSpace: 'nowrap',
              }}
            />
            {sidebarOpen && (settingsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
          </ListItemButton>
        </ListItem>

        {/* Settings Sub-Menu */}
        <Collapse in={settingsOpen && sidebarOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {settingsMenuItems.map((item) => (
              <ListItemButton
                key={item.text}
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  pl: 4,
                  py: 0.5,
                  minHeight: 40,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                />
              </ListItemButton>
            ))}
          </List>
        </Collapse>
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
