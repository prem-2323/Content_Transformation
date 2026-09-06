import { apiClient } from './client';

export interface BrandVoiceProfile {
  brand_name: string;
  brand_tone: string;
  preferred_vocabulary: string[];
  forbidden_phrases: string[];
  hashtag_rules: string;
  formatting_style: string;
  disclaimer: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
}

export interface AudienceReframeRequest {
  text: string;
  audiences?: string[];
  brand_voice?: BrandVoiceProfile;
}

export interface AudienceReframeResponse {
  status: string;
  source_text_length: number;
  reframed_outputs: Record<string, string>;
}

export interface TransformRequest {
  text?: string;
  audience?: string;
  tone?: string;
  language?: string;
  detail_level?: string;
  objective?: string;
  output_types?: string[];
  brand_voice?: BrandVoiceProfile;
}

export const outputTypeAliases: Record<string, string> = {
  'Executive Summary': 'summary',
  'LinkedIn Post': 'linkedin',
  'Twitter/X Post': 'twitter',
  'Advisory': 'advisory',
  'Advisory Memo': 'advisory',
  'Infographic': 'infographic',
  'Infographic Spec': 'infographic',
  'Presentation': 'presentation',
  'Presentation (.pptx)': 'presentation',
  'Video': 'video_script',
  'Video Storyboard': 'video_script',
  'Email Announcement': 'email',
  'Email': 'email',
};

// Backend canonical types (validation.py ALLOWED_OUTPUT_TYPES)
export const canonicalOutputTypes = ['summary', 'linkedin', 'twitter', 'advisory', 'presentation', 'video_script', 'infographic', 'email'] as const;

const canonicalizeToken = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[\/\-&]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

const extendedAliases: Record<string, string> = {
  ...Object.fromEntries(Object.entries(outputTypeAliases).map(([k, v]) => [canonicalizeToken(k), v])),
  video: 'video_script',
  x: 'twitter',
  tweet: 'twitter',
  thread: 'twitter',
  executive_summary: 'summary',
  linkedin_post: 'linkedin',
  advisory_memo: 'advisory',
  infographic_spec: 'infographic',
};

export const normalizeOutputTypes = (types?: string[]): string[] | undefined => {
  if (!types) return types;
  const out: string[] = [];
  for (const t of types) {
    const key = canonicalizeToken(t);
    const mapped = (extendedAliases as Record<string, string>)[key] || key;
    const canonical = (canonicalOutputTypes as readonly string[]).includes(mapped) ? mapped : t.trim().toLowerCase();
    if (!(out as string[]).includes(canonical)) out.push(canonical);
  }
  return out;
};

const normalizeRequest = (data: TransformRequest): TransformRequest => ({
  ...data,
  output_types: normalizeOutputTypes(data.output_types),
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
  },

  // Audience Reframing & Brand Voice Profile API
  reframeAudience: async (data: AudienceReframeRequest): Promise<AudienceReframeResponse> => {
    const res = await apiClient.post<AudienceReframeResponse>('/audience-reframe', data, {
      timeout: 300000,
    });
    return res.data;
  },

  getBrandVoice: async (): Promise<BrandVoiceProfile> => {
    const res = await apiClient.get<BrandVoiceProfile>('/brand-voice/profile');
    return res.data;
  },

  saveBrandVoice: async (profile: BrandVoiceProfile): Promise<BrandVoiceProfile> => {
    const res = await apiClient.post<BrandVoiceProfile>('/brand-voice/profile', profile);
    return res.data;
  }
};
