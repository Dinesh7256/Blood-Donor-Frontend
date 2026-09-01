import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/context/AuthContext.js';

// Keep the splash screen visible while we load authentication state
SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash screen might already be hidden, ignore error
});

function RootLayoutContent() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Hide splash screen once auth state is determined
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {
        // Splash might already be hidden, ignore error
      });
    }
  }, [isLoading]);

  useEffect(() => {
    // If still loading, don't redirect
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (user) {
      // User is logged in, ensure they're in the app group
      if (!inAppGroup) {
        router.replace('/(app)/');
      }
    } else {
      // User is not logged in, ensure they're in the auth group
      if (!inAuthGroup) {
        router.replace('/(auth)/');
      }
    }
  }, [user, isLoading, segments]);

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
