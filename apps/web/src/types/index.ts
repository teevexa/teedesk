// Re-export shared types for use throughout the web app.
// When @teedesk/shared-types package is fully wired up via Turborepo,
// import directly from there. For now, we define the same types locally
// to keep the app self-contained and runnable without the full monorepo install.

export type UserRole = 'customer' | 'agent' | 'support_agent' | 'admin' | 'super_admin';
export type ConversationStatus = 'open' | 'escalated' | 'resolved' | 'closed';
export type ConversationChannel = 'web' | 'mobile' | 'whatsapp' | 'telegram';
export type SentimentLabel = 'positive' | 'negative' | 'neutral';
export type FeedbackRating = 'positive' | 'negative';

export const AGENT_ROLES: UserRole[] = ['agent', 'support_agent', 'admin', 'super_admin'];
export const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin'];

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  tenant_id: string;
  avatar_url?: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  tenant_name: string;
  tenant_slug: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

// A tenant the current user can switch into — their home tenant, or one
// they've been granted an additional membership in. See GET /my-tenants.
export interface MyTenant {
  id: string;
  name: string;
  slug: string;
  role: UserRole;
}

export interface Conversation {
  id: string;
  user_id: string;
  tenant_id?: string;
  assigned_agent_id?: string;
  status: ConversationStatus;
  channel: ConversationChannel;
  title?: string;
  message_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  text: string;
  label: string;   // e.g. "ORG", "PRODUCT", "PERSON", "DATE"
  start: number;
  end: number;
  // Legacy fields kept for backwards compat
  entity?: string;
  word?: string;
  confidence?: number;
}

export interface AnalysisResult {
  sentiment?: SentimentLabel;
  sentiment_score?: number;
  entities: Entity[];
  intent?: string;
  intent_confidence: number;
  knowledge_article_ids: string[];
  escalation_recommended: boolean;
}

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id?: string;
  content: string;
  is_bot: boolean;
  status: MessageStatus;
  intent?: string;
  intent_confidence?: number;
  sentiment?: SentimentLabel;
  sentiment_score?: number;
  entities?: Entity[];
  knowledge_article_ids?: string[];
  analysis?: AnalysisResult;  // live analysis pushed via message_analysis WS event
  created_at: string;
}

export interface Attachment {
  id: string;
  message_id: string;
  tenant_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  url?: string;
  created_at: string;
}

export interface TypingUser {
  user_id: string;
  name: string;
  conversation_id: string;
}

export interface PresenceUser {
  user_id: string;
  name: string;
  status: 'online' | 'offline';
}

export type WSStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

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
  tenant_id?: string;
  author_id?: string | null;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  views: number;
  helpful_count: number;
  not_helpful_count: number;
  is_published: boolean;
  source_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantSettings {
  tenant_id: string;
  chat_title: string;
  welcome_message: string;
  business_hours: string | null;
  timezone: string;
  language: string;
  enable_sentiment_analysis: boolean;
  enable_intent_detection: boolean;
  enable_voice_support: boolean;
  enable_auto_escalation: boolean;
  response_delay_ms: number;
  confidence_threshold: number;
  email_notifications: boolean;
  sms_alerts: boolean;
  desktop_notifications: boolean;
  urgent_issue_alert: boolean;
  whatsapp_enabled: boolean;
  telegram_enabled: boolean;
  slack_integration: boolean;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

export type TenantSettingsUpdate = Partial<
  Omit<TenantSettings, 'tenant_id' | 'created_at' | 'updated_at'>
>;

export interface SentimentDistribution {
  positive: number;
  negative: number;
  neutral: number;
}

export interface AnalyticsOverview {
  totalConversations: number;
  openConversations: number;
  escalatedConversations: number;
  totalMessages: number;
  satisfactionRate: number;
  urgentIssues: number;
  sentimentDistribution: SentimentDistribution;
  intentDistribution: Record<string, number>;
  period: string;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

// Must match services/api/app/core/pagination.py's PaginatedResponse field
// names exactly — the API has no field aliases, so the wire shape is this.
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}
