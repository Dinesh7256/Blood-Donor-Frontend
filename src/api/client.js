import { create } from 'axios';
import { API_BASE_URL } from '../constants/config.js';
import { auth } from '../config/firebase.js';
import { logApiRequest, logApiSuccess, logApiError } from '../utils/flowLog.js';
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

client.interceptors.request.use(
  async (config) => {
    logApiRequest(config);

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
    } catch (error) {
      if (__DEV__) {
        console.error('[API ERROR] Failed to attach Firebase authorization header');
      }
      return Promise.reject(error);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => {
    logApiSuccess(response);
    return response;
  },
  (error) => {
    logApiError(error);

    const status = error.response?.status;

    if (status === 401 && !isPublicRequest(error.config?.url || '')) {
      void notifyUnauthorized();
    }

    return Promise.reject(error);
  }
);

export default client;
