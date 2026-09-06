import { apiClient } from './client';

export interface ExtractFactsRequest {
  raw_text?: string;
  text?: string;
  url?: string;
  title?: string;
}

export interface AnalyzeConsistencyRequest {
  raw_text?: string;
  text?: string;
  normalized_source?: any;
  title?: string;
}

export interface GenerateGroundedRequest {
  uckr: any;
  config?: {
    output_types?: string[];
    audience?: string;
    tone?: string;
    language?: string;
    slide_count?: number;
    video_duration?: number;
  };
}

export interface PipelineRequest {
  raw_text?: string;
  text?: string;
  url?: string;
  title?: string;
  output_types?: string;
  audience?: string;
  tone?: string;
  language?: string;
  target_language?: string;
  slide_count?: number;
  video_duration?: number;
}

export interface QualityScoreRequest {
  text: string;
  output_type?: string;
  audience?: string;
  tone?: string;
  source_text?: string;
}

export interface TranslateRequest {
  target_language: string;
  text?: string;
  uckr?: any;
  outputs?: any;
}

export interface AuditRequest {
  source_id: string;
  outputs: Record<string, any>;
}

export interface ValidateRequest {
  uckr: any;
  outputs: Record<string, any>;
}

export interface RepairRequest {
  uckr: any;
  outputs: Record<string, any>;
}

export interface DiffRequest {
  v1: any;
  v2: any;
}

export interface RegenerateAffectedRequest {
  uckr_v2: any;
  diff: any;
  previous_outputs: Record<string, any>;
  config?: any;
}

export interface EvidenceRequest {
  uckr: any;
  outputs: Record<string, any>;
  source_id?: string;
}

export const consistencyApi = {
  extractFacts: async (data: ExtractFactsRequest | FormData) => {
    if (data instanceof FormData) {
      const res = await apiClient.post('/consistency/extract', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    }
    const payload = {
      raw_text: data.raw_text || data.text,
      url: data.url,
      title: data.title,
    };
    const res = await apiClient.post('/consistency/extract', payload);
    return res.data;
  },

  analyzeConsistency: async (data: AnalyzeConsistencyRequest) => {
    const payload = {
      ...data,
      raw_text: data.raw_text || data.text,
    };
    const res = await apiClient.post('/consistency/analyze', payload);
    return res.data;
  },

  getRegistryFacts: async (sourceId: string, query?: string, minImportance?: number) => {
    const params: Record<string, any> = {};
    if (query) params.q = query;
    if (minImportance !== undefined) params.min_importance = minImportance;
    const res = await apiClient.get(`/consistency/registry/${encodeURIComponent(sourceId)}/facts`, { params });
    return res.data;
  },

  generateGrounded: async (data: GenerateGroundedRequest) => {
    const res = await apiClient.post('/consistency/generate', data);
    return res.data;
  },

  runPipeline: async (data: PipelineRequest | FormData) => {
    if (data instanceof FormData) {
      const res = await apiClient.post('/consistency/pipeline', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    }
    const payload = {
      ...data,
      raw_text: data.raw_text || data.text,
    };
    const res = await apiClient.post('/consistency/pipeline', payload);
    return res.data;
  },

  getQualityScore: async (data: QualityScoreRequest) => {
    const res = await apiClient.post('/consistency/quality-score', data);
    return res.data;
  },

  translateContent: async (data: TranslateRequest) => {
    const res = await apiClient.post('/consistency/translate', data);
    return res.data;
  },

  getLanguages: async (): Promise<string[]> => {
    const res = await apiClient.get('/consistency/languages');
    const data = res.data;
    if (data?.languages && typeof data.languages === 'object' && !Array.isArray(data.languages)) {
      return Object.keys(data.languages);
    }
    if (Array.isArray(data?.languages)) {
      return data.languages;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [
      'English',
      'Hindi',
      'Tamil',
      'Telugu',
      'Malayalam',
      'Kannada',
      'Bengali',
      'Marathi',
      'Gujarati',
      'Spanish',
      'French',
      'German',
      'Japanese',
    ];
  },

  // ---------------------------------------------------------------------------
  // Newly Integrated Consistency Endpoints
  // ---------------------------------------------------------------------------

  audit: async (data: AuditRequest) => {
    const res = await apiClient.post('/consistency/audit', data);
    return res.data;
  },

  validate: async (data: ValidateRequest) => {
    const res = await apiClient.post('/consistency/validate', data);
    return res.data;
  },

  repair: async (data: RepairRequest) => {
    const res = await apiClient.post('/consistency/repair', data);
    return res.data;
  },

  diff: async (data: DiffRequest) => {
    const res = await apiClient.post('/consistency/diff', data);
    return res.data;
  },

  regenerateAffected: async (data: RegenerateAffectedRequest) => {
    const res = await apiClient.post('/consistency/regenerate-affected', data);
    return res.data;
  },

  getEvidence: async (data: EvidenceRequest) => {
    const res = await apiClient.post('/consistency/evidence', data, {
      timeout: 120000,
    });
    return res.data;
  },
};
