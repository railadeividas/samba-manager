import api from './api';

/**
 * Get all shares
 * @returns {Promise<Object>} - Shares data
 */
export const getShares = async () => {
  try {
    const response = await api.get('/shares');
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get a specific share
 * @param {string} shareName - Share name
 * @returns {Promise<Object>} - Share data
 */
export const getShare = async (shareName) => {
  try {
    const response = await api.get(`/shares/${shareName}`);
    return response.data[shareName];
  } catch (error) {
    throw error;
  }
};

/**
 * Get ACLs for a share
 * @param {string} shareName - Share name
 * @returns {Promise<Object>} - ACL data
 */
export const getShareACLs = async (shareName) => {
  try {
    const response = await api.get(`/shares/${shareName}/acl`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Create or update a share
 * @param {string} shareName - Share name
 * @param {Object} shareData - Share configuration
 * @returns {Promise<Object>} - Response
 */
export const createUpdateShare = async (shareName, shareData) => {
  try {
    const response = await api.post(`/shares/${shareName}`, shareData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a share
 * @param {string} shareName - Share name
 * @returns {Promise<Object>} - Response
 */
export const deleteShare = async (shareName) => {
  try {
    const response = await api.delete(`/shares/${shareName}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};
