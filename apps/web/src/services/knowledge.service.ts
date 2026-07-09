import apiClient from './api';
import { KnowledgeArticle, PaginatedResponse } from '@/types';

export interface SearchParams {
  query?: string;
  category?: string;
  tags?: string[];
  page?: number;
  per_page?: number;
}

export interface CreateArticlePayload {
  title: string;
  content: string;
  category: string;
  tags?: string[];
}

export const knowledgeService = {
  search: async (params: SearchParams): Promise<PaginatedResponse<KnowledgeArticle>> => {
    const { data } = await apiClient.get<PaginatedResponse<KnowledgeArticle>>('/knowledge', {
      params,
    });
    return data;
  },

  get: async (id: string): Promise<KnowledgeArticle> => {
    const { data } = await apiClient.get<KnowledgeArticle>(`/knowledge/${id}`);
    return data;
  },

  create: async (payload: CreateArticlePayload): Promise<KnowledgeArticle> => {
    const { data } = await apiClient.post<KnowledgeArticle>('/knowledge', payload);
    return data;
  },

  update: async (id: string, payload: Partial<CreateArticlePayload>): Promise<KnowledgeArticle> => {
    const { data } = await apiClient.patch<KnowledgeArticle>(`/knowledge/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/knowledge/${id}`);
  },

  markHelpful: async (id: string): Promise<void> => {
    await apiClient.post(`/knowledge/${id}/helpful`);
  },

  getCategories: async (): Promise<string[]> => {
    const { data } = await apiClient.get<string[]>('/knowledge/categories');
    return data;
  },
};
