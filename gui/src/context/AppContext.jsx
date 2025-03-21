import React, { createContext, useContext, useState } from 'react';

// Create the context
const AppContext = createContext();

// Custom hook to use the app context
export const useApp = () => useContext(AppContext);

// Provider component
export const AppProvider = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [serviceStatus, setServiceStatus] = useState({
    active: false,
    status: 'unknown',
    metadata: {
      uptime: {
        uptime: 'N/A',
        since: ''
      }
    }
  });
  const [shares, setShares] = useState({});
  const [users, setUsers] = useState({ users: [] });
  const [groups, setGroups] = useState({ groups: [] });
  const [isLoading, setIsLoading] = useState({
    shares: false,
    users: false,
    groups: false,
    service: false
  });

  // Toggle sidebar function
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Provide the context value
  const contextValue = {
    sidebarOpen,
    toggleSidebar,
    serviceStatus,
    setServiceStatus,
    shares,
    setShares,
    users,
    setUsers,
    groups,
    setGroups,
    isLoading,
    setIsLoading
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};
