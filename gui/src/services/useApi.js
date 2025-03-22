import { useState, useEffect, useCallback, useRef } from 'react';
import { useNotification } from '../context/NotificationContext';
import { clearApiFailure } from './api';

/**
 * Custom hook for API data fetching with connection error handling
 *
 * @param {Function} fetchFunction - The API function to call
 * @param {Array} fetchArgs - Arguments to pass to the fetch function
 * @param {Array} dependencies - Additional dependencies for the fetch callback
 * @param {boolean} loadOnMount - Whether to load data when component mounts
 * @returns {Object} - Data, loading state, error state, and utility functions
 */
export const useApi = (fetchFunction, fetchArgs = [], dependencies = [], loadOnMount = true) => {
  const { showNotification } = useNotification();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(loadOnMount);
  const [error, setError] = useState(null);
  const [isConnectionError, setIsConnectionError] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  const retryTimerRef = useRef(null);
  const lastArgsRef = useRef(fetchArgs);
  const lastFetchFunctionRef = useRef(fetchFunction);

  // Store the current fetch arguments for comparison
  useEffect(() => {
    lastArgsRef.current = fetchArgs;
    lastFetchFunctionRef.current = fetchFunction;
  }, [fetchFunction, ...fetchArgs]);

  // Function to fetch data with error handling
  const fetchData = useCallback(async (forceRefresh = false) => {
    // Always reset connection error state when a retry is forced
    if (forceRefresh) {
      setIsConnectionError(false);
      clearApiFailure(); // Clear the API failure tracking
    }

    // Skip if we've already fetched data and this isn't a forced refresh
    // Also skip if we have a connection error and aren't forcing a refresh
    if ((dataFetched && !forceRefresh) || (isConnectionError && !forceRefresh)) return;

    // Clear any existing retry timer
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    setLoading(true);
    setError(null);

    try {
      // Call the fetch function with current stored arguments
      const result = await lastFetchFunctionRef.current(...lastArgsRef.current);
      setData(result);
      setDataFetched(true);
      setIsConnectionError(false); // Clear connection error state on success
      return result;
    } catch (error) {
      console.error(`API error in ${lastFetchFunctionRef.current.name}:`, error);

      // Handle connection errors differently
      if (error.isConnectionError) {
        setIsConnectionError(true);
        // Don't show notification for connection errors to avoid spamming
      } else {
        showNotification(`Failed to load data: ${error.message || 'Something went wrong'}`, 'error');
      }

      setError(error.message || 'Something went wrong');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dataFetched, isConnectionError, showNotification]);

  // Load data on mount if specified
  useEffect(() => {
    if (loadOnMount) {
      fetchData();
    }

    return () => {
      // Clean up timer on unmount
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [loadOnMount, fetchData]);

  // Force retry function
  const forceRetry = useCallback(() => {
    // Force reset connection error state
    setIsConnectionError(false);
    clearApiFailure();
    // Then force a refresh
    return fetchData(true);
  }, [fetchData]);

  // Function to update data directly
  const updateData = useCallback((newData) => {
    setData(newData);
  }, []);

  return {
    data,
    loading,
    error,
    isConnectionError,
    fetchData,
    forceRetry,
    updateData
  };
};
