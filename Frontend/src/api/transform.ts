import { apiClient } from './client';

export interface TransformRequest {
  text?: string;
  audience?: string;
  tone?: string;
  language?: string;
  detail_level?: string;
  objective?: string;
  output_types?: string[];
}

export const transformApi = {
  transformText: async (data: TransformRequest) => {
    const res = await apiClient.post('/transform', data);
    return res.data;
  },

  transformFile: async (formData: FormData) => {
    const res = await apiClient.post('/transform-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getModels: async () => {
    const res = await apiClient.get('/v1/models');
    return res.data;
  }
};
