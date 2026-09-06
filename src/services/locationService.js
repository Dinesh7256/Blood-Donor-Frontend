import * as Location from 'expo-location';
import { logLocationFlow, logLocationError } from '../utils/flowLog.js';

const isPermissionGranted = (permission) =>
  permission.granted === true || permission.status === Location.PermissionStatus.GRANTED;

export const locationService = {
  getCurrentLocation: async () => {
    logLocationFlow('Starting location initialisation');
    logLocationFlow('Checking existing permission');

    let permissionStatus;

    try {
      const existingPermission = await Location.getForegroundPermissionsAsync();
      logLocationFlow(`Permission status = ${existingPermission.status}`);

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

      logLocationFlow('GPS request started');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      logLocationFlow('GPS received');

      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;
      logLocationFlow(`GPS latitude = ${latitude}`);
      logLocationFlow(`GPS longitude = ${longitude}`);

      return {
        latitude,
        longitude,
      };
    } catch (error) {
      logLocationError('Location acquisition failed', error);
      throw new Error(
        `Failed to get location: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
};
