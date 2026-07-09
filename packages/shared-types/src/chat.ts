export type UserRole = 'customer' | 'agent' | 'admin';

export type ConversationStatus = 'open' | 'escalated' | 'resolved' | 'closed';

export type ConversationChannel = 'web' | 'mobile' | 'whatsapp' | 'telegram';

export type SentimentLabel = 'positive' | 'negative' | 'neutral';

export type FeedbackRating = 'positive' | 'negative';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  tenant_id: string;
  avatar_url?: string;
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  plan: 'free' | 'starter' | 'business' | 'enterprise';
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  tenant_id: string;
  assigned_agent_id?: string;
  status: ConversationStatus;
  channel: ConversationChannel;
  title?: string;
  message_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  entity: string;
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id?: string;
  content: string;
  is_bot: boolean;
  intent?: string;
  sentiment?: SentimentLabel;
  sentiment_score?: number;
  entities?: Entity[];
  created_at: string;
}

export interface Feedback {
  id: string;
  message_id: string;
  user_id?: string;
  rating: FeedbackRating;
  comment?: string;
  created_at: string;
}

export interface KnowledgeArticle {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  views: number;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export interface Escalation {
  id: string;
  conversation_id: string;
  reason?: string;
  sentiment_score?: number;
  assigned_agent_id?: string;
  resolved_at?: string;
  created_at: string;
}
