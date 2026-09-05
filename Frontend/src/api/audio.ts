import { apiClient } from './client';

export const audioApi = {
  getVoices: async () => {
    const res = await apiClient.get('/audio-voices');
    return res.data;
  },

  generateAudio: async (data: any) => {
    const res = await apiClient.post('/generate-audio', data);
    return res.data;
  },

  generateVideoAudio: async (data: any) => {
    const res = await apiClient.post('/generate-video-audio', data);
    return res.data;
  },

  getAudioUrl: (filename: string) => {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    return `${base}/audio/${filename}`;
  }
};
