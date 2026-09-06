import { apiClient, getApiBaseUrl } from './client';

export interface VideoPlanOptions {
  text: string;
  target_duration?: number; // 10-180, default 30
  pacing?: string; // fast | balanced | cinematic
  language?: string;
  tone?: string;
  audience?: string;
}

export interface VideoGenerateOptions extends VideoPlanOptions {
  voice?: string; // Edge TTS voice, default en-US-AriaNeural
  width?: number; // 256-1024, default 512
  height?: number;
  steps?: number; // 1-40, default 20
}

export interface PlannedScene {
  scene_number: number;
  duration: number;
  visual_prompt: string;
  narration: string;
  on_screen_text: string;
  [key: string]: any;
}

export interface VideoPlan {
  title: string;
  target_duration: number;
  total_calculated_duration: number;
  num_scenes: number;
  scenes: PlannedScene[];
  [key: string]: any;
}

export interface VideoGenerateResponse {
  status: string;
  message: string;
  video_file: string; // e.g. generated_videos/video_abc123.mp4
  subtitle_file: string;
  scenes: number;
  duration: number;
  video_plan?: VideoPlan;
  scene_details?: any[];
}

export const videoApi = {
  // POST /video/plan — pure-python planner, no GPU needed, fast
  planVideo: async (data: VideoPlanOptions): Promise<VideoPlan> => {
    // Backend expects `text` (min 10 chars), not `content`
    const payload = {
      text: data.text,
      target_duration: data.target_duration ?? 30,
      pacing: data.pacing ?? 'balanced',
      language: data.language ?? 'English',
      tone: data.tone ?? 'Professional',
      audience: data.audience ?? 'General public',
    };
    const res = await apiClient.post<VideoPlan>('/video/plan', payload, {
      timeout: 60000,
    });
    return res.data;
  },

  // POST /video/generate-video — full pipeline: planner → Forge SD → EdgeTTS → FFmpeg
  // Takes minutes. Requires Forge at 127.0.0.1:7860 + ffmpeg on PATH.
  generateVideo: async (data: VideoGenerateOptions): Promise<VideoGenerateResponse> => {
    // Accept legacy `{ script }` shape from older UI and map to `text`
    const maybeLegacy = data as any;
    const payload = {
      text: data.text ?? maybeLegacy.script ?? maybeLegacy.content ?? '',
      target_duration: data.target_duration ?? 30,
      pacing: data.pacing ?? 'balanced',
      language: data.language ?? 'English',
      tone: data.tone ?? 'Professional',
      audience: data.audience ?? 'General public',
      voice: data.voice ?? 'en-US-AriaNeural',
      width: data.width ?? 512,
      height: data.height ?? 512,
      steps: data.steps ?? 20,
    };
    const res = await apiClient.post<VideoGenerateResponse>('/video/generate-video', payload, {
      timeout: 600000, // 10 min — image + audio + ffmpeg concat
    });
    return res.data;
  },

  getVideoUrl: (filenameOrPath: string) => {
    if (!filenameOrPath) return '';
    if (filenameOrPath.startsWith('http://') || filenameOrPath.startsWith('https://')) {
      return filenameOrPath;
    }
    // Backend returns "generated_videos/video_xxx.mp4" — serve needs basename only
    const filename = filenameOrPath.split(/[\\/]/).pop() ?? filenameOrPath;
    const base = getApiBaseUrl() || 'http://localhost:8000';
    return `${base.replace(/\/+$/, '')}/video/${filename}`;
  },
};
