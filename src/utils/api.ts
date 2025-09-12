// src/utils/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Use your deployed Render backend
const API_URL = 'https://darlyn-alt-backend.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach token from AsyncStorage to every request and log request details
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');

      // Attach token if exists
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Log request info
      console.log('🔹 API Request:', {
        url: `${API_URL}${config.url}`,
        method: config.method,
        headers: config.headers,
        data: config.data,
      });

    } catch (e) {
      console.error('❌ Error in request interceptor:', e);
    }
    return config;
  },
  (error) => {
    console.error('❌ Axios request error:', error);
    return Promise.reject(error);
  }
);

// Log all responses
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      url: `${API_URL}${response.config.url}`,
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error('❌ API Response error:', {
      url: `${API_URL}${error.config?.url}`,
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

export default api;
