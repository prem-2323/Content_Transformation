import { apiClient, getApiBaseUrl } from './client';

export interface VoiceItem {
  id: string;
  name: string;
}

export interface AudioRequest {
  text: string;
  voice?: string;
}

export interface VideoAudioRequest {
  video_script: Record<string, any> | string;
  voice?: string;
}

export interface AudioResponse {
  status: string;
  filename: string;
  audio_path: string;
  download_url: string;
  voice: string;
  url?: string;
}

export const audioApi = {
  getVoices: async (): Promise<VoiceItem[]> => {
    const res = await apiClient.get('/audio-voices');
    const data = res.data;
    if (data?.recommended_voices && typeof data.recommended_voices === 'object' && !Array.isArray(data.recommended_voices)) {
      return Object.entries(data.recommended_voices).map(([id, desc]) => ({
        id,
        name: `${desc} (${id})`,
      }));
    }
    if (Array.isArray(data?.recommended_voices)) {
      return data.recommended_voices;
    }
    if (Array.isArray(data)) {
      return data.map((v: any) => typeof v === 'string' ? { id: v, name: v } : v);
    }
    if (Array.isArray(data?.voices)) {
      return data.voices;
    }
    return [
      { id: 'en-US-AriaNeural', name: 'English (US) - Female (Aria) (en-US-AriaNeural)' },
      { id: 'en-GB-SoniaNeural', name: 'English (UK) - Female (Sonia) (en-GB-SoniaNeural)' },
      { id: 'en-IN-NeerjaNeural', name: 'English (India) - Female (Neerja) (en-IN-NeerjaNeural)' }
    ];
  },

  generateAudio: async (data: AudioRequest): Promise<AudioResponse> => {
    const res = await apiClient.post<AudioResponse>('/generate-audio', data);
    return res.data;
  },

  generateVideoAudio: async (data: VideoAudioRequest): Promise<AudioResponse> => {
    const res = await apiClient.post<AudioResponse>('/generate-video-audio', data);
    return res.data;
  },

  getAudioUrl: (filename: string): string => {
    if (!filename) return '';
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }
    const base = getApiBaseUrl() || 'http://localhost:8000';
    const cleanPath = filename.startsWith('/audio/')
      ? filename
      : filename.startsWith('/')
      ? `/audio${filename}`
      : `/audio/${filename}`;
    return `${base.replace(/\/+$/, '')}${cleanPath}`;
  }
};
