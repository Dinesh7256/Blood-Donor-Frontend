import * as Location from 'expo-location';

const isPermissionGranted = (permission) =>
  permission.granted === true || permission.status === Location.PermissionStatus.GRANTED;

export const locationService = {
  getCurrentLocation: async () => {
    if (__DEV__) {
      console.log('[LOCATION DEBUG] checking existing permission');
    }

    let permissionStatus;

    try {
      const existingPermission = await Location.getForegroundPermissionsAsync();

      if (__DEV__) {
        console.log(`[LOCATION DEBUG] existing permission = ${existingPermission.status}`);
      }

      if (isPermissionGranted(existingPermission)) {
        permissionStatus = existingPermission.status;
        if (__DEV__) {
          console.log('[LOCATION DEBUG] permission already granted, skipping request');
        }
      } else {
        if (__DEV__) {
          console.log('[LOCATION DEBUG] requesting location permission');
        }

        const requestResult = await Location.requestForegroundPermissionsAsync();
        permissionStatus = requestResult.status;

        if (__DEV__) {
          console.log(`[LOCATION DEBUG] permission request returned = ${permissionStatus}`);
        }
      }

      if (permissionStatus !== Location.PermissionStatus.GRANTED) {
        throw new Error('Location permission denied. Please enable location access in settings.');
      }

      if (__DEV__) {
        console.log('[LOCATION DEBUG] requesting GPS');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (__DEV__) {
        console.log('[LOCATION DEBUG] GPS result received');
      }

      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;

      if (__DEV__) {
        console.log(`[LOCATION DEBUG] GPS latitude = ${latitude}`);
        console.log(`[LOCATION DEBUG] GPS longitude = ${longitude}`);
      }

      return {
        latitude,
        longitude,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[LOCATION ERROR]', error);
      throw new Error(`Failed to get location: ${message}`);
    }
  },
};
