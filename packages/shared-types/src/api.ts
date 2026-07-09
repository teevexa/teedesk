export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  status: number;
  details?: Record<string, unknown>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: {
    id: string;
    email: string;
    role: string;
    tenant_id: string;
  };
}

export interface SendMessageRequest {
  conversation_id?: string;
  content: string;
  channel?: string;
}

export interface SendMessageResponse {
  user_message: {
    id: string;
    content: string;
    created_at: string;
  };
  bot_message: {
    id: string;
    content: string;
    intent?: string;
    sentiment?: string;
    created_at: string;
  };
  conversation_id: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  services: {
    database: boolean;
    redis: boolean;
    llm: boolean;
  };
  timestamp: string;
}
