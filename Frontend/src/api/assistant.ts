import { apiClient } from './client';
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
  | 'audio'
  | 'presentation';

export interface AssistantResult {
  action: AssistantAction;
  title: string;
  text: string;
  data?: any;
  downloadUrl?: string;
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

const classifyAction = (text: string): AssistantAction => {
  const value = text.toLowerCase();
  if (/(multimodal|pdf|document upload|analyze this file)/.test(value)) return 'multimodal';
  if (/(image|poster|illustration|visual|picture|generate an image)/.test(value)) return 'image';
  if (/(video plan|video storyboard|plan a video|scene plan)/.test(value)) return 'video-plan';
  if (/(voice|audio|narrat|text to speech|read this aloud)/.test(value)) return 'audio';
  if (/(ppt|powerpoint|presentation|slides)/.test(value)) return 'presentation';
  if (/(transform|rewrite|summar|linkedin|tweet|email|advisory|infographic|content for)/.test(value)) return 'transform';
  return 'chat';
};

const cleanSource = (text: string) => text.replace(/^(transform|rewrite|summarize|create|make)\s+/i, '').trim() || text;

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
    return { action, title: 'Image generated', text: imageUrl, data: { ...data, image_url: imageUrl }, downloadUrl: imageUrl };
  }

  if (action === 'video-plan') {
    const data = await videoApi.planVideo({ text: source.length >= 10 ? source : `Create a video plan about ${source}` });
    return { action, title: 'Video plan ready', text: `${data.title} with ${data.num_scenes} scenes.`, data };
  }

  if (action === 'audio') {
    const data = await audioApi.generateAudio({ text: source });
    return { action, title: 'Voice narration ready', text: 'Your audio narration is ready.', data, downloadUrl: audioApi.getAudioUrl(data.download_url || data.filename) };
  }

  if (action === 'presentation') {
    const data = await presentationApi.exportPptx({ text: source, title: 'ContentForge Presentation' });
    return { action, title: 'Presentation ready', text: 'Your PowerPoint file is ready to download.', data, downloadUrl: URL.createObjectURL(data.blob) };
  }

  throw new Error('Use the attachment button to send a PDF or document for file processing.');
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