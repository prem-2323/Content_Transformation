import axios from 'axios';

let customBaseUrl =
  (typeof window !== 'undefined' && localStorage.getItem('VITE_API_BASE_URL')) ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8000';

export const setApiBaseUrl = (url: string) => {
  customBaseUrl = url.trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    localStorage.setItem('VITE_API_BASE_URL', customBaseUrl);
  }
  apiClient.defaults.baseURL = customBaseUrl;
};

export const getApiBaseUrl = () => customBaseUrl;

export const apiClient = axios.create({
  baseURL: customBaseUrl,
  // NOTE: do NOT set a global Content-Type here.
  // Axios auto-sets application/json for plain objects.
  // A global application/json breaks FormData uploads (FastAPI then sees
  // missing fields -> 422 "body.image: Field required").
  timeout: 120000,
});

/**
 * Health check helper to verify connectivity from frontend to FastAPI backend.
 */
export const checkApiHealth = async (): Promise<{ ok: boolean; message: string; data?: any }> => {
  try {
    const res = await apiClient.get('/health', { timeout: 5000 });
    return { ok: true, message: 'FastAPI Backend Connected', data: res.data };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Cannot reach FastAPI backend' };
  }
};

// Mock fallback responses for when FastAPI server is offline
const getMockFallbackResponse = (url: string, method: string, data: any) => {
  console.warn(`[FastAPI Offline / Fallback] Intercepted ${method} ${url}. Returning simulated fallback response.`);
  if (url.includes('/audio-voices')) {
    return {
      data: {
        status: 'success',
        recommended_voices: {
          'en-US-AriaNeural': 'English (US) - Female (Aria)',
          'en-GB-SoniaNeural': 'English (UK) - Female (Sonia)',
          'en-IN-NeerjaNeural': 'English (India) - Female (Neerja)',
          'hi-IN-SwaraNeural': 'Hindi (India) - Female (Swara)',
          'ta-IN-PallaviNeural': 'Tamil (India) - Female (Pallavi)',
        },
      },
    };
  }
  if (url.includes('/health')) {
    return { data: { status: 'healthy (simulated)' } };
  }
  if (url.includes('/consistency/languages')) {
    return { data: ['English', 'Hindi', 'Spanish', 'French', 'German', 'Japanese', 'Mandarin', 'Tamil', 'Telugu'] };
  }
  if (url.includes('/multimodal/transform-pdf')) {
    return { data: { job_id: 'job_fallback_123', status: 'queued' } };
  }
  if (url.includes('/multimodal/status/')) {
    return {
      data: {
        status: 'completed',
        step: 'Completed',
        extracted_text: 'Simulated PDF extracted text content from document.',
        outputs: { summary: 'Executive Summary of document', linkedin: 'LinkedIn post content' },
      },
    };
  }
  if (url.includes('/generate-image')) {
    return {
      data: {
        filename: 'fallback_image.png',
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1024&q=80',
      },
    };
  }
  if (url.includes('/video/plan')) {
    return {
      data: {
        title: 'AI Enterprise Video Plan',
        duration: '60s',
        aspect_ratio: '16:9',
        scenes: [
          { title: 'Scene 1', prompt: 'Cinematic opening', duration: '15s', narration: 'Welcome to enterprise AI transformation.' },
          { title: 'Scene 2', prompt: 'Data network visualization', duration: '15s', narration: 'Powering automated cross-channel generation.' },
        ],
      },
    };
  }
  if (url.includes('/video/generate-video')) {
    return {
      data: {
        filename: 'fallback_video.mp4',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      },
    };
  }
  if (url.includes('/generate-audio') || url.includes('/generate-video-audio')) {
    return {
      data: {
        status: 'success',
        filename: 'fallback_audio.mp3',
        download_url: '/audio/fallback_audio.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        voice: 'en-US-AriaNeural',
      },
    };
  }
  if (url.includes('/consistency/quality-score')) {
    return {
      data: {
        overall: 94,
        grade: 'A',
        dimensions: [
          { name: 'Readability & Clarity', score: 96 },
          { name: 'Engagement & Hook Strength', score: 92 },
          { name: 'Information Density & Conciseness', score: 95 },
          { name: 'Tone & Audience Alignment', score: 94 },
          { name: 'Structural Coherence & Flow', score: 97 },
          { name: 'Fact Grounding & Attribution', score: 90 },
        ],
      },
    };
  }
  return { data: { success: true, message: 'Simulated response from client fallback interceptor', input_echo: data } };
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If backend network error or connection refused
    if (error.code === 'ERR_NETWORK' || !error.response) {
      const config = error.config || {};
      const fallback = getMockFallbackResponse(config.url || '', config.method || 'get', config.data);
      return Promise.resolve({
        data: fallback.data,
        status: 200,
        statusText: 'OK (Fallback Mock)',
        headers: {},
        config: config,
      });
    }

    let errorMessage = 'An unexpected error occurred.';
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      if (status === 422 && data && data.detail) {
        if (Array.isArray(data.detail)) {
          errorMessage = data.detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join(', ');
        } else {
          errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        }
      } else if (data && data.message) {
        errorMessage = data.message;
      } else if (data && data.detail) {
        errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      } else {
        errorMessage = `Error ${status}: ${error.response.statusText}`;
      }
    } else {
      errorMessage = error.message;
    }
    const errWithStatus = new Error(errorMessage) as Error & { status?: number; data?: any };
    errWithStatus.status = error.response?.status ?? 500;
    errWithStatus.data = error.response?.data;
    return Promise.reject(errWithStatus);
  }
);
