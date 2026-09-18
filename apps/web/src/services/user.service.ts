import apiClient from './api';
import { PaginatedResponse, User, UserRole } from '@/types';

export interface UserUpdatePayload {
  role?: UserRole;
  is_active?: boolean;
  name?: string;
}

export const userService = {
  list: async (page = 1, size = 50): Promise<PaginatedResponse<User>> => {
    const { data } = await apiClient.get<PaginatedResponse<User>>('/admin/users', {
      params: { page, size },
    });
    return data;
  },

  update: async (id: string, payload: UserUpdatePayload): Promise<User> => {
    const { data } = await apiClient.patch<User>(`/admin/users/${id}`, payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/users/${id}`);
  },
};
