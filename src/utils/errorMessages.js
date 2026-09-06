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
    return 'Unable to reach the server. Check your connection and try again.';
  }

  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'The request is taking longer than expected. Please try again.';
  }

  if (status === 409 && serverMessage) {
    return serverMessage;
  }

  if (status === 403 && serverMessage) {
    return serverMessage;
  }

  if (status === 401 || status === 403) {
    return 'Your session has expired. Please log in again.';
  }

  if (status === 404 && serverMessage) {
    return serverMessage;
  }

  if (status >= 500) {
    return 'Our server is currently unavailable. Please try again in a moment.';
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
