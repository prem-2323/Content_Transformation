import { apiClient, getApiBaseUrl } from './client';
import { audioApi } from './audio';
import { imageApi } from './image';
import { multimodalApi } from './multimodal';
import { presentationApi } from './presentation';
import { transformApi } from './transform';
import { videoApi } from './video';

export type AssistantAction =
  | 'chat'
  | 'transform'
  | 'transform-file'
  | 'multimodal'
  | 'image'
  | 'video-plan'
  | 'video'
  | 'audio'
  | 'presentation'
  | 'visual'
  | 'quality'
  | 'consistency';

export interface AssistantResult {
  action: AssistantAction;
  title: string;
  text: string;
  data?: any;
  downloadUrl?: string;
  mediaType?: 'image' | 'audio' | 'video' | 'document' | null;
  intent?: string;
  model?: string;
}

const latestUserText = (messages: Array<{ role: string; content: string }>) =>
  [...messages].reverse().find((message) => message.role === 'user')?.content || '';

export const retrieveWorkspaceContext = (query: string): string => {
  if (typeof window === 'undefined') return '';
  try {
    const history = JSON.parse(localStorage.getItem('contentforge_transformation_history') || '[]');
    const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2).slice(0, 12);
    return history
      .filter((item: any) => {
        const haystack = JSON.stringify(item).toLowerCase();
        return terms.length === 0 || terms.some((term) => haystack.includes(term));
      })
      .slice(0, 3)
      .map((item: any) => `Source: ${item.sourceText}\nConfig: ${JSON.stringify(item.config)}\nResult: ${JSON.stringify(item.result).slice(0, 4000)}`)
      .join('\n\n');
  } catch {
    return '';
  }
};

export const classifyAction = (text: string): AssistantAction => {
  const value = text.toLowerCase();

  // Image generation
  if (/(generate\s+(an?\s+)?image|create\s+(an?\s+)?image|make\s+(an?\s+)?image|draw\s+(me\s+)?a|make\s+a\s+poster|design\s+a|illustration\s+of|picture\s+of)/.test(value)) return 'image';

  // Visual / image analysis
  if (/(analyze\s+(this\s+)?image|analyse\s+image|describe\s+(this\s+)?image|what\s+is\s+in\s+this\s+image|extract\s+text\s+from\s+image|ocr|read\s+this\s+image|identify\s+objects|what\s+do\s+you\s+see|analyze\s+(this\s+)?photo)/.test(value)) return 'visual';

  // Video generation (full pipeline)
  if (/(generate\s+(a\s+)?video|create\s+(a\s+)?video|make\s+(a\s+)?video|produce\s+(a\s+)?video)/.test(value)) return 'video';

  // Video plan
  if (/(video\s+plan|plan\s+a\s+video|plan\s+video|video\s+storyboard|storyboard|scene\s+plan|video\s+script)/.test(value)) return 'video-plan';

  // Audio / TTS
  if (/(generate\s+audio|generate\s+narration|text\s+to\s+speech|read\s+(this\s+)?aloud|narrate\s+this|speak\s+this|voice\s?over|create\s+audio|make\s+audio|tts)/.test(value)) return 'audio';

  // Presentation / PPT
  if (/(make\s+(a\s+)?presentation|create\s+(a\s+)?presentation|generate\s+(a\s+)?presentation|make\s+ppt|create\s+ppt|generate\s+ppt|powerpoint|make\s+slides|create\s+slides|export\s+pptx)/.test(value)) return 'presentation';

  // Quality
  if (/(quality\s+score|quality\s+check|check\s+quality|score\s+this|rate\s+this|evaluate\s+quality|content\s+quality)/.test(value)) return 'quality';

  // Consistency / Fact check
  if (/(consistency\s+check|check\s+consistency|fact\s+check|fact-check|verify\s+facts|is\s+this\s+true|uckr|extract\s+facts|consistency\s+pipeline)/.test(value)) return 'consistency';

  // Multimodal / PDF
  if (/(multimodal|pdf|document\s+upload|analyze\s+this\s+file)/.test(value)) return 'multimodal';

  // Transform
  if (/(transform|rewrite|summar|linkedin|tweet|email|advisory|infographic|content\s+for)/.test(value)) return 'transform';

  return 'chat';
};

const cleanSource = (text: string) => text.replace(/^(transform|rewrite|summarize|create|make|generate|draw|plan|check|analyze|build|produce|design|narrate|speak|read)\s+(a\s+|an\s+|me\s+|this\s+)?/i, '').trim() || text;

/**
 * Run a smart action via the backend — routes through intent detection
 * to the appropriate platform API and returns structured results.
 */
export const runSmartAction = async (
  messages: Array<{ role: string; content: string }>,
  context: string,
): Promise<AssistantResult> => {
  const text = latestUserText(messages);
  const action = classifyAction(text);

  // For file-dependent actions, fall back to the direct API call
  if (action === 'visual') {
    // Visual analysis requires a file upload — can't go through smart-action
    return { action: 'chat', title: 'Upload required', text: 'Please upload an image using the attachment button to analyze it.' };
  }

  try {
    const response = await apiClient.post('/api/ai/smart-action', {
      messages,
      context,
    }, { timeout: 300000 });

    const data = response.data;
    const baseUrl = getApiBaseUrl() || 'http://localhost:8000';

    // Resolve relative URLs to absolute
    let downloadUrl = data.download_url;
    if (downloadUrl && !downloadUrl.startsWith('http')) {
      downloadUrl = `${baseUrl.replace(/\/+$/, '')}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
    }

    let resultData = data.data;
    // Resolve image URL in data
    if (resultData?.image_url && !resultData.image_url.startsWith('http')) {
      resultData = {
        ...resultData,
        image_url: `${baseUrl.replace(/\/+$/, '')}${resultData.image_url.startsWith('/') ? '' : '/'}${resultData.image_url}`,
      };
    }

    return {
      action: data.action || action,
      title: data.action === 'chat' ? 'Assistant response' : `${data.action} result`,
      text: data.text || 'Done.',
      data: resultData,
      downloadUrl,
      mediaType: data.media_type,
      intent: data.intent,
      model: data.model,
    };
  } catch (error: any) {
    console.error('Smart action failed, falling back to direct API:', error);
    // Fallback: try the direct frontend→API approach
    return runAssistantAction(messages, context);
  }
};

/**
 * Direct frontend→API approach (fallback / legacy)
 */
export const runAssistantAction = async (
  messages: Array<{ role: string; content: string }>,
  context: string,
): Promise<AssistantResult> => {
  const text = latestUserText(messages);
  const action = classifyAction(text);
  const source = cleanSource(text);

  if (action === 'chat') {
    const response = await apiClient.post('/api/ai/chat', { messages, context }, { timeout: 180000 });
    return { action, title: 'Assistant response', text: response.data.reply || 'I am ready to help.' };
  }

  if (action === 'transform') {
    const data = await transformApi.transformText({ text: source, audience: 'General', tone: 'Professional', language: 'English', detail_level: 'Balanced', objective: 'Inform', output_types: ['summary', 'linkedin'] });
    return { action, title: 'Content transformed', text: 'I created grounded outputs from your request.', data };
  }

  if (action === 'image') {
    const data = await imageApi.generateImage({ prompt: source });
    const imageUrl = data.image_url?.startsWith('http') ? data.image_url : imageApi.getImageUrl(data.filename);
    return { action, title: 'Image generated', text: imageUrl, data: { ...data, image_url: imageUrl }, downloadUrl: imageUrl, mediaType: 'image' };
  }

  if (action === 'video-plan') {
    const data = await videoApi.planVideo({ text: source.length >= 10 ? source : `Create a video plan about ${source}` });
    return { action, title: 'Video plan ready', text: `${data.title} with ${data.num_scenes} scenes.`, data };
  }

  if (action === 'video') {
    const data = await videoApi.generateVideo({ text: source.length >= 10 ? source : `Create a video about ${source}` });
    const videoUrl = videoApi.getVideoUrl(data.video_file);
    return { action, title: 'Video generated', text: data.message || 'Your video is ready.', data, downloadUrl: videoUrl, mediaType: 'video' };
  }

  if (action === 'audio') {
    const data = await audioApi.generateAudio({ text: source });
    return { action, title: 'Voice narration ready', text: 'Your audio narration is ready.', data, downloadUrl: audioApi.getAudioUrl(data.download_url || data.filename), mediaType: 'audio' };
  }

  if (action === 'presentation') {
    const data = await presentationApi.exportPptx({ text: source, title: 'ContentForge Presentation' });
    return { action, title: 'Presentation ready', text: 'Your PowerPoint file is ready to download.', data, downloadUrl: URL.createObjectURL(data.blob), mediaType: 'document' };
  }

  // Default: chat fallback
  const response = await apiClient.post('/api/ai/chat', { messages, context }, { timeout: 180000 });
  return { action: 'chat', title: 'Assistant response', text: response.data.reply || 'I am ready to help.' };
};

export const runAssistantFileAction = async (file: File): Promise<AssistantResult> => {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const formData = new FormData();
    formData.append('file', file);
    const job = await multimodalApi.transformPdf(formData);
    let status = await multimodalApi.getStatus(job.job_id);
    for (let attempt = 0; attempt < 90 && !['completed', 'failed'].includes(status.status); attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      status = await multimodalApi.getStatus(job.job_id);
    }
    if (status.status === 'failed') throw new Error(status.error || 'Multimodal processing failed.');
    return { action: 'multimodal', title: 'Multimodal document analyzed', text: 'The PDF was processed for text, images, and grounded outputs.', data: status };
  }

  if (file.type.startsWith('image/')) {
    // Route images to visual analysis
    const { visualApi } = await import('./visual');
    const result = await visualApi.analyzeImage(file, 'description', 'Analyze this image in detail');
    return {
      action: 'visual',
      title: 'Image analyzed',
      text: result.result?.description || 'Image analysis complete.',
      data: result.result,
      mediaType: 'image',
    };
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('audience', 'General');
  formData.append('tone', 'Professional');
  formData.append('language', 'English');
  formData.append('detail_level', 'Balanced');
  formData.append('objective', 'Inform');
  formData.append('output_types', 'summary,linkedin');
  const data = await transformApi.transformFile(formData);
  return { action: 'transform-file', title: 'File transformed', text: `Processed ${file.name} into grounded content outputs.`, data };
};