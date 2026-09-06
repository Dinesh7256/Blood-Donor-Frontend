import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { notificationService } from '../services/notificationService.js';

const navigateForNotification = (result) => {
  if (!result?.navigationAvailable || !result?.navigationPath) {
    return false;
  }

  router.push(result.navigationPath);
  return true;
};

const showBloodRequestTapFallback = (result) => {
  if (!result.handled) {
    return;
  }

  const bloodGroupText = result.bloodGroup ? ` for ${result.bloodGroup}` : '';

  Alert.alert(
    result.type === 'blood_request_accepted' ? 'Donor Accepted' : 'Blood Donation Request',
    result.type === 'blood_request_accepted'
      ? 'A donor has accepted your blood request.'
      : `A nearby blood request${bloodGroupText} was received.`,
    [
      {
        text: 'View',
        onPress: () => {
          navigateForNotification(result);
        },
      },
      { text: 'OK' },
    ]
  );
};

const handleRemoteMessage = (remoteMessage) => {
  const result = notificationService.handleBloodRequestNotification(remoteMessage);

  if (!result.handled) {
    return result;
  }

  if (navigateForNotification(result)) {
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
      const result = notificationService.handleBloodRequestNotification(remoteMessage);

      if (__DEV__) {
        console.log(
          '[notifications] Foreground FCM message received:',
          remoteMessage?.data?.type || 'unknown'
        );
      }

      if (remoteMessage?.notification?.title) {
        Alert.alert(
          remoteMessage.notification.title,
          remoteMessage.notification.body || 'You have a new notification.',
          result.handled
            ? [
                {
                  text: 'View',
                  onPress: () => navigateForNotification(result),
                },
                { text: 'OK' },
              ]
            : [{ text: 'OK' }]
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
