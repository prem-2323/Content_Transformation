import { apiClient, getApiBaseUrl } from './client';

export interface GenerateImageRequest {
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  [key: string]: any;
}

export const imageApi = {
  generateImage: async (data: GenerateImageRequest) => {
    const res = await apiClient.post('/generate-image', data);
    return res.data;
  },

  generateSceneImages: async (data: any) => {
    const res = await apiClient.post('/generate-scene-images', data);
    return res.data;
  },

  generateSceneImagesFromFile: async (formData: FormData) => {
    const res = await apiClient.post('/generate-scene-images-from-file', formData, {
      timeout: 600000,
    });
    return res.data;
  },

  getImageUrl: (filename: string) => {
    const base = getApiBaseUrl() || 'http://localhost:8000';
    return `${base}/image/${filename}`;
  }
};
