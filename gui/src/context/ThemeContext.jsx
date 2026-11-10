import React, { createContext, useContext, useState, useMemo } from 'react';
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
          // Compact controls and dialogs so more fits on screen
          MuiTextField: { defaultProps: { size: 'small', margin: 'dense' } },
          MuiFormControl: { defaultProps: { size: 'small' } },
          MuiAutocomplete: { defaultProps: { size: 'small' } },
          MuiSelect: { defaultProps: { size: 'small' } },
          MuiFormHelperText: {
            styleOverrides: {
              root: { fontSize: '0.7rem', lineHeight: 1.25, marginTop: 2, marginLeft: 4, marginRight: 4 },
            },
          },
          MuiFormControlLabel: {
            styleOverrides: { label: { fontSize: '0.9rem' } },
          },
          MuiDialog: {
            styleOverrides: {
              paper: { margin: 16, maxHeight: 'calc(100% - 32px)' },
            },
          },
          MuiDialogTitle: {
            styleOverrides: {
              root: { padding: '10px 20px', fontSize: '1.1rem', lineHeight: 1.4 },
            },
          },
          MuiDialogContent: {
            styleOverrides: {
              root: { padding: '8px 20px', '.MuiDialogTitle-root + &': { paddingTop: 10 } },
            },
          },
          MuiDialogActions: {
            styleOverrides: { root: { padding: '8px 20px' } },
          },
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
