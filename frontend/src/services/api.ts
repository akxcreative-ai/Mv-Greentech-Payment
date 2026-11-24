import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';

// Get base URL from environment or default to live Render backend in production
const envBaseUrl = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;
const baseURL =
  envBaseUrl ||
  (import.meta.env.PROD
    ? 'https://mv-greentech-payment.onrender.com/api'
    : '/api');


export const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
});

// Refresh token tracking
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach JWT token from store (in-memory Zustand or persistent storage)
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token || localStorage.getItem('mv_payment_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401 auto-refresh and error formatting
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const currentToken = useAuthStore.getState().token || localStorage.getItem('mv_payment_token');

    // If running in demo mode with a mock token, don't kick user out to login
    if (currentToken?.startsWith('mv_demo_')) {
      return Promise.reject(error);
    }

    // Don't attempt refresh for auth endpoints to prevent infinite loops
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/reset-password') ||
      originalRequest?.url?.includes('/setup');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Queue concurrent requests while token refresh is in flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh token via the store's refreshToken method
        const newToken = await useAuthStore.getState().refreshToken();

        if (newToken) {
          processQueue(null, newToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return api(originalRequest);
        } else {
          throw new Error('Failed to refresh token');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Refresh failed: clear auth state and redirect to login if not already on public pages
        useAuthStore.getState().logout();
        if (
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login' &&
          window.location.pathname !== '/setup' &&
          window.location.pathname !== '/forgot-password' &&
          window.location.pathname !== '/reset-password'
        ) {
          window.location.href = `/login?session_expired=1&redirect=${encodeURIComponent(
            window.location.pathname + window.location.search
          )}`;
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Format human-friendly error messages from backend response
    const errorMessage =
      (error.response?.data as { message?: string; detail?: string; error?: string })?.message ||
      (error.response?.data as { message?: string; detail?: string; error?: string })?.detail ||
      (error.response?.data as { message?: string; detail?: string; error?: string })?.error ||
      error.message ||
      'An unexpected network error occurred';

    // Attach human-readable error to response
    if (error.response?.data && typeof error.response.data === 'object') {
      (error.response.data as Record<string, unknown>).formattedMessage = errorMessage;
    }

    return Promise.reject(error);
  }
);

export default api;
