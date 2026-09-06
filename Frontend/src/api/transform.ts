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

const outputTypeAliases: Record<string, string> = {
  'Executive Summary': 'summary',
  'LinkedIn Post': 'linkedin',
  'Twitter/X Post': 'twitter',
  'Advisory': 'advisory',
  'Infographic': 'infographic',
  'Presentation': 'presentation',
  'Video': 'video_script',
};

const normalizeRequest = (data: TransformRequest): TransformRequest => ({
  ...data,
  output_types: data.output_types?.map((outputType) =>
    outputTypeAliases[outputType] || outputType
  ),
});

export const transformApi = {
  transformText: async (data: TransformRequest) => {
    const res = await apiClient.post('/transform', normalizeRequest(data), {
      timeout: 600000,
    });
    return res.data;
  },

  transformFile: async (formData: FormData) => {
    const res = await apiClient.post('/transform-file', formData, {
      timeout: 600000,
    });
    return res.data;
  },

  getModels: async () => {
    const res = await apiClient.get('/v1/models');
    return res.data;
  }
};
