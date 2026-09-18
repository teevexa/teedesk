import apiClient from './api';
import { Message, Feedback, PaginatedResponse } from '@/types';

export const chatService = {
  // Real-time send (with an AI reply) only happens over the WebSocket —
  // see store/chat.store.ts. This fetches a conversation's message history,
  // e.g. for the admin conversation viewer.
  getMessages: async (conversationId: string): Promise<Message[]> => {
    const { data } = await apiClient.get<PaginatedResponse<Message>>('/messages', {
      params: { conversation_id: conversationId, size: 100 },
    });
    return data.items;
  },

  submitFeedback: async (
    conversationId: string,
    messageId: string,
    rating: 'positive' | 'negative',
    comment?: string
  ): Promise<Feedback> => {
    const { data } = await apiClient.post<Feedback>('/feedback', {
      conversation_id: conversationId,
      message_id: messageId,
      rating,
      comment,
    });
    return data;
  },
};
