import api from './api';

/**
 * Get raw Samba configuration
 * @returns {Promise<Object>} - Configuration data
 */
export const getRawConfig = async () => {
  try {
    const response = await api.get('/config/raw');
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Save raw Samba configuration
 * @param {string} content - Configuration content
 * @returns {Promise<Object>} - Response
 */
export const saveRawConfig = async (content) => {
  try {
    const response = await api.post('/config/raw', { content });
    return response.data;
  } catch (error) {
    throw error;
  }
};
