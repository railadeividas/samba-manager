import axios from 'axios';

// Create axios instance with base URL and default headers
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for adding authentication token
api.interceptors.request.use(
  (config) => {
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
    return response;
  },
  (error) => {
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
