import api from './api';

/**
 * Get service status
 * @returns {Promise<Object>} - Service status
 */
export const getServiceStatus = async () => {
  try {
    const response = await api.get('/status');
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Restart service
 * @returns {Promise<Object>} - Response
 */
export const restartService = async () => {
  try {
    const response = await api.post('/restart');
    return response.data;
  } catch (error) {
    throw error;
  }
};
