import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext.js';

export default function AuthIndex() {
  const { user } = useAuth();

  useEffect(() => {
    // This index file is a placeholder. The actual routing happens in root _layout.js
    // If somehow we end up here with a user, redirect to app
    if (user) {
      router.replace('/(app)/');
    }
  }, [user]);

  // Render nothing - the root layout will redirect before this mounts
  // or a login screen will be implemented here later
  return null;
}
