/**
 * Converts technical errors into user-friendly messages.
 */
export const getUserFriendlyErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) {
    return fallback;
  }

  const status = error.response?.status;
  const serverMessage = error.response?.data?.message;

  if (error.isDeviceOffline === true) {
    return 'No internet connection. Check your connection and try again.';
  }

  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return 'Unable to connect to the server. Check your connection and try again.';
  }

  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'The server is taking longer than expected. Please try again.';
  }

  if (status === 503) {
    return 'The service is temporarily unavailable. Please try again shortly.';
  }

  if (status === 502 || status === 504) {
    return 'The service is temporarily unavailable. Please try again shortly.';
  }

  if (status === 409 && serverMessage) {
    return serverMessage;
  }

  if (status === 403 && serverMessage) {
    return serverMessage;
  }

  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (status === 401) {
    return 'Your session has expired. Please log in again.';
  }

  if (status === 404 && serverMessage) {
    return serverMessage;
  }

  if (status === 404) {
    return 'The requested resource was not found.';
  }

  if (status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  if (status >= 500) {
    return 'Something went wrong on our server. Please try again.';
  }

  if (status === 400 && serverMessage) {
    return serverMessage;
  }

  if (error.code?.startsWith('auth/')) {
    return fallback;
  }

  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return serverMessage;
  }

  if (error.message?.includes('Location permission denied')) {
    return 'Location permission is required to find nearby blood donors.';
  }

  if (error.message?.includes('GPS timeout')) {
    return 'Unable to get your location in time. Please ensure GPS is enabled and try again.';
  }

  if (error.message === 'Not authenticated') {
    return 'Your session is still completing. Please try again.';
  }

  return fallback;
};

export const isRetryableNetworkError = (error) => {
  if (!error) {
    return false;
  }

  const status = error.response?.status;
  return (
    error.code === 'ERR_NETWORK' ||
    error.message === 'Network Error' ||
    error.code === 'ECONNABORTED' ||
    error.message?.includes('timeout') ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
};

export const withBoundedRetry = async (operation, { maxAttempts = 3, shouldRetry = isRetryableNetworkError } = {}) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
    }
  }

  throw lastError;
};
