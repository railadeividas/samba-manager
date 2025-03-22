import api from './api';

/**
 * Get all groups
 * @param {boolean} includeSystem - Whether to include system groups (GID < 1000)
 * @returns {Promise<Object>} - Groups data
 */
export const getGroups = async (includeSystem = false) => {
  try {
    const response = await api.get(`/groups?includeSystem=${includeSystem}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Create a new group
 * @param {string} groupName - Group name
 * @returns {Promise<Object>} - Response
 */
export const createGroup = async (groupName) => {
  try {
    const response = await api.post(`/groups/${groupName}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a group
 * @param {string} groupName - Group name
 * @returns {Promise<Object>} - Response
 */
export const deleteGroup = async (groupName) => {
  try {
    const response = await api.delete(`/groups/${groupName}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Add a user to a group
 * @param {string} groupName - Group name
 * @param {string} userName - User name
 * @returns {Promise<Object>} - Response
 */
export const addUserToGroup = async (groupName, userName) => {
  try {
    const response = await api.post(`/groups/${groupName}/users/${userName}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Remove a user from a group
 * @param {string} groupName - Group name
 * @param {string} userName - User name
 * @returns {Promise<Object>} - Response
 */
export const removeUserFromGroup = async (groupName, userName) => {
  try {
    const response = await api.delete(`/groups/${groupName}/users/${userName}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};
