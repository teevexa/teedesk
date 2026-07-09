import apiClient from './api';
import { Message, Conversation, Feedback } from '@/types';

export interface SendMessagePayload {
  conversation_id?: string;
  content: string;
  channel?: string;
}

export interface SendMessageResult {
  user_message: Message;
  bot_message: Message;
  conversation_id: string;
}

export const chatService = {
  sendMessage: async (payload: SendMessagePayload): Promise<SendMessageResult> => {
    const { data } = await apiClient.post<SendMessageResult>('/chat/send', payload);
    return data;
  },

  getMessages: async (conversationId: string): Promise<Message[]> => {
    const { data } = await apiClient.get<Message[]>(`/conversations/${conversationId}/messages`);
    return data;
  },

  submitFeedback: async (
    messageId: string,
    rating: 'positive' | 'negative',
    comment?: string
  ): Promise<Feedback> => {
    const { data } = await apiClient.post<Feedback>('/feedback', {
      message_id: messageId,
      rating,
      comment,
    });
    return data;
  },
};
