import { apiClient } from './client';

export interface MultimodalJobSubmitResponse {
  job_id: string;
  status: string;
}

export interface MultimodalJobStatusResponse {
  job_id: string;
  status: string;
  progress: number;
  current_step: string;
  step?: string;
  result?: any;
  error?: string | null;
  created_at?: string;
  completed_at?: string;
  _isFallback?: boolean;
}

export const multimodalApi = {
  transformPdf: async (formData: FormData): Promise<MultimodalJobSubmitResponse> => {
    const res = await apiClient.post<MultimodalJobSubmitResponse>('/multimodal/transform-pdf', formData, {
      timeout: 600000,
    });
    return res.data;
  },

  getStatus: async (jobId: string): Promise<MultimodalJobStatusResponse> => {
    const res = await apiClient.get<MultimodalJobStatusResponse>(`/multimodal/status/${jobId}`, { timeout: 30000 });
    const data = res.data;
    const isFallback = (res as any).statusText === 'OK (Fallback Mock)';
    const stepLabels: Record<string, string> = {
      queued: 'Queued in background worker',
      extracting_pdf: 'Extracting text & embedded images',
      analyzing_images: 'Visual analysis with Gemma 3 4B',
      analyzing_text: 'Structural text analysis with Qwen3 4B',
      building_context: 'Assembling multimodal context',
      generating_output: 'Synthesizing multi-channel deliverables',
      parsing_results: 'Formatting final output deliverables',
      completed: 'Transformation complete',
      failed: 'Transformation failed',
    };
    return {
      ...data,
      step: stepLabels[data.current_step] || data.current_step,
      ...(data.result || {}),
      _isFallback: isFallback,
    };
  }
};
