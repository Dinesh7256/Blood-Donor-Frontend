import NetInfo from '@react-native-community/netinfo';

/**
 * Throws a network-shaped error when the device appears offline.
 * Used before critical user actions for clearer UX than a failed API call alone.
 */
export const assertNetworkAvailable = async () => {
  const state = await NetInfo.fetch();

  // Only block when the device reports no connection at all.
  // isInternetReachable can be false on LAN/dev networks even when the backend is reachable.
  if (state.isConnected === false) {
    const error = new Error('Network Error');
    error.code = 'ERR_NETWORK';
    error.isDeviceOffline = true;
    throw error;
  }
};
