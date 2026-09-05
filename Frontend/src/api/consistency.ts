import { apiClient } from './client';

export const consistencyApi = {
  extractFacts: async (data: any) => {
    const res = await apiClient.post('/consistency/extract', data);
    return res.data;
  },

  analyzeConsistency: async (data: any) => {
    const res = await apiClient.post('/consistency/analyze', data);
    return res.data;
  },

  getRegistryFacts: async (sourceId: string) => {
    const res = await apiClient.get(`/consistency/registry/${sourceId}/facts`);
    return res.data;
  },

  generateGrounded: async (data: any) => {
    const res = await apiClient.post('/consistency/generate', data);
    return res.data;
  },

  runPipeline: async (data: any) => {
    const res = await apiClient.post('/consistency/pipeline', data);
    return res.data;
  },

  getQualityScore: async (data: any) => {
    const res = await apiClient.post('/consistency/quality-score', data);
    return res.data;
  },

  translateContent: async (data: any) => {
    const res = await apiClient.post('/consistency/translate', data);
    return res.data;
  },

  getLanguages: async () => {
    const res = await apiClient.get('/consistency/languages');
    return res.data;
  }
};
