import { apiClient } from './client';

export const presentationApi = {
  exportPptx: async (data: any) => {
    const res = await apiClient.post('/export-pptx', data);
    return res.data;
  },

  exportPptxFile: async (formData: FormData) => {
    const res = await apiClient.post('/export-pptx-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }
};
