import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext.js';

export default function AppIndex() {
  const { user } = useAuth();

  useEffect(() => {
    // This index file is a placeholder. The actual routing happens in root _layout.js
    // If somehow we end up here without a user, redirect to auth
    if (!user) {
      router.replace('/(auth)/');
    }
  }, [user]);

  // Render nothing - the root layout will redirect before this mounts
  // or a home screen will be implemented here later
  return null;
}
