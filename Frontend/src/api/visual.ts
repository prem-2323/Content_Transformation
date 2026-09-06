import { apiClient } from './client';

export type VisualTask = 'description' | 'ocr' | 'objects' | 'summary' | 'caption' | 'qa' | 'chart' | 'scene';

export interface VisualAnalysis {
  description: string;
  objects: string[];
  visible_text: string[];
  important_details: string[];
}

export interface VisualApiResponse {
  status: string;
  message: string;
  result: VisualAnalysis;
}

export const visualApi = {
  analyzeImage: async (
    image: File | FormData,
    task: VisualTask = 'description',
    prompt = 'Analyze this image'
  ): Promise<VisualApiResponse> => {
    let formData: FormData;

    if (image instanceof FormData) {
      // Back-compat: fix wrong field name 'file' -> 'image' if caller built FormData manually
      formData = image;
      if (formData.has('file') && !formData.has('image')) {
        const fileValue = formData.get('file') as File;
        formData.delete('file');
        formData.append('image', fileValue, (fileValue as File)?.name);
      }
      if (!formData.has('task')) formData.append('task', task);
      if (!formData.has('prompt')) formData.append('prompt', prompt);
    } else {
      formData = new FormData();
      formData.append('image', image, image.name);
      formData.append('task', task);
      formData.append('prompt', prompt);
    }

    // NOTE: do NOT set Content-Type manually — browser + axios add
    // multipart/form-data with the correct boundary automatically.
    // Setting it manually (or inheriting application/json) causes FastAPI 422:
    // "body.image: Field required".
    const res = await apiClient.post<VisualApiResponse>('/visual/analyze', formData, {
      timeout: 120000,
      headers: {
        // Explicitly delete any inherited Content-Type so boundary is auto-set
        'Content-Type': undefined as unknown as string,
      },
    });
    return res.data;
  },
};
