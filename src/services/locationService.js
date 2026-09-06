import * as Location from 'expo-location';
import { logLocationFlow, logLocationError } from '../utils/flowLog.js';

const GPS_TIMEOUT_MS = 15000;
const GPS_MAX_ATTEMPTS = 3;

const isPermissionGranted = (permission) =>
  permission.granted === true || permission.status === Location.PermissionStatus.GRANTED;

const withTimeout = (promise, timeoutMs, timeoutMessage) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

let inFlightLocationPromise = null;

const fetchGpsWithRetry = async () => {
  logLocationFlow('Starting location initialisation');
  logLocationFlow('Checking existing permission');

  const existingPermission = await Location.getForegroundPermissionsAsync();
  logLocationFlow(`Permission status = ${existingPermission.status}`);

  let permissionStatus;

  if (isPermissionGranted(existingPermission)) {
    permissionStatus = existingPermission.status;
    logLocationFlow('Permission already granted, skipping request');
  } else {
    logLocationFlow('Requesting location permission');
    const requestResult = await Location.requestForegroundPermissionsAsync();
    permissionStatus = requestResult.status;
    logLocationFlow(`Permission request returned = ${permissionStatus}`);
  }

  if (permissionStatus !== Location.PermissionStatus.GRANTED) {
    throw new Error('Location permission denied. Please enable location access in settings.');
  }

  let lastError;

  for (let attempt = 1; attempt <= GPS_MAX_ATTEMPTS; attempt += 1) {
    try {
      logLocationFlow(`GPS request started (attempt ${attempt}/${GPS_MAX_ATTEMPTS})`);

      const location = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        GPS_TIMEOUT_MS,
        'GPS timeout'
      );

      logLocationFlow('GPS received');
      logLocationFlow(`GPS latitude = ${location.coords.latitude}`);
      logLocationFlow(`GPS longitude = ${location.coords.longitude}`);

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      lastError = error;
      logLocationError(`GPS attempt ${attempt} failed`, error);

      if (attempt < GPS_MAX_ATTEMPTS) {
        logLocationFlow(`Retrying GPS (attempt ${attempt + 1}/${GPS_MAX_ATTEMPTS})`);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to get location');
};

export const locationService = {
  getCurrentLocation: async () => {
    if (inFlightLocationPromise) {
      logLocationFlow('Reusing in-flight location request');
      return inFlightLocationPromise;
    }

    inFlightLocationPromise = fetchGpsWithRetry()
      .catch((error) => {
        logLocationError('Location acquisition failed', error);
        throw new Error(
          `Failed to get location: ${error instanceof Error ? error.message : String(error)}`
        );
      })
      .finally(() => {
        inFlightLocationPromise = null;
      });

    return inFlightLocationPromise;
  },
};
