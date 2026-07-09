import apiClient from './api';

export interface TrainingEntry {
  id: string;
  input_text: string;
  labeled_intent: string | null;
  labeled_sentiment: string | null;
  is_verified: boolean;
  source: string;
  created_at: string;
}

export interface TrainingDataResponse {
  items: TrainingEntry[];
  page: number;
  size: number;
}

export const adminService = {
  getTrainingData: async (params?: {
    is_verified?: boolean;
    page?: number;
    size?: number;
  }): Promise<TrainingDataResponse> => {
    const { data } = await apiClient.get<TrainingDataResponse>('/admin/training-data', {
      params,
    });
    return data;
  },

  verifyTrainingEntry: async (id: string): Promise<void> => {
    await apiClient.patch(`/admin/training-data/${id}/verify`);
  },

  triggerRetrain: async (): Promise<{ task_id: string; status: string }> => {
    const { data } = await apiClient.post<{ task_id: string; status: string }>('/admin/retrain');
    return data;
  },
};
