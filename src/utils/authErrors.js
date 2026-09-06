import { getUserFriendlyErrorMessage } from './errorMessages.js';

const FIREBASE_AUTH_MESSAGES = {
  'auth/user-not-found': 'No account found with this email. Please register first.',
  'auth/wrong-password': 'Incorrect email or password. Please check your details and try again.',
  'auth/invalid-credential':
    'Incorrect email or password. Please check your details and try again.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/email-already-in-use': 'This email is already registered. Please login instead.',
  'auth/weak-password': 'Password is too weak. Please use a stronger password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed':
    'No internet connection. Check your connection and try again.',
};

export const getFirebaseAuthErrorMessage = (error, fallback) => {
  if (!error) {
    return fallback;
  }

  if (error.code && FIREBASE_AUTH_MESSAGES[error.code]) {
    return FIREBASE_AUTH_MESSAGES[error.code];
  }

  if (error.message?.includes('User not found')) {
    return FIREBASE_AUTH_MESSAGES['auth/user-not-found'];
  }

  if (error.response?.status === 404) {
    return FIREBASE_AUTH_MESSAGES['auth/user-not-found'];
  }

  if (error.response?.status === 409) {
    return error.response?.data?.message || 'This phone number is already in use.';
  }

  return getUserFriendlyErrorMessage(error, fallback);
};
