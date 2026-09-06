import '../src/messaging/registerBackgroundHandler.js';
import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/context/AuthContext.js';
import { usePushNotificationRegistration } from '../src/hooks/usePushNotificationRegistration.js';
import { useNotificationHandlers } from '../src/hooks/useNotificationHandlers.js';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash screen might already be hidden, ignore error
});

function RootLayoutContent() {
  const { user, isLoading, isAuthReady, isFirebaseAuthenticated, isBackendUserReady } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const isFullyAuthenticated =
    isAuthReady && isFirebaseAuthenticated && isBackendUserReady;

  usePushNotificationRegistration(isFullyAuthenticated);
  useNotificationHandlers(isFullyAuthenticated);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {
        // Splash might already be hidden, ignore error
      });
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading || !isAuthReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (__DEV__) {
      console.log(
        `[AUTH DEBUG] Layout authentication state = fullyAuthenticated:${isFullyAuthenticated}, firebase:${isFirebaseAuthenticated}, backendUser:${isBackendUserReady}, userId:${user?._id || 'none'}`
      );
    }

    if (isFullyAuthenticated) {
      if (!inAppGroup) {
        router.replace('/(app)/');
      }
      return;
    }

    if (!inAuthGroup) {
      router.replace('/(auth)/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, isAuthReady, isFirebaseAuthenticated, isFullyAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.bootContainer}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={styles.bootText}>Restoring session...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}

const styles = {
  bootContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  bootText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}
