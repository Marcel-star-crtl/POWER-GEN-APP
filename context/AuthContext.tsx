import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { User, AuthState, ApiResponse } from '../types/common.types';
import { router, usePathname } from 'expo-router';

import { authEvents } from '../services/authEvents';

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    loading: true,
    error: null,
  });
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      loadStoredAuth();
    }
    
    // Subscribe to auth events (like 401 logout)
    const unsubscribe = authEvents.subscribe(() => {
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        loading: false,
        error: 'Session expired',
      });
      // Only redirect if not already on login page
      if (!window.location?.pathname?.includes('/login')) {
        router.replace('/(auth)/login');
      }
    });

    return unsubscribe;
  }, []);

  const loadStoredAuth = async () => {
    try {
      console.log('🔄 Loading stored auth...');
      const [token, userStr] = await Promise.all([
        AsyncStorage.getItem('accessToken'),
        AsyncStorage.getItem('user'),
      ]);

      console.log('📦 Token exists:', !!token);
      console.log('📦 User exists:', !!userStr);

      if (token && userStr) {
        const user = JSON.parse(userStr);
        console.log('✅ Auth restored for:', user.email);
        console.log('👤 User role:', user.role);
        console.log('🔐 Is authenticated:', true);
        setState((prev) => ({
          ...prev,
          accessToken: token,
          user,
          isAuthenticated: true,
          loading: false,
        }));
        console.log('✅ State updated - should redirect now');
      } else {
        console.log('⚠️ No stored auth found');
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('❌ Failed to load auth state:', error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = (email || '').trim().toLowerCase();
    // Passwords typically should be treated verbatim, but copy/paste often adds
    // trailing whitespace/newlines that cause confusing "Invalid credentials".
    const normalizedPassword = (password || '').replace(/\u00A0/g, ' ').trim();

    console.log('🔐 SignIn started for:', normalizedEmail);
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      console.log('📡 Sending login request...');
      const response = await api.post<ApiResponse<{ accessToken: string; refreshToken?: string; user: User }>>('/auth/login', {
        email: normalizedEmail,
        password: normalizedPassword,
      });

      console.log('✅ Login response received:', response.data);
      const { accessToken, refreshToken, user } = response.data.data!;

      console.log('👤 User role:', user.role);
      // Only allow technicians for now
      if (user.role !== 'technician') {
        throw new Error('Access restricted to technicians only');
      }

      console.log('💾 Saving token and user to AsyncStorage...');
      await AsyncStorage.setItem('accessToken', accessToken);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      console.log('✅ Token saved successfully');
      setState({
        user,
        accessToken,
        refreshToken: refreshToken || null,
        isAuthenticated: true,
        loading: false,
        error: null,
      });

      console.log('🚀 Navigating to dashboard...');
      router.replace('/(technician)/dashboard');
    } catch (error: any) {
      console.error('❌ Login error:', error);
      console.error('❌ Error response:', error.response?.data);
      const message = error.response?.data?.message || error.message || 'Login failed';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
      throw new Error(message);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('user');
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      });
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
