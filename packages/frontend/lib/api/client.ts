import axios, { AxiosInstance } from 'axios';
import useAuthStore from '@/lib/store/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

let apiClient: AxiosInstance;

export function initializeApiClient() {
  apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  apiClient.interceptors.request.use(
    (config) => {
      const token = useAuthStore.getState().token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = useAuthStore.getState().refreshToken;
          if (!refreshToken) {
            useAuthStore.getState().logout();
            return Promise.reject(error);
          }

          const response = await apiClient.post('/api/auth/refresh', {
            refreshToken,
          });

          const { token, refreshToken: newRefreshToken } = response.data;
          useAuthStore.getState().setTokens(token, newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          useAuthStore.getState().logout();
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return apiClient;
}

export function getApiClient() {
  if (!apiClient) {
    initializeApiClient();
  }
  return apiClient;
}
