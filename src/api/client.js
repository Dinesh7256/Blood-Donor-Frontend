import { create } from 'axios';
import { API_BASE_URL } from '../constants/config.js';
import { auth } from '../config/firebase.js';
import { logApiFlow } from '../utils/flowLog.js';
import { notifyUnauthorized } from '../utils/authSession.js';

const PUBLIC_API_PATHS = ['/auth/login', '/auth/register'];

const client = create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

const isPublicRequest = (url = '') =>
  PUBLIC_API_PATHS.some((path) => url.includes(path));

const setAuthorizationHeader = (config, token) => {
  if (config.headers?.set) {
    config.headers.set('Authorization', `Bearer ${token}`);
    return;
  }

  config.headers = config.headers || {};
  config.headers.Authorization = `Bearer ${token}`;
};

// Request interceptor to attach Firebase ID token
client.interceptors.request.use(
  async (config) => {
    if (isPublicRequest(config.url)) {
      return config;
    }

    try {
      await auth.authStateReady();

      if (!auth.currentUser) {
        return Promise.reject(new Error('Not authenticated'));
      }

      const idToken = await auth.currentUser.getIdToken();
      setAuthorizationHeader(config, idToken);
      logApiFlow(`${config.method?.toUpperCase() || 'GET'} ${config.url}`);
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
    const status = error.response?.status;

    if (status === 401 && !isPublicRequest(error.config?.url || '')) {
      notifyUnauthorized();
    } else if (status === 401 || status === 403) {
      console.warn('Unauthorized access:', error.response?.data?.message || error.message);
    }

    return Promise.reject(error);
  }
);

export default client;
