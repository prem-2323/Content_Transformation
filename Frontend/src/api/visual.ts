import { apiClient } from './client';

export const visualApi = {
  analyzeImage: async (formData: FormData) => {
    const res = await apiClient.post('/visual/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }
};
