import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Create authentication context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Check if user is authenticated on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Verify authentication status
  const checkAuthStatus = async () => {
    setIsLoading(true);
    const auth = localStorage.getItem('auth');

    if (!auth) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    try {
      // Validate token by making a request to the API
      const response = await fetch('/api/status', {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      if (response.ok) {
        console.log("Auth validation successful");
        setIsAuthenticated(true);
      } else {
        console.log("Auth validation failed:", response.status);
        // If validation fails, clear stored credentials
        localStorage.removeItem('auth');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (username, password) => {
    console.log("Login called with:", username);

    // Create Base64 encoded credentials for Basic Auth
    const base64Credentials = btoa(`${username}:${password}`);

    try {
      console.log("Making auth verification request");
      const response = await fetch('/api/status', {
        headers: {
          'Authorization': `Basic ${base64Credentials}`
        }
      });

      console.log("Auth response status:", response.status);

      if (response.ok) {
        console.log("Setting auth in localStorage");
        localStorage.setItem('auth', base64Credentials);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, message: 'Invalid username or password' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Connection error. Please try again.' };
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('auth');
    setIsAuthenticated(false);
    navigate('/login');
  };

  // Get auth header for API requests
  const getAuthHeader = () => {
    const auth = localStorage.getItem('auth');
    return auth ? { 'Authorization': `Basic ${auth}` } : {};
  };

  // Value to provide to the context
  const contextValue = {
    isAuthenticated,
    isLoading,
    login,
    logout,
    getAuthHeader
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
