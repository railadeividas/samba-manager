import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import SharesPage from './pages/SharesPage';
import UsersPage from './pages/UsersPage';
import GroupsPage from './pages/GroupsPage';
import GlobalSettingsPage from './pages/GlobalSettingsPage';
import UserHomesPage from './pages/UserHomesPage';
import AdvancedConfigurationPage from './pages/AdvancedConfigurationPage';

import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/shares" element={<SharesPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/settings/homes" element={<UserHomesPage />} />
        <Route path="/settings/global" element={<GlobalSettingsPage />} />
        <Route path="/settings/advanced" element={<AdvancedConfigurationPage />} />
      </Route>

      {/* Redirect Routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
