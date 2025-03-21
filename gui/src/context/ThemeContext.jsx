import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Create theme context
const ThemeContext = createContext({
  mode: 'light',
  toggleTheme: () => {},
});

// Custom hook to use the theme context
export const useTheme = () => useContext(ThemeContext);

// Theme provider component
export const ThemeProvider = ({ children }) => {
  // Check if there's a saved theme preference in localStorage
  const storedTheme = localStorage.getItem('themeMode');
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Set initial theme mode - use stored preference, system preference, or light as fallback
  const [mode, setMode] = useState(storedTheme || (prefersDarkMode ? 'dark' : 'light'));

  // Toggle between light and dark theme
  const toggleTheme = () => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  };

  // Create theme based on current mode
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === 'light'
            ? {
                // Light mode colors
                primary: {
                  main: '#1976d2',
                  light: '#42a5f5',
                  dark: '#1565c0',
                },
                secondary: {
                  main: '#388e3c',
                  light: '#4caf50',
                  dark: '#2e7d32',
                },
                background: {
                  default: '#f5f5f5',
                  paper: '#ffffff',
                },
              }
            : {
                // Dark mode colors
                primary: {
                  main: '#90caf9',
                  light: '#e3f2fd',
                  dark: '#42a5f5',
                },
                secondary: {
                  main: '#66bb6a',
                  light: '#81c784',
                  dark: '#388e3c',
                },
                background: {
                  default: '#121212',
                  paper: '#1e1e1e',
                },
              }),
        },
        components: {
          MuiAppBar: {
            styleOverrides: {
              root: {
                boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
                ...(mode === 'dark' && {
                  backgroundColor: '#1a1a1a',
                }),
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                ...(mode === 'dark' && {
                  backgroundColor: '#1a1a1a',
                }),
              },
            },
          },
        },
      }),
    [mode]
  );

  // Provide theme context and MUI theme provider
  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
