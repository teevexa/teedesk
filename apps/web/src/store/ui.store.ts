import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type AppTab = 'chat' | 'analytics' | 'knowledge' | 'admin';

export type ToastVariant = 'default' | 'success' | 'warning' | 'destructive';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface UIState {
  // Navigation
  activeTab: AppTab;

  // Theme
  theme: 'dark' | 'light' | 'system';

  // Backend connectivity
  isBackendConnected: boolean;
  backendVersion: string | null;

  // Toasts (managed by sonner in practice, this tracks state for custom use)
  toasts: Toast[];

  // Actions
  setActiveTab: (tab: AppTab) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setBackendConnected: (connected: boolean, version?: string) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        activeTab: 'chat',
        theme: 'dark',
        isBackendConnected: false,
        backendVersion: null,
        toasts: [],

        setActiveTab: (activeTab) => set({ activeTab }),

        setTheme: (theme) => set({ theme }),

        setBackendConnected: (isBackendConnected, version) =>
          set({ isBackendConnected, backendVersion: version ?? null }),

        addToast: (toast) =>
          set((state) => ({
            toasts: [
              ...state.toasts,
              { ...toast, id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` },
            ],
          })),

        removeToast: (id) =>
          set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
      }),
      {
        name: 'supportiq-ui',
        partialize: (state) => ({ theme: state.theme, activeTab: state.activeTab }),
      }
    ),
    { name: 'ui-store' }
  )
);
