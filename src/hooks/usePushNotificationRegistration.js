import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '../services/notificationService.js';
import { userApi } from '../api/userApi.js';

const LAST_REGISTERED_FCM_TOKEN_KEY = 'lastRegisteredFcmToken';

/**
 * Registers FCM after the user is fully authenticated.
 * Runs in parallel with Home; failures do not block navigation or donor search.
 */
export const usePushNotificationRegistration = (isFullyAuthenticated) => {
  const registrationAttempted = useRef(false);
  const lastAuthenticatedRef = useRef(false);

  useEffect(() => {
    if (!isFullyAuthenticated) {
      lastAuthenticatedRef.current = false;
      registrationAttempted.current = false;
      return undefined;
    }

    if (registrationAttempted.current && lastAuthenticatedRef.current) {
      return undefined;
    }

    registrationAttempted.current = true;
    lastAuthenticatedRef.current = true;

    let cancelled = false;

    const register = async () => {
      const result = await notificationService.registerForPushNotifications();

      if (cancelled) {
        return;
      }

      if (!result.success && result.reason === 'error') {
        registrationAttempted.current = false;
      }
    };

    register();

    return () => {
      cancelled = true;
    };
  }, [isFullyAuthenticated]);

  useEffect(() => {
    if (!isFullyAuthenticated) {
      return undefined;
    }

    const messaging = notificationService.getMessaging();
    if (!messaging) {
      return undefined;
    }

    const unsubscribe = messaging.onTokenRefresh(async (fcmToken) => {
      const normalizedToken = typeof fcmToken === 'string' ? fcmToken.trim() : '';

      if (!notificationService.isValidFcmRegistrationToken(normalizedToken)) {
        return;
      }

      try {
        const cachedToken = await AsyncStorage.getItem(LAST_REGISTERED_FCM_TOKEN_KEY);

        if (cachedToken === normalizedToken) {
          return;
        }

        await userApi.registerDeviceToken(normalizedToken);
        await AsyncStorage.setItem(LAST_REGISTERED_FCM_TOKEN_KEY, normalizedToken);

        if (__DEV__) {
          console.log('[notifications] FCM token refreshed and registered');
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[notifications] Failed to register refreshed FCM token:', error.message);
        }
      }
    });

    return unsubscribe;
  }, [isFullyAuthenticated]);
};
