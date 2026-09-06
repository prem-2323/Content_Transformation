import { apiClient } from './client';

type PresentationSlide = {
  title?: string;
  content?: string;
  points?: string[];
};

type PresentationData = {
  title?: string;
  slides?: PresentationSlide[];
  text?: string;
  audience?: string;
  tone?: string;
  language?: string;
  detail_level?: string;
  objective?: string;
};

const toTextRequest = (data: PresentationData) => ({
  text: data.text || [
    data.title ? `Presentation title: ${data.title}` : '',
    ...(data.slides || []).map((slide, index) => {
      const points = slide.points?.join('; ') || slide.content || '';
      return `Slide ${index + 1}: ${slide.title || 'Untitled'}\n${points}`;
    }),
  ].filter(Boolean).join('\n\n'),
  audience: data.audience || 'General public',
  tone: data.tone || 'Professional',
  language: data.language || 'English',
  detail_level: data.detail_level || 'Medium',
  objective: data.objective || 'Inform',
  output_type: 'presentation',
});

export const presentationApi = {
  exportPptx: async (data: PresentationData) => {
    const res = await apiClient.post('/export-pptx', toTextRequest(data), {
      responseType: 'blob',
    });
    return {
      blob: res.data as Blob,
      filename: getFilename(res.headers['content-disposition']) || 'presentation.pptx',
    };
  },

  exportPptxFile: async (formData: FormData) => {
    const res = await apiClient.post('/export-pptx-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }
};

const getFilename = (contentDisposition?: string) => {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1];
};
