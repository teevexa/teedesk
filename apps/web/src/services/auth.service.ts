import apiClient from './api';
import { LoginRequest, RegisterRequest, TokenResponse, User } from '@/types';

export const authService = {
  async login(data: LoginRequest): Promise<TokenResponse> {
    const res = await apiClient.post<TokenResponse>('/auth/login', data);
    return res.data;
  },

  async register(data: RegisterRequest): Promise<TokenResponse> {
    const res = await apiClient.post<TokenResponse>('/auth/register', data);
    return res.data;
  },

  async logout(refreshToken?: string): Promise<void> {
    await apiClient.post('/auth/logout', refreshToken ? { refresh_token: refreshToken } : {});
  },

  async refresh(): Promise<TokenResponse> {
    const res = await apiClient.post<TokenResponse>('/auth/refresh');
    return res.data;
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },

  async updateMe(data: { name?: string; avatar_url?: string }): Promise<User> {
    const res = await apiClient.patch<User>('/auth/me', data);
    return res.data;
  },

  async changePassword(data: { current_password: string; new_password: string }): Promise<void> {
    await apiClient.post('/auth/change-password', data);
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },

  async resetPassword(data: { token: string; new_password: string }): Promise<void> {
    await apiClient.post('/auth/reset-password', data);
  },

  async verifyEmail(token: string): Promise<void> {
    await apiClient.post('/auth/verify-email', { token });
  },

  async resendVerification(): Promise<void> {
    await apiClient.post('/auth/resend-verification');
  },
};
