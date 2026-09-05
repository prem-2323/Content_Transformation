import { apiClient } from './client';

export const multimodalApi = {
  transformPdf: async (formData: FormData) => {
    const res = await apiClient.post('/multimodal/transform-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data; // Expected { job_id: string, status: string }
  },

  getStatus: async (jobId: string) => {
    const res = await apiClient.get(`/multimodal/status/${jobId}`);
    return res.data; // Expected { status, step, extracted_text, visual_analysis, outputs, consistency, error }
  }
};
