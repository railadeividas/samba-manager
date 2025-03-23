import api from './api';

/**
 * Get the entire Samba configuration
 * @returns {Promise<Object>} - Complete configuration data
 */
export const getConfig = async () => {
  try {
    const response = await api.get('/config');
    return response.data.config;
  } catch (error) {
    throw error;
  }
};

/**
 * Update multiple sections of the Samba configuration
 * @param {Object} config - Configuration sections to update
 * @returns {Promise<Object>} - Response
 */
export const updateConfig = async (config) => {
  try {
    const response = await api.post('/config', { config });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get a specific section of the Samba configuration
 * @param {string} sectionName - Name of the section to get
 * @returns {Promise<Object>} - Section data
 */
export const getSection = async (sectionName) => {
  try {
    const response = await api.get(`/config/sections/${sectionName}`);
    return response.data[sectionName];
  } catch (error) {
    throw error;
  }
};

/**
 * Update a specific section of the Samba configuration
 * @param {string} sectionName - Name of the section to update
 * @param {Object} sectionData - Section configuration
 * @returns {Promise<Object>} - Response
 */
export const updateSection = async (sectionName, sectionData) => {
  try {
    const data = { [sectionName]: sectionData };
    const response = await api.post(`/config/sections/${sectionName}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

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
