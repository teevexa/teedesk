import apiClient from './api';
import { TenantSettings, TenantSettingsUpdate } from '@/types';

export const settingsService = {
  get: async (): Promise<TenantSettings> => {
    const { data } = await apiClient.get<TenantSettings>('/settings');
    return data;
  },

  update: async (payload: TenantSettingsUpdate): Promise<TenantSettings> => {
    const { data } = await apiClient.patch<TenantSettings>('/settings', payload);
    return data;
  },
};
