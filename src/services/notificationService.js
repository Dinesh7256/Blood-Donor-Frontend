import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthorizationStatus,
  getMessaging as getFirebaseMessaging,
  hasPermission,
  requestPermission,
} from '@react-native-firebase/messaging';
import { userApi } from '../api/userApi.js';

const LAST_REGISTERED_FCM_TOKEN_KEY = 'lastRegisteredFcmToken';
const FCM_REGISTRATION_TOKEN_PATTERN = /^[a-zA-Z0-9_:\-]{20,}$/;

const getMessaging = () => {
  if (Platform.OS === 'web') {
    return null;
  }

  return getFirebaseMessaging();
};

const mapAuthorizationStatus = (authStatus) => {
  const granted =
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL ||
    authStatus === AuthorizationStatus.EPHEMERAL;

  if (granted) {
    return { status: 'granted', granted: true };
  }

  if (authStatus === AuthorizationStatus.NOT_DETERMINED) {
    return { status: 'not_determined', granted: false };
  }

  return { status: 'denied', granted: false };
};

const isLikelyFirebaseIdToken = (token) =>
  typeof token === 'string' && token.trim().startsWith('eyJ');

const isExpoPushToken = (token) =>
  typeof token === 'string' && /^ExponentPushToken\[[^\]]+\]$/.test(token.trim());

export const isValidFcmRegistrationToken = (token) => {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const normalizedToken = token.trim();

  if (isLikelyFirebaseIdToken(normalizedToken) || isExpoPushToken(normalizedToken)) {
    return false;
  }

  return FCM_REGISTRATION_TOKEN_PATTERN.test(normalizedToken);
};

const requestAndroidNotificationPermission = async (messaging) => {
  let authStatus = await hasPermission(messaging);

  if (
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL
  ) {
    return { status: 'granted', granted: true };
  }

  // Android 13+ (API 33): RN Firebase requestPermission() is a native no-op on Android,
  // so POST_NOTIFICATIONS must be requested at runtime for the system dialog.
  if (Platform.Version >= 33) {
    const alreadyGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );

    if (!alreadyGranted) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );

      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        return {
          status: result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'denied' : 'denied',
          granted: false,
        };
      }
    }

    authStatus = await hasPermission(messaging);
    return mapAuthorizationStatus(authStatus);
  }

  // Android < 13: notification permission is granted at install time.
  await requestPermission(messaging);
  authStatus = await hasPermission(messaging);
  return mapAuthorizationStatus(authStatus);
};

const requestNotificationPermission = async () => {
  if (Platform.OS === 'web') {
    return { status: 'unavailable', granted: false };
  }

  const messaging = getMessaging();
  if (!messaging) {
    return { status: 'unavailable', granted: false };
  }

  if (Platform.OS === 'ios') {
    const authStatus = await requestPermission(messaging);
    return mapAuthorizationStatus(authStatus);
  }

  return requestAndroidNotificationPermission(messaging);
};

const getFcmRegistrationToken = async () => {
  const messaging = getMessaging();
  if (!messaging) {
    throw new Error('Firebase Cloud Messaging is unavailable on this platform');
  }

  const token = (await messaging.getToken())?.trim();

  if (!isValidFcmRegistrationToken(token)) {
    throw new Error('Received an invalid FCM registration token');
  }

  return token;
};

const registerFcmTokenWithBackend = async (fcmToken) => {
  const cachedToken = await AsyncStorage.getItem(LAST_REGISTERED_FCM_TOKEN_KEY);

  if (cachedToken === fcmToken) {
    if (__DEV__) {
      console.log('[notifications] FCM token already registered with backend');
    }
    return { registered: false, skipped: true };
  }

  await userApi.registerDeviceToken(fcmToken);
  await AsyncStorage.setItem(LAST_REGISTERED_FCM_TOKEN_KEY, fcmToken);

  if (__DEV__) {
    console.log('[notifications] FCM token registered with backend');
  }

  return { registered: true, skipped: false };
};

export const notificationService = {
  getMessaging,
  requestNotificationPermission,
  getFcmRegistrationToken,
  isValidFcmRegistrationToken,

  registerForPushNotifications: async () => {
    try {
      const permission = await requestNotificationPermission();

      if (!permission.granted) {
        if (__DEV__) {
          console.log(`[FCM] Permission not granted (${permission.status})`);
        }
        return { success: false, reason: permission.status };
      }

      const fcmToken = await getFcmRegistrationToken();

      if (__DEV__) {
        const tokenSuffix = fcmToken.slice(-6);
        console.log(`[FCM] Device token obtained ending=${tokenSuffix}`);
      }

      const result = await registerFcmTokenWithBackend(fcmToken);

      if (__DEV__) {
        console.log(`[FCM] Backend token registration success=${result.registered || result.skipped}`);
      }

      return {
        success: true,
        reason: permission.status,
        ...result,
      };
    } catch (error) {
      if (__DEV__) {
        console.error(`[FCM ERROR] Registration failed — ${error.message}`);
      }
      return { success: false, reason: 'error', message: error.message };
    }
  },

  unregisterDeviceTokenFromBackend: async () => {
    try {
      const fcmToken = await AsyncStorage.getItem(LAST_REGISTERED_FCM_TOKEN_KEY);

      if (!fcmToken || !isValidFcmRegistrationToken(fcmToken)) {
        return { removed: false };
      }

      await userApi.removeDeviceToken(fcmToken);
      await AsyncStorage.removeItem(LAST_REGISTERED_FCM_TOKEN_KEY);

      if (__DEV__) {
        console.log('[notifications] FCM token removed from backend');
      }

      return { removed: true };
    } catch (error) {
      if (__DEV__) {
        console.warn('[notifications] Failed to remove FCM token:', error.message);
      }
      return { removed: false };
    }
  },

  getCachedFcmToken: async () => AsyncStorage.getItem(LAST_REGISTERED_FCM_TOKEN_KEY),

  handleBloodRequestNotification: (remoteMessage) => {
    const data = remoteMessage?.data;

    if (!data?.type || !data?.requestId) {
      return { handled: false, reason: 'unsupported_type' };
    }

    if (data.type !== 'blood_request' && data.type !== 'blood_request_accepted' && data.type !== 'blood_request_cancelled') {
      return { handled: false, reason: 'unsupported_type' };
    }

    const requestId = data.requestId;

    if (__DEV__) {
      console.log(`[notifications] ${data.type} notification received for request ${requestId}`);
    }

    const navigationPath = (() => {
      if (data.type === 'blood_request_accepted' || data.screen === 'request_detail') {
        return `/(app)/request/${requestId}`;
      }

      if (data.type === 'blood_request' && data.screen === 'requests') {
        return requestId ? `/(app)/history?tab=incoming&requestId=${requestId}` : '/(app)/history?tab=incoming';
      }

      if (data.type === 'blood_request_cancelled') {
        return '/(app)/history?tab=incoming';
      }

      if (data.type === 'blood_request') {
        return `/(app)/request/${requestId}`;
      }

      return `/(app)/request/${requestId}`;
    })();

    return {
      handled: true,
      type: data.type,
      requestId,
      bloodGroup: data.bloodGroup || null,
      screen: data.screen || null,
      navigationAvailable: true,
      navigationPath,
    };
  },
};
