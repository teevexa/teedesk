import apiClient from './api';
import { KnowledgeArticle, PaginatedResponse } from '@/types';

export interface SearchParams {
  query?: string;
  category?: string;
  tags?: string[];
  page?: number;
  size?: number;
}

export interface CreateArticlePayload {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  is_published?: boolean;
}

export const knowledgeService = {
  search: async (params: SearchParams): Promise<PaginatedResponse<KnowledgeArticle>> => {
    // Backend expects `search`, not `query`, for full-text search.
    const { query, ...rest } = params;
    const { data } = await apiClient.get<PaginatedResponse<KnowledgeArticle>>('/knowledge', {
      params: { ...rest, search: query },
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

  markHelpful: async (id: string, helpful: boolean): Promise<void> => {
    await apiClient.post(`/knowledge/${id}/helpful`, null, { params: { helpful } });
  },

  recordView: async (id: string): Promise<void> => {
    await apiClient.post(`/knowledge/${id}/view`);
  },

  getCategories: async (): Promise<string[]> => {
    const { data } = await apiClient.get<string[]>('/knowledge/categories');
    return data;
  },

  uploadDocument: async (
    file: File,
    meta: { title?: string; category?: string; tags?: string[] }
  ): Promise<KnowledgeArticle> => {
    const form = new FormData();
    form.append('file', file);
    if (meta.title) form.append('title', meta.title);
    if (meta.category) form.append('category', meta.category);
    if (meta.tags?.length) form.append('tags', meta.tags.join(','));
    const { data } = await apiClient.post<KnowledgeArticle>('/knowledge/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
