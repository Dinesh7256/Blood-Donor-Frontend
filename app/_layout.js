import '../src/messaging/registerBackgroundHandler.js';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/context/AuthContext.js';
import { usePushNotificationRegistration } from '../src/hooks/usePushNotificationRegistration.js';
import { useNotificationHandlers } from '../src/hooks/useNotificationHandlers.js';

// Keep the splash screen visible while we load authentication state
SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash screen might already be hidden, ignore error
});

function RootLayoutContent() {
  const { user, isLoading, isAuthReady, isFirebaseAuthenticated } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const isFullyAuthenticated =
    isAuthReady && isFirebaseAuthenticated && Boolean(user);

  usePushNotificationRegistration(isFullyAuthenticated);
  useNotificationHandlers(isFullyAuthenticated);

  useEffect(() => {
    // Hide splash screen once auth state is determined
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

  // While authentication state is being determined, show nothing
  // (splash screen will be visible)
  if (isLoading) {
    return null;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}
