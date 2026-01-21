import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { authEvents } from './authEvents';

export const SERVER_URL = 'http://192.168.126.37:5000'; // Updated to current local IP
const BASE_URL = `${SERVER_URL}/api`;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('🔑 Request with token:', config.url);
      } else {
        console.log('⚠️ No token found for request:', config.url);
      }
    } catch (error) {
      console.error('Error retrieving token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token expiration/unauthorized
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('user');
      authEvents.emit(); // Notify AuthContext to update state
    }
    return Promise.reject(error);
  }
);

