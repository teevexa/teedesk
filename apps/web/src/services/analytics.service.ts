import apiClient from './api';
import { AnalyticsOverview } from '@/types';

export type AnalyticsPeriod = 'day' | '7d' | '30d' | '90d';

export const analyticsService = {
  getOverview: async (period: AnalyticsPeriod = '7d'): Promise<AnalyticsOverview> => {
    const { data } = await apiClient.get<AnalyticsOverview>('/analytics/overview', {
      params: { period },
    });
    return data;
  },

  getTrends: async (period: AnalyticsPeriod = '7d') => {
    const { data } = await apiClient.get('/analytics/trends', { params: { period } });
    return data;
  },

  getTopIntents: async (limit = 10) => {
    const { data } = await apiClient.get('/analytics/intents', { params: { limit } });
    return data;
  },
};
