import api from './api';

// Special sections that should be excluded from shares
export const SPECIAL_SECTIONS = ['global', 'printers', 'print$', 'homes'];

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

/**
 * Get all shares from the config
 * @returns {Promise<Object>} - Shares data
 */
export const getShares = async () => {
  try {
    const response = await api.get('/config');
    const config = response.data.config;
    const shares = {};

    // Filter out special sections
    Object.entries(config).forEach(([section, params]) => {
      if (!SPECIAL_SECTIONS.includes(section)) {
        shares[section] = params;
      }
    });

    return shares;
  } catch (error) {
    throw error;
  }
};

/**
 * Get a specific share from the config
 * @param {string} shareName - Share name
 * @returns {Promise<Object>} - Share data
 */
export const getShare = async (shareName) => {
  try {
    const response = await api.get(`/config/sections/${shareName}`);
    return response.data[shareName];
  } catch (error) {
    throw error;
  }
};

/**
 * Create or update a share in the config
 * @param {string} shareName - Share name
 * @param {Object} shareData - Share configuration
 * @returns {Promise<Object>} - Response
 */
export const createUpdateShare = async (shareName, shareData) => {
  try {
    const response = await api.post(`/config/sections/${shareName}`, {
      [shareName]: shareData
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteSection = async (sectionName) => {
  try {
    const response = await api.delete(`/config/sections/${sectionName}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getShareACLs = async (shareName) => {
  try {
    const response = await api.get(`/shares/${shareName}/acl`);
    return response.data;
  } catch (error) {
    throw error;
  }
};
