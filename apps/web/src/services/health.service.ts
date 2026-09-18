import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down' | 'unreachable';
  version?: string;
  environment?: string;
  secret_key_configured?: boolean;
  services?: {
    database: boolean;
    redis: boolean;
    llm: boolean;
  };
}

export const healthService = {
  check: async (): Promise<HealthStatus> => {
    try {
      const { data } = await axios.get(`${API_URL}/health`, { timeout: 5000 });
      return data;
    } catch {
      return { status: 'unreachable' };
    }
  },
};
