import api from './api';

/**
 * Get all users
 * @returns {Promise<Object>} - Users data
 */
export const getUsers = async () => {
  try {
    const response = await api.get('/users');
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Create a new user
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {string} existingHome - "adopt" or "wipe" when a leftover home directory exists
 * @returns {Promise<Object>} - Response
 */
export const createUser = async (username, password, existingHome = '') => {
  try {
    const response = await api.post(`/users/${username}`, { password, existingHome });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a user
 * @param {string} username - Username
 * @param {boolean} deleteHome - Also delete the user's home directory
 * @returns {Promise<Object>} - Response
 */
export const deleteUser = async (username, deleteHome = false) => {
  try {
    const response = await api.delete(`/users/${username}${deleteHome ? '?deleteHome=true' : ''}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Change a user's password
 * @param {string} username - Username
 * @param {string} password - New password
 * @returns {Promise<Object>} - Response
 */
export const changePassword = async (username, password) => {
  try {
    const response = await api.post(`/users/${username}/password`, { password });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Create a home directory for a user
 * @param {string} username - Username
 * @returns {Promise<Object>} - Response
 */
export const createUserHomeDirectory = async (username, existingHome = '') => {
  try {
    const response = await api.post(`/users/${username}/home`, { existingHome });
    return response.data;
  } catch (error) {
    throw error;
  }
};
