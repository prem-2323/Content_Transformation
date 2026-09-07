import { apiClient } from './client';

export interface SlideItem {
  slide_number: number;
  title: string;
  layout?: 'title' | 'bullet_points' | 'two_column' | 'metrics' | 'quote' | string;
  subtitle?: string;
  content?: string[] | string;
  column_left?: string[];
  column_right?: string[];
  speaker_notes?: string;
  visual_recommendation?: string;
}

export interface PresentationDeck {
  presentation_title: string;
  subtitle?: string;
  theme?: string;
  slides: SlideItem[];
}

export interface GenerateDeckPayload {
  mode: 'topic' | 'content';
  topic_or_content: string;
  num_slides?: number;
  audience?: string;
  tone?: string;
  language?: string;
  detail_level?: string;
  objective?: string;
  theme?: string;
}

export const presentationApi = {
  generateDeck: async (data: GenerateDeckPayload): Promise<PresentationDeck> => {
    const res = await apiClient.post<PresentationDeck>('/presentation/generate-deck', {
      mode: data.mode,
      topic_or_content: data.topic_or_content,
      num_slides: data.num_slides || 6,
      audience: data.audience || 'General public',
      tone: data.tone || 'Professional',
      language: data.language || 'English',
      detail_level: data.detail_level || 'Medium',
      objective: data.objective || 'Inform',
      theme: data.theme || 'spotify_emerald',
    });
    return res.data;
  },

  exportPptxData: async (presentation: PresentationDeck, theme: string = 'spotify_emerald') => {
    const res = await apiClient.post(
      '/export-pptx-data',
      { presentation, theme },
      { responseType: 'blob' }
    );
    return {
      blob: res.data as Blob,
      filename: getFilename(res.headers['content-disposition']) || `${(presentation.presentation_title || 'presentation').replace(/\s+/g, '_')}.pptx`,
    };
  },

  exportPptx: async (data: any) => {
    const res = await apiClient.post('/export-pptx', data, {
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
      responseType: 'blob',
    });
    return {
      blob: res.data as Blob,
      filename: getFilename(res.headers['content-disposition']) || 'presentation.pptx',
    };
  },
};

const getFilename = (contentDisposition?: string) => {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1];
};
