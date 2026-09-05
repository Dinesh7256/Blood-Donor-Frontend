import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { notificationService } from '../services/notificationService.js';

const showBloodRequestTapFallback = (result) => {
  if (!result.handled) {
    return;
  }

  const bloodGroupText = result.bloodGroup ? ` for ${result.bloodGroup}` : '';

  Alert.alert(
    'Blood Donation Request',
    `A nearby blood request${bloodGroupText} was received. Request details screen is not available yet.`,
    [{ text: 'OK' }]
  );
};

const handleRemoteMessage = (remoteMessage) => {
  const result = notificationService.handleBloodRequestNotification(remoteMessage);

  if (!result.handled) {
    return result;
  }

  if (result.navigationAvailable) {
    return result;
  }

  showBloodRequestTapFallback(result);
  return result;
};

/**
 * Handles incoming FCM blood-request notifications without blocking Home.
 */
export const useNotificationHandlers = (isFullyAuthenticated) => {
  const lastHandledMessageId = useRef(null);

  useEffect(() => {
    if (!isFullyAuthenticated) {
      return undefined;
    }

    const messaging = notificationService.getMessaging();
    if (!messaging) {
      return undefined;
    }

    const foregroundSubscription = messaging.onMessage(async (remoteMessage) => {
      notificationService.handleBloodRequestNotification(remoteMessage);

      if (__DEV__) {
        console.log(
          '[notifications] Foreground FCM message received:',
          remoteMessage?.data?.type || 'unknown'
        );
      }

      if (remoteMessage?.notification?.title) {
        Alert.alert(
          remoteMessage.notification.title,
          remoteMessage.notification.body || 'You have a new notification.'
        );
      }
    });

    const openedSubscription = messaging.onNotificationOpenedApp((remoteMessage) => {
      const messageId = remoteMessage?.messageId || JSON.stringify(remoteMessage?.data || {});

      if (lastHandledMessageId.current === messageId) {
        return;
      }

      lastHandledMessageId.current = messageId;
      handleRemoteMessage(remoteMessage);
    });

    messaging
      .getInitialNotification()
      .then((remoteMessage) => {
        if (!remoteMessage) {
          return;
        }

        const messageId = remoteMessage?.messageId || JSON.stringify(remoteMessage?.data || {});

        if (lastHandledMessageId.current === messageId) {
          return;
        }

        lastHandledMessageId.current = messageId;
        handleRemoteMessage(remoteMessage);
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn('[notifications] Failed to read initial FCM notification:', error.message);
        }
      });

    return () => {
      foregroundSubscription();
      openedSubscription();
    };
  }, [isFullyAuthenticated]);
};
