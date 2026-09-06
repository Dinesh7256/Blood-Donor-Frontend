import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase.js';
import { onAuthStateChanged } from '@firebase/auth';
import { authApi } from '../api/authApi.js';
import { userApi } from '../api/userApi.js';
import client from '../api/client.js';
import { notificationService } from '../services/notificationService.js';
import { resetHomeInitSession } from '../utils/homeInitSession.js';
import { logAuthFlow, logAuthError } from '../utils/flowLog.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const authOperationInProgress = useRef(false);

  const ensureFirebaseSession = async (expectedUid) => {
    logAuthFlow('Waiting for Firebase session');
    await auth.authStateReady();

    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('Firebase authentication failed');
    }

    if (expectedUid && currentUser.uid !== expectedUid) {
      throw new Error('Firebase authentication mismatch');
    }

    await currentUser.getIdToken(true);
    logAuthFlow('Firebase ID token obtained');
    setFirebaseUser(currentUser);
    return currentUser;
  };

  const syncBackendUserFromProfile = async () => {
    logAuthFlow('Backend user synchronisation started');
    const response = await userApi.getProfile();

    if (!response?.success || !response?.data?._id) {
      throw new Error('Backend user synchronisation failed');
    }

    logAuthFlow('Backend user synchronisation successful');
    logAuthFlow('MongoDB user confirmed');
    setUser(response.data);
    await AsyncStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextFirebaseUser) => {
      try {
        setFirebaseUser(nextFirebaseUser);

        if (nextFirebaseUser) {
          if (authOperationInProgress.current) {
            logAuthFlow('Auth state changed during active register/login — deferring user sync');
            return;
          }

          const cachedUser = await AsyncStorage.getItem('user');
          if (cachedUser) {
            const parsedUser = JSON.parse(cachedUser);
            if (parsedUser?._id) {
              setUser(parsedUser);
              logAuthFlow('Restored cached MongoDB user');
              return;
            }
          }

          try {
            await auth.authStateReady();
            if (auth.currentUser) {
              await syncBackendUserFromProfile();
            }
          } catch (profileError) {
            logAuthError('Failed to restore backend user on auth state change', profileError);
            setUser(null);
          }
        } else if (!authOperationInProgress.current) {
          setUser(null);
          await AsyncStorage.removeItem('user');
          resetHomeInitSession();
        }
      } catch (error) {
        logAuthError('Auth state listener failed', error);
        if (!authOperationInProgress.current) {
          setFirebaseUser(null);
          setUser(null);
        }
      } finally {
        setIsAuthReady(true);
        if (!authOperationInProgress.current) {
          setIsLoading(false);
          logAuthFlow('Authentication initialisation complete');
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const register = async (email, password, name, phone, bloodGroup) => {
    authOperationInProgress.current = true;

    try {
      setIsLoading(true);
      logAuthFlow('Firebase registration started');

      const { idToken, user: firebaseAuthUser } = await authApi.firebaseRegister(
        email,
        password
      );
      logAuthFlow('Firebase authentication successful');
      await ensureFirebaseSession(firebaseAuthUser.uid);

      logAuthFlow('Backend user synchronisation started');
      const response = await authApi.registerUser(idToken, name);
      if (!response.success || !response.data?._id) {
        throw new Error('Backend registration failed');
      }
      logAuthFlow('Backend user synchronisation successful');
      logAuthFlow('MongoDB user confirmed');

      let userData = response.data;

      try {
        const updateResponse = await client.put('/users/me', {
          phone,
          bloodGroup,
        });
        if (updateResponse.data?.success) {
          userData = updateResponse.data.data;
        }
      } catch (updateError) {
        logAuthError('Failed to update profile with phone/bloodGroup', updateError);
      }

      setUser(userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      logAuthFlow('Authentication initialisation complete');
      return userData;
    } catch (error) {
      logAuthError('Registration failed', error);
      throw error;
    } finally {
      authOperationInProgress.current = false;
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    authOperationInProgress.current = true;

    try {
      setIsLoading(true);
      logAuthFlow('Firebase login started');

      const { idToken, user: firebaseAuthUser } = await authApi.firebaseLogin(email, password);
      logAuthFlow('Firebase authentication successful');
      await ensureFirebaseSession(firebaseAuthUser.uid);

      logAuthFlow('Backend user synchronisation started');
      const response = await authApi.loginUser(idToken);
      if (!response.success || !response.data?._id) {
        throw new Error('Backend login failed');
      }
      logAuthFlow('Backend user synchronisation successful');
      logAuthFlow('MongoDB user confirmed');

      const userData = response.data;
      setUser(userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      logAuthFlow('Authentication initialisation complete');

      return userData;
    } catch (error) {
      logAuthError('Login failed', error);
      throw error;
    } finally {
      authOperationInProgress.current = false;
      setIsLoading(false);
    }
  };

  const logout = async () => {
    authOperationInProgress.current = true;

    try {
      setIsLoading(true);
      await notificationService.unregisterDeviceTokenFromBackend();
      await auth.signOut();
      setFirebaseUser(null);
      setUser(null);
      await AsyncStorage.removeItem('user');
      resetHomeInitSession();
      logAuthFlow('Logout complete — home init session reset');
    } catch (error) {
      logAuthError('Logout failed', error);
      throw error;
    } finally {
      authOperationInProgress.current = false;
      setIsLoading(false);
    }
  };

  const isBackendUserReady = Boolean(user?._id);

  const isFirebaseAuthenticated =
    isAuthReady &&
    !!auth.currentUser &&
    !!firebaseUser &&
    firebaseUser.uid === auth.currentUser.uid;

  const value = {
    user,
    firebaseUser,
    isLoading,
    isAuthReady,
    isFirebaseAuthenticated,
    isBackendUserReady,
    register,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
