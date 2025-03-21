import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './Common/LoadingSpinner';
import Layout from './Layout';

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  console.log("Protected Route - Auth state:", { isAuthenticated, isLoading });

  // Show loading indicator while checking authentication
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LoadingSpinner message="Checking authentication..." />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log("Not authenticated, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // Render children routes if authenticated
  console.log("Authenticated, rendering protected content");
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default ProtectedRoute;
