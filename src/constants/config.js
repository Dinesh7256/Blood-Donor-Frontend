const PRODUCTION_API_BASE_URL = 'https://blood-donor-finder-looj.onrender.com/api';

export const API_BASE_URL = __DEV__
  ? process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.2.2:3000/api'
  : PRODUCTION_API_BASE_URL;

export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};
