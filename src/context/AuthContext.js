import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase.js';
import { onAuthStateChanged } from '@firebase/auth';
import { authApi } from '../api/authApi.js';
import client from '../api/client.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const authOperationInProgress = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const cachedUser = await AsyncStorage.getItem('user');
          if (cachedUser) {
            setUser(JSON.parse(cachedUser));
          } else {
            setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
          }
        } else if (!authOperationInProgress.current) {
          setUser(null);
          await AsyncStorage.removeItem('user');
        }
      } catch (error) {
        console.error('Error in auth state listener:', error);
        if (!authOperationInProgress.current) {
          setUser(null);
        }
      } finally {
        setIsAuthReady(true);
        if (!authOperationInProgress.current) {
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const register = async (email, password, name, phone, bloodGroup) => {
    authOperationInProgress.current = true;

    try {
      setIsLoading(true);

      const { idToken } = await authApi.firebaseRegister(email, password);

      const response = await authApi.registerUser(idToken, name);
      if (!response.success || !response.data) {
        throw new Error('Backend registration failed');
      }

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
        console.warn('Failed to update profile with phone/bloodGroup:', updateError);
      }

      setUser(userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      return userData;
    } catch (error) {
      console.error('Registration error:', error);
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

      const { idToken } = await authApi.firebaseLogin(email, password);

      const response = await authApi.loginUser(idToken);
      if (!response.success || !response.data) {
        throw new Error('Backend login failed');
      }

      const userData = response.data;
      setUser(userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));

      return userData;
    } catch (error) {
      console.error('Login error:', error);
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
      await auth.signOut();
      setUser(null);
      await AsyncStorage.removeItem('user');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      authOperationInProgress.current = false;
      setIsLoading(false);
    }
  };

  const value = {
    user,
    isLoading,
    isAuthReady,
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
