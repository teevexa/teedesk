import apiClient from './api';
import { MyTenant, TokenResponse } from '@/types';

export const tenantService = {
  async listMyTenants(): Promise<MyTenant[]> {
    const res = await apiClient.get<MyTenant[]>('/my-tenants');
    return res.data;
  },

  async switchTenant(tenantId: string): Promise<TokenResponse> {
    const res = await apiClient.post<TokenResponse>('/switch-tenant', { tenant_id: tenantId });
    return res.data;
  },
};
