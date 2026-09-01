import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { authApi } from '../api/authApi.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // User is logged in with Firebase
          const cachedUser = await AsyncStorage.getItem('user');
          if (cachedUser) {
            setUser(JSON.parse(cachedUser));
          } else {
            setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
          }
        } else {
          // User is not logged in
          setUser(null);
          await AsyncStorage.removeItem('user');
        }
      } catch (error) {
        console.error('Error in auth state listener:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const register = async (idToken, name) => {
    try {
      setIsLoading(true);
      const response = await authApi.registerUser(idToken, name);
      if (response.success && response.data) {
        const userData = response.data;
        setUser(userData);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        return userData;
      }
      throw new Error('Registration failed: Invalid response from server');
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (idToken) => {
    try {
      setIsLoading(true);
      const response = await authApi.loginUser(idToken);
      if (response.success && response.data) {
        const userData = response.data;
        setUser(userData);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        return userData;
      }
      throw new Error('Login failed: Invalid response from server');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await auth.signOut();
      setUser(null);
      await AsyncStorage.removeItem('user');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    isLoading,
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
