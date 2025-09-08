import { createClient } from '@supabase/supabase-js';

// For this demo, we'll use mock data
// In production, you would set up Supabase with proper environment variables

// Supabase client will be available when you connect to Supabase
// For now, we're using mock data with MockDatabaseService
export const supabase = null; // Will be initialized when Supabase is connected

// Database Types
export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  content: string;
  sender: 'user' | 'bot';
  intent?: string;
  sentiment?: string;
  entities?: any[];
  created_at: string;
}

export interface Feedback {
  id: string;
  message_id: string;
  rating: 'positive' | 'negative';
  comment?: string;
  created_at: string;
}

// Mock Database Service for Demo
class MockDatabaseService {
  private conversations: Conversation[] = [];
  private messages: Message[] = [];
  private feedback: Feedback[] = [];

  async createConversation(userId: string, title: string): Promise<Conversation> {
    const conversation: Conversation = {
      id: `conv_${Date.now()}`,
      user_id: userId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.conversations.push(conversation);
    return conversation;
  }

  async saveMessage(message: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };
    
    this.messages.push(newMessage);
    return newMessage;
  }

  async getConversationHistory(conversationId: string): Promise<Message[]> {
    return this.messages.filter(msg => msg.conversation_id === conversationId);
  }

  async saveFeedback(feedback: Omit<Feedback, 'id' | 'created_at'>): Promise<Feedback> {
    const newFeedback: Feedback = {
      ...feedback,
      id: `fb_${Date.now()}`,
      created_at: new Date().toISOString()
    };
    
    this.feedback.push(newFeedback);
    return newFeedback;
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return this.conversations.filter(conv => conv.user_id === userId);
  }
}

export const dbService = new MockDatabaseService();