import axios, { AxiosError, AxiosInstance } from 'axios';
import { ApiError } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
  withCredentials: true,
});

// Attach JWT access token from store to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('supportiq_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 handling: attempt one token refresh, then retry the original request
let _isRefreshing = false;
let _refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const _processQueue = (err: unknown, token: string | null) => {
  _refreshQueue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve(token!)));
  _refreshQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _refreshQueue.push({
            resolve: (token) => {
              original.headers = original.headers ?? {};
              original.headers['Authorization'] = `Bearer ${token}`;
              resolve(apiClient(original));
            },
            reject,
          });
        });
      }

      original._retried = true;
      _isRefreshing = true;

      try {
        const res = await apiClient.post<{ access_token: string; user: unknown }>(
          '/auth/refresh'
        );
        const newToken = res.data.access_token;
        localStorage.setItem('supportiq_token', newToken);

        // Update auth store without a circular import — dynamic import resolves at runtime
        import('@/store/auth.store').then(({ useAuthStore }) => {
          const { user } = useAuthStore.getState();
          if (user) {
            useAuthStore.getState().setAuth(user, newToken);
          }
        });

        _processQueue(null, newToken);
        original.headers = original.headers ?? {};
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(original);
      } catch (refreshErr) {
        _processQueue(refreshErr, null);
        localStorage.removeItem('supportiq_token');
        import('@/store/auth.store').then(({ useAuthStore }) => {
          useAuthStore.getState().clearAuth();
        });
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        _isRefreshing = false;
      }
    }

    // Normalize error shape
    const apiError: ApiError = {
      message: 'An unexpected error occurred',
      status: error.response?.status ?? 0,
    };

    if (error.response?.data && typeof error.response.data === 'object') {
      const data = error.response.data as Record<string, unknown>;
      // Backend format: { error: { code, message } }
      const nested = data.error as Record<string, unknown> | undefined;
      apiError.message =
        (nested?.message as string) ||
        (data.detail as string) ||
        (data.message as string) ||
        apiError.message;
      apiError.code = (nested?.code as string) || (data.code as string) || undefined;
    } else if (error.request) {
      apiError.message =
        'Cannot reach the SupportIQ API. Make sure the backend is running on ' + API_URL;
      apiError.status = 0;
    }

    return Promise.reject(apiError);
  }
);

export default apiClient;
