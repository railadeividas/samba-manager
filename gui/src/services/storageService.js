import api from './api';

/**
 * Get filesystem information (usage/size)
 * @returns {Promise<Object>} - Filesystem information
 */
export const GetFileSystemSizes = async () => {
  try {
    const response = await api.get('/storage-filesystems');
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get share sizes information
 * @returns {Promise<Object>} - Share sizes information
 */
export const getShareSizes = async () => {
  try {
    const response = await api.get('/storage-shares');
    return response.data;
  } catch (error) {
    throw error;
  }
};
