import { apiClient } from './client';

export const videoApi = {
  planVideo: async (data: any) => {
    const res = await apiClient.post('/video/plan', data);
    return res.data;
  },

  generateVideo: async (data: any) => {
    const res = await apiClient.post('/video/generate-video', data);
    return res.data;
  },

  getVideoUrl: (filename: string) => {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    return `${base}/video/${filename}`;
  }
};
