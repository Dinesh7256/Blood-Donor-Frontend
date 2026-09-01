import axios from 'axios';
import { API_BASE_URL } from '../constants/config.js';
import { auth } from '../config/firebase.js';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor to attach Firebase ID token
client.interceptors.request.use(
  async (config) => {
    try {
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${idToken}`;
      }
    } catch (error) {
      console.error('Error retrieving Firebase ID token:', error);
      return Promise.reject(error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.warn('Unauthorized access:', error.response?.data?.message || error.message);
    }
    return Promise.reject(error);
  }
);

export default client;
