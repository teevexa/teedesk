import apiClient from './api';
import { Conversation, PaginatedResponse } from '@/types';

export interface CreateConversationPayload {
  title?: string;
  channel?: string;
}

export const conversationService = {
  list: async (page = 1, size = 20): Promise<PaginatedResponse<Conversation>> => {
    const { data } = await apiClient.get<PaginatedResponse<Conversation>>('/conversations', {
      params: { page, size },
    });
    return data;
  },

  get: async (id: string): Promise<Conversation> => {
    const { data } = await apiClient.get<Conversation>(`/conversations/${id}`);
    return data;
  },

  create: async (payload: CreateConversationPayload): Promise<Conversation> => {
    const { data } = await apiClient.post<Conversation>('/conversations', payload);
    return data;
  },

  updateStatus: async (
    id: string,
    status: 'open' | 'resolved' | 'closed'
  ): Promise<Conversation> => {
    const { data } = await apiClient.patch<Conversation>(`/conversations/${id}`, { status });
    return data;
  },

  escalate: async (id: string, reason?: string): Promise<{ success: boolean }> => {
    const { data } = await apiClient.post(`/conversations/${id}/escalate`, { reason });
    return data;
  },
};
