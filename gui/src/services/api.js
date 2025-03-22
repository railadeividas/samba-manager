import axios from 'axios';

// Track failed requests to prevent spamming
let apiFailedTimestamp = 0;
const RETRY_WAIT_TIME = 10000; // 10 seconds between retries

// Create axios instance with base URL and default headers
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  // Set a longer timeout for slow connections
  timeout: 10000
});

// Function to clear failed timestamp - call this from components when forcing a retry
export const clearApiFailure = () => {
  apiFailedTimestamp = 0;
};

// Request interceptor for adding authentication token
api.interceptors.request.use(
  (config) => {
    // Check if we should block this request due to recent failures
    const now = Date.now();
    if (apiFailedTimestamp > 0 && now - apiFailedTimestamp < RETRY_WAIT_TIME) {
      // Reject this request with a clear message to prevent spamming
      return Promise.reject({
        message: `API server unavailable. Will retry after ${Math.ceil((apiFailedTimestamp + RETRY_WAIT_TIME - now)/1000)} seconds.`,
        isConnectionError: true,
        status: 0
      });
    }

    // Get auth token from localStorage
    const auth = localStorage.getItem('auth');

    // Add Authorization header if token exists
    if (auth) {
      config.headers['Authorization'] = `Basic ${auth}`;
    }

    // Add header to identify as API request
    config.headers['X-Client'] = 'SambaManagerAPI';

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
api.interceptors.response.use(
  (response) => {
    // Clear failed timestamp on successful response
    apiFailedTimestamp = 0;
    return response;
  },
  (error) => {
    // Check for connection errors
    if (!error.response || error.code === 'ECONNABORTED' || error.message.includes('Network Error')) {
      console.error('API connection error:', error.message);

      // Set the failed timestamp to limit retries
      apiFailedTimestamp = Date.now();

      return Promise.reject({
        message: 'Unable to connect to server. Please check your network connection.',
        isConnectionError: true,
        status: 0,
        data: {}
      });
    }

    // Handle 401 Unauthorized errors globally
    if (error.response && error.response.status === 401) {
      // Clear auth token
      localStorage.removeItem('auth');

      // Redirect to login page
      window.location.href = '/login';

      return Promise.reject({
        message: 'Your session has expired. Please login again.',
        status: 401
      });
    }

    const customError = {
      message: error.response?.data?.error || 'Something went wrong',
      status: error.response?.status || 500,
      data: error.response?.data || {}
    };

    return Promise.reject(customError);
  }
);

export default api;
