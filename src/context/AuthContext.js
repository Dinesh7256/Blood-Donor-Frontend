import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase.js';
import { onAuthStateChanged, deleteUser } from '@firebase/auth';
import { authApi } from '../api/authApi.js';
import { userApi } from '../api/userApi.js';
import { notificationService } from '../services/notificationService.js';
import { resetHomeInitSession } from '../utils/homeInitSession.js';
import {
  startAuthSession,
  endAuthSession,
  isAuthSessionValid,
  setUnauthorizedHandler,
  captureAuthSession,
} from '../utils/authSession.js';
import { logAuthFlow, logAuthError, logAuthDebug } from '../utils/flowLog.js';
import { withBoundedRetry, isRetryableNetworkError } from '../utils/errorMessages.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const authOperationInProgress = useRef(false);
  const activeSessionRef = useRef({ userId: null, epoch: 0 });

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

    const response = await withBoundedRetry(
      () => userApi.getProfile(),
      { maxAttempts: 3, shouldRetry: isRetryableNetworkError }
    );

    if (!response?.success || !response?.data?._id) {
      throw new Error('Backend user synchronisation failed');
    }

    logAuthFlow('Backend user synchronisation successful');
    logAuthFlow('MongoDB user confirmed');
    setUser(response.data);
    await AsyncStorage.setItem('user', JSON.stringify(response.data));
    activeSessionRef.current = startAuthSession(response.data._id);
    return response.data;
  };

  const refreshUser = async (nextUser, sessionContext = null) => {
    const context = sessionContext || activeSessionRef.current;

    if (context?.userId && !isAuthSessionValid(context.userId, context.epoch)) {
      logAuthFlow('Skipped refreshUser — auth session no longer valid');
      return null;
    }

    if (nextUser?._id) {
      if (context?.userId && String(nextUser._id) !== String(context.userId)) {
        logAuthFlow('Skipped refreshUser — user id mismatch');
        return null;
      }

      setUser(nextUser);
      await AsyncStorage.setItem('user', JSON.stringify(nextUser));
      return nextUser;
    }

    return syncBackendUserFromProfile();
  };

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      if (authOperationInProgress.current) {
        return;
      }

      try {
        authOperationInProgress.current = true;
        endAuthSession();
        activeSessionRef.current = captureAuthSession();
        resetHomeInitSession();
        await auth.signOut();
        setFirebaseUser(null);
        setUser(null);
        await AsyncStorage.removeItem('user');
      } catch (error) {
        logAuthError('Forced logout after unauthorized API response failed', error);
      } finally {
        authOperationInProgress.current = false;
        setIsLoading(false);
      }
    });

    return () => setUnauthorizedHandler(null);
  }, []);

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
            const cacheMatchesFirebase =
              parsedUser?.firebaseUid && parsedUser.firebaseUid === nextFirebaseUser.uid;

            if (parsedUser?._id && cacheMatchesFirebase) {
              setUser(parsedUser);
              logAuthFlow('Restored cached MongoDB user — verifying with backend');
            } else if (parsedUser?._id && !cacheMatchesFirebase) {
              await AsyncStorage.removeItem('user');
              logAuthFlow('Discarded stale cached profile for different Firebase user');
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
            await AsyncStorage.removeItem('user');
          }
        } else if (!authOperationInProgress.current) {
          endAuthSession();
          activeSessionRef.current = captureAuthSession();
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
    let firebaseAuthUser = null;
    let backendUserConfirmed = false;

    try {
      logAuthDebug('Register started');
      logAuthFlow('Firebase registration started');

      const registrationResult = await authApi.firebaseRegister(email, password);
      firebaseAuthUser = registrationResult.user;
      const { idToken } = registrationResult;
      logAuthDebug('Firebase registration successful');
      logAuthFlow('Firebase authentication successful');
      await ensureFirebaseSession(firebaseAuthUser.uid);
      logAuthDebug('Firebase token received');

      logAuthFlow('Backend user synchronisation started');
      logAuthDebug('Backend registration starting');
      const response = await withBoundedRetry(
        () => authApi.registerUser(idToken, name),
        { maxAttempts: 3, shouldRetry: isRetryableNetworkError }
      );
      if (!response.success || !response.data?._id) {
        throw new Error('Backend registration failed');
      }
      backendUserConfirmed = true;
      logAuthDebug('Backend registration response received');
      logAuthFlow('Backend user synchronisation successful');
      logAuthFlow('MongoDB user confirmed');

      let userData = response.data;

      try {
        const updateResponse = await userApi.updateProfile({
          phone,
          bloodGroup,
        });
        if (updateResponse?.success) {
          userData = updateResponse.data;
        }
      } catch (updateError) {
        logAuthError('Failed to update profile with phone/bloodGroup', updateError);
      }

      userData = await syncBackendUserFromProfile();
      logAuthDebug(`AuthContext user state updating (_id=${userData?._id || 'missing'})`);
      logAuthFlow('Authentication initialisation complete');
      return userData;
    } catch (error) {
      if (firebaseAuthUser && !backendUserConfirmed) {
        try {
          await deleteUser(firebaseAuthUser);
          logAuthFlow('Rolled back Firebase user after registration failure');
        } catch (rollbackError) {
          logAuthError('Failed to roll back Firebase user after registration failure', rollbackError);
        }
      }

      endAuthSession();
      activeSessionRef.current = captureAuthSession();
      setUser(null);
      await AsyncStorage.removeItem('user');
      logAuthError('Registration failed', error);
      throw error;
    } finally {
      authOperationInProgress.current = false;
      logAuthDebug('Register auth operation finished');
    }
  };

  const login = async (email, password) => {
    authOperationInProgress.current = true;

    try {
      logAuthDebug('Login started');
      logAuthFlow('Firebase login started');

      const { idToken, user: firebaseAuthUser } = await authApi.firebaseLogin(email, password);
      logAuthDebug('Firebase login successful');
      logAuthFlow('Firebase authentication successful');
      await ensureFirebaseSession(firebaseAuthUser.uid);
      logAuthDebug('Firebase token received');

      logAuthFlow('Backend user synchronisation started');
      logAuthDebug('Backend login starting');
      const response = await withBoundedRetry(
        () => authApi.loginUser(idToken),
        { maxAttempts: 3, shouldRetry: isRetryableNetworkError }
      );
      if (!response.success || !response.data?._id) {
        throw new Error('Backend login failed');
      }
      logAuthDebug('Backend login response received');
      logAuthFlow('Backend user synchronisation successful');
      logAuthFlow('MongoDB user confirmed');

      const userData = await syncBackendUserFromProfile();
      logAuthDebug(`AuthContext user state updating (_id=${userData?._id || 'missing'})`);
      logAuthFlow('Authentication initialisation complete');

      return userData;
    } catch (error) {
      try {
        if (auth.currentUser) {
          await auth.signOut();
        }
      } catch (signOutError) {
        logAuthError('Failed to sign out Firebase after login failure', signOutError);
      }

      endAuthSession();
      activeSessionRef.current = captureAuthSession();
      setFirebaseUser(null);
      setUser(null);
      await AsyncStorage.removeItem('user');
      logAuthError('Login failed', error);
      throw error;
    } finally {
      authOperationInProgress.current = false;
      logAuthDebug('Login auth operation finished');
    }
  };

  const logout = async () => {
    authOperationInProgress.current = true;

    try {
      await notificationService.unregisterDeviceTokenFromBackend();
      endAuthSession();
      activeSessionRef.current = captureAuthSession();
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
    refreshUser,
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
