import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext.js';

export default function AuthIndex() {
  const { user } = useAuth();

  useEffect(() => {
    // If user is logged in, redirect to app
    if (user) {
      router.replace('/(app)/');
    } else {
      // Otherwise, redirect to login
      router.replace('/(auth)/login');
    }
  }, [user]);

  // Render nothing - redirecting
  return null;
}
