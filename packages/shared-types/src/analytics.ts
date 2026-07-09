export interface SentimentDistribution {
  positive: number;
  negative: number;
  neutral: number;
}

export interface IntentDistribution {
  [intent: string]: number;
}

export interface ConversationMetrics {
  total: number;
  open: number;
  escalated: number;
  resolved: number;
  avgResolutionMinutes: number;
}

export interface MessageMetrics {
  total: number;
  bot: number;
  human: number;
  averagePerConversation: number;
}

export interface AnalyticsOverview {
  conversations: ConversationMetrics;
  messages: MessageMetrics;
  satisfactionRate: number;
  urgentIssues: number;
  sentimentDistribution: SentimentDistribution;
  intentDistribution: IntentDistribution;
  period: 'day' | '7d' | '30d' | '90d';
  generatedAt: string;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface TrendData {
  conversations: TimeSeriesPoint[];
  messages: TimeSeriesPoint[];
  satisfaction: TimeSeriesPoint[];
}
