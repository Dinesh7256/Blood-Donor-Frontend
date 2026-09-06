const DEFAULT_API_BASE_URL = 'https://blood-donor-finder-looj.onrender.com/api';

const normalizeApiBaseUrl = (value) => {
  const trimmed = String(value || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '');

  if (trimmed.endsWith('/api/api')) {
    return trimmed.slice(0, -4);
  }

  return trimmed;
};

export const API_BASE_URL = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
);

if (__DEV__) {
  console.log(`[API CONFIG] API_BASE_URL = ${API_BASE_URL}`);
}

export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};
