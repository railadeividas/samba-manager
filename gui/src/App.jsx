import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import SharesPage from './pages/SharesPage';
import UsersPage from './pages/UsersPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import { getServiceStatus } from './services/serviceStatus';
import { useApp } from './context/AppContext';
import { useAuth } from './context/AuthContext';

function App() {
  const { setServiceStatus } = useApp();
  const { isAuthenticated } = useAuth();

  console.log("App rendered, auth state:", isAuthenticated);

  // Check service status on component mount and periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkServiceStatus = async () => {
      try {
        const status = await getServiceStatus();
        setServiceStatus(status);
      } catch (error) {
        console.error('Failed to get service status:', error);
      }
    };

    checkServiceStatus();

    // Set up periodic status check
    const interval = setInterval(checkServiceStatus, 30000); // every 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, setServiceStatus]);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/shares" element={<SharesPage />} />
        <Route path="/users" element={<UsersPage />} />
      </Route>

      {/* Redirect Routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
