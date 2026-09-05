import { Platform } from 'react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

if (Platform.OS !== 'web') {
  setBackgroundMessageHandler(getMessaging(), async () => {
    if (__DEV__) {
      console.log('[notifications] Background FCM message received');
    }
  });
}
