import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User, LoginRequest, RegisterRequest } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Low-level setters (used by API interceptor)
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  updateUser: (updates: Partial<User>) => void;

  // High-level actions (call API then update store)
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,

        setAuth: (user, token) => {
          localStorage.setItem('supportiq_token', token);
          set({ user, token, isAuthenticated: true });
        },

        clearAuth: () => {
          localStorage.removeItem('supportiq_token');
          set({ user: null, token: null, isAuthenticated: false });
        },

        updateUser: (updates) =>
          set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null,
          })),

        login: async (data) => {
          set({ isLoading: true });
          try {
            const { authService } = await import('@/services/auth.service');
            const resp = await authService.login(data);
            get().setAuth(resp.user, resp.access_token);
          } finally {
            set({ isLoading: false });
          }
        },

        register: async (data) => {
          set({ isLoading: true });
          try {
            const { authService } = await import('@/services/auth.service');
            const resp = await authService.register(data);
            get().setAuth(resp.user, resp.access_token);
          } finally {
            set({ isLoading: false });
          }
        },

        logout: async () => {
          set({ isLoading: true });
          try {
            const { authService } = await import('@/services/auth.service');
            await authService.logout();
          } catch {
            // Ignore logout API errors — clear local state regardless
          } finally {
            get().clearAuth();
            set({ isLoading: false });
          }
        },

        fetchMe: async () => {
          try {
            const { authService } = await import('@/services/auth.service');
            const user = await authService.getMe();
            set({ user, isAuthenticated: true });
          } catch {
            get().clearAuth();
          }
        },
      }),
      {
        name: 'supportiq-auth',
        partialize: (state) => ({ user: state.user, token: state.token }),
        onRehydrateStorage: () => (state) => {
          if (state?.token) {
            state.isAuthenticated = true;
          }
        },
      }
    ),
    { name: 'auth-store' }
  )
);
