import { apiClient } from './client';

export const multimodalApi = {
  transformPdf: async (formData: FormData) => {
    const res = await apiClient.post('/multimodal/transform-pdf', formData, {
      timeout: 600000,
    });
    return res.data; // Expected { job_id: string, status: string }
  },

  getStatus: async (jobId: string) => {
    const res = await apiClient.get(`/multimodal/status/${jobId}`, { timeout: 30000 });
    const data = res.data;
    const isFallback = (res as any).statusText === 'OK (Fallback Mock)';
    const stepLabels: Record<string, string> = {
      queued: 'Queued',
      extracting_pdf: 'Extracting PDF',
      analyzing_images: 'Analyzing images with Gemma',
      analyzing_text: 'Understanding content',
      generating_outputs: 'Generating outputs with Qwen',
      consistency_check: 'Running consistency checks',
      completed: 'Completed',
      failed: 'Failed',
    };
    return {
      ...data,
      step: stepLabels[data.current_step] || data.current_step,
      ...(data.result || {}),
      _isFallback: isFallback,
    };
  }
};
