import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Bot, User, Sparkles, Trash2, Loader2, Plus, Mic, MicOff,
  Volume2, Square, Download, Play, Image as ImageIcon, Video, Music,
  FileText, BarChart3, Shield, Wand2, Presentation, Copy, Check,
  ChevronDown, ChevronUp, Zap, MessageCircle, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import {
  retrieveWorkspaceContext,
  runSmartAction,
  runAssistantFileAction,
  AssistantResult,
  AssistantAction,
} from '../api/assistant';
import { getApiBaseUrl } from '../api/client';
import { audioApi } from '../api/audio';
import { presentationApi } from '../api/presentation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
  result?: AssistantResult;
  timestamp?: number;
}

interface SuggestionChip {
  icon: React.ReactNode;
  label: string;
  prompt: string;
  color: string;
}

// ─── Suggestion Chips ─────────────────────────────────────────────────────────

const SUGGESTIONS: SuggestionChip[] = [
  { icon: <Wand2 className="w-4 h-4" />, label: 'Transform Content', prompt: 'Transform this into a professional LinkedIn post: ', color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400' },
  { icon: <ImageIcon className="w-4 h-4" />, label: 'Generate Image', prompt: 'Generate an image of ', color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400' },
  { icon: <Video className="w-4 h-4" />, label: 'Plan a Video', prompt: 'Plan a 30 second video about ', color: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400' },
  { icon: <Music className="w-4 h-4" />, label: 'Generate Audio', prompt: 'Read this aloud: ', color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400' },
  { icon: <Presentation className="w-4 h-4" />, label: 'Create PPT', prompt: 'Make a presentation about ', color: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400' },
  { icon: <BarChart3 className="w-4 h-4" />, label: 'Quality Score', prompt: 'Check quality of: ', color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400' },
  { icon: <Shield className="w-4 h-4" />, label: 'Fact Check', prompt: 'Fact check this: ', color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400' },
  { icon: <Eye className="w-4 h-4" />, label: 'Analyze Image', prompt: 'Analyze this image', color: 'from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400' },
];

// ─── Action Status Labels ─────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  chat: { label: 'Thinking', icon: <MessageCircle className="w-4 h-4" /> },
  transform: { label: 'Transforming content', icon: <Wand2 className="w-4 h-4" /> },
  'transform-file': { label: 'Processing file', icon: <FileText className="w-4 h-4" /> },
  image: { label: 'Generating image', icon: <ImageIcon className="w-4 h-4" /> },
  'video-plan': { label: 'Planning video', icon: <Video className="w-4 h-4" /> },
  video: { label: 'Generating video', icon: <Video className="w-4 h-4" /> },
  audio: { label: 'Generating audio', icon: <Music className="w-4 h-4" /> },
  presentation: { label: 'Creating presentation', icon: <Presentation className="w-4 h-4" /> },
  visual: { label: 'Analyzing image', icon: <Eye className="w-4 h-4" /> },
  quality: { label: 'Scoring quality', icon: <BarChart3 className="w-4 h-4" /> },
  consistency: { label: 'Checking facts', icon: <Shield className="w-4 h-4" /> },
  multimodal: { label: 'Analyzing PDF', icon: <FileText className="w-4 h-4" /> },
};

// ─── Copy Button ──────────────────────────────────────────────────────────────

const CopyButton: React.FC<{ text: string; isDarkMode: boolean }> = ({ text, isDarkMode }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className={`p-1.5 rounded-lg transition text-xs flex items-center gap-1 ${isDarkMode ? 'hover:bg-white/10 text-[#b3b3b3]' : 'hover:bg-slate-200 text-slate-500'}`} title="Copy">
      {copied ? <><Check className="w-3 h-3 text-[#1ed760]" /><span className="text-[#1ed760]">Copied</span></> : <><Copy className="w-3 h-3" /><span>Copy</span></>}
    </button>
  );
};

// ─── Collapsible Section ──────────────────────────────────────────────────────

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; isDarkMode: boolean; defaultOpen?: boolean }> = ({ title, children, isDarkMode, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border overflow-hidden mt-2 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
      <button onClick={() => setIsOpen(!isOpen)} className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${isDarkMode ? 'hover:bg-white/5 text-[#b3b3b3]' : 'hover:bg-slate-100 text-slate-600'}`}>
        <span>{title}</span>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className={`px-4 pb-3 ${isDarkMode ? 'border-t border-white/5' : 'border-t border-slate-100'}`}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Rich Result Cards ────────────────────────────────────────────────────────

const ResultCard: React.FC<{ result: AssistantResult; isDarkMode: boolean }> = ({ result, isDarkMode }) => {
  const baseUrl = getApiBaseUrl() || 'http://localhost:8000';

  // ── Image Card ──
  if (result.action === 'image' && result.data) {
    const imageUrl = result.data.image_url?.startsWith('http')
      ? result.data.image_url
      : `${baseUrl}${result.data.image_url || `/image/${result.data.filename}`}`;
    return (
      <div className={`rounded-xl border overflow-hidden mt-3 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
        <img src={imageUrl} alt={result.data.prompt || 'Generated image'} className="w-full max-h-80 object-contain bg-black/20" loading="lazy" />
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
              {result.data.generation_time ? `${result.data.generation_time.toFixed(1)}s` : ''} · {result.data.device || 'GPU'} · {result.data.steps || 10} steps
            </span>
          </div>
          <a href={imageUrl} download className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1ed760]/15 text-[#1ed760] text-xs font-bold hover:bg-[#1ed760]/25 transition">
            <Download className="w-3.5 h-3.5" /> Download
          </a>
        </div>
      </div>
    );
  }

  // ── Audio Card ──
  if (result.action === 'audio' && result.downloadUrl) {
    const audioUrl = result.downloadUrl.startsWith('http') ? result.downloadUrl : `${baseUrl}${result.downloadUrl}`;
    return (
      <div className={`rounded-xl border overflow-hidden mt-3 p-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Music className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Audio Narration</p>
            <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>{result.data?.voice || 'en-US-AriaNeural'}</p>
          </div>
        </div>
        <audio controls className="w-full rounded-lg" preload="metadata">
          <source src={audioUrl} type="audio/mpeg" />
        </audio>
        <div className="mt-2 flex justify-end">
          <a href={audioUrl} download className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1ed760]/15 text-[#1ed760] text-xs font-bold hover:bg-[#1ed760]/25 transition">
            <Download className="w-3.5 h-3.5" /> Download MP3
          </a>
        </div>
      </div>
    );
  }

  // ── Video Card ──
  if (result.action === 'video' && result.downloadUrl) {
    const videoUrl = result.downloadUrl.startsWith('http') ? result.downloadUrl : `${baseUrl}${result.downloadUrl}`;
    return (
      <div className={`rounded-xl border overflow-hidden mt-3 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
        <video controls className="w-full max-h-80 bg-black" preload="metadata">
          <source src={videoUrl} type="video/mp4" />
        </video>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-3.5 h-3.5 text-red-400" />
            <span className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
              {result.data?.scenes || '?'} scenes · {result.data?.duration || 30}s
            </span>
          </div>
          <a href={videoUrl} download className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1ed760]/15 text-[#1ed760] text-xs font-bold hover:bg-[#1ed760]/25 transition">
            <Download className="w-3.5 h-3.5" /> Download
          </a>
        </div>
      </div>
    );
  }

  // ── Video Plan Card ──
  if (result.action === 'video-plan' && result.data?.scenes) {
    return (
      <div className="mt-3 space-y-2">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
          <Video className="w-4 h-4 text-red-400" />
          <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{result.data.title || 'Video Plan'}</span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-white/10 text-[#b3b3b3]' : 'bg-slate-200 text-slate-600'}`}>{result.data.scenes.length} scenes</span>
        </div>
        {result.data.scenes.map((scene: any, i: number) => (
          <CollapsibleSection key={i} title={`Scene ${scene.scene_number || i + 1} — ${scene.duration || 6}s`} isDarkMode={isDarkMode} defaultOpen={i === 0}>
            <div className="space-y-1.5 pt-2">
              <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}><strong className={isDarkMode ? 'text-white' : 'text-slate-800'}>Visual:</strong> {scene.visual_prompt}</p>
              <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}><strong className={isDarkMode ? 'text-white' : 'text-slate-800'}>Narration:</strong> {scene.narration}</p>
              {scene.on_screen_text && <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}><strong className={isDarkMode ? 'text-white' : 'text-slate-800'}>Text:</strong> {scene.on_screen_text}</p>}
            </div>
          </CollapsibleSection>
        ))}
      </div>
    );
  }

  // ── Presentation Card ──
  if (result.action === 'presentation') {
    const slideCount = result.data?.slides?.length || 0;
    return (
      <div className={`rounded-xl border overflow-hidden mt-3 p-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <Presentation className="w-5 h-5 text-green-400" />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{result.data?.title || 'Presentation'}</p>
            <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>{slideCount} slides ready</p>
          </div>
          {result.downloadUrl && (
            <a href={result.downloadUrl} download="presentation.pptx" className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1ed760] text-black text-xs font-bold hover:bg-[#1db954] transition shadow-md">
              <Download className="w-3.5 h-3.5" /> Download .pptx
            </a>
          )}
        </div>
        {result.data?.slides && (
          <CollapsibleSection title="Slide Preview" isDarkMode={isDarkMode}>
            <div className="space-y-2 pt-2">
              {result.data.slides.map((slide: any, i: number) => (
                <div key={i} className={`p-2 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Slide {i + 1}: {slide.title}</p>
                  {slide.points?.map((point: string, j: number) => (
                    <p key={j} className={`text-xs ml-3 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>• {point}</p>
                  ))}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    );
  }

  // ── Quality Score Card ──
  if (result.action === 'quality' && result.data) {
    const score = result.data.overall_score ?? result.data.score ?? 0;
    const grade = result.data.grade || (score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D');
    const gradeColor = score >= 80 ? 'text-[#1ed760]' : score >= 60 ? 'text-amber-400' : 'text-red-400';
    return (
      <div className={`rounded-xl border overflow-hidden mt-3 p-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={isDarkMode ? '#333' : '#e2e8f0'} strokeWidth="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={score >= 80 ? '#1ed760' : score >= 60 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeDasharray={`${score}, 100`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-lg font-black ${gradeColor}`}>{grade}</span>
              <span className={`text-[10px] ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>{score}/100</span>
            </div>
          </div>
          <div className="flex-1">
            <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Content Quality Score</p>
            {result.data.dimensions && (
              <div className="mt-2 space-y-1">
                {Object.entries(result.data.dimensions).slice(0, 4).map(([key, val]: [string, any]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`text-[10px] w-24 truncate ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>{key.replace(/_/g, ' ')}</span>
                    <div className={`flex-1 h-1.5 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`}>
                      <div className="h-full rounded-full bg-[#1ed760]" style={{ width: `${typeof val === 'object' ? val.score || 0 : val || 0}%` }} />
                    </div>
                    <span className={`text-[10px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{typeof val === 'object' ? val.score || 0 : val || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Consistency / Fact Check Card ──
  if (result.action === 'consistency' && result.data) {
    const facts = result.data.facts || [];
    return (
      <div className={`rounded-xl border overflow-hidden mt-3 p-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>UCKR Fact Extraction</p>
            <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>{facts.length} facts extracted</p>
          </div>
        </div>
        {facts.length > 0 && (
          <CollapsibleSection title={`${facts.length} Extracted Facts`} isDarkMode={isDarkMode} defaultOpen>
            <div className="space-y-1.5 pt-2 max-h-60 overflow-y-auto">
              {facts.map((fact: any, i: number) => (
                <div key={i} className={`flex items-start gap-2 p-2 rounded-lg ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <span className="text-[10px] font-mono text-[#1ed760] shrink-0 mt-0.5">{fact.id || `F${i + 1}`}</span>
                  <span className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>{fact.text || fact.claim || JSON.stringify(fact)}</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    );
  }

  // ── Visual Analysis Card ──
  if (result.action === 'visual' && result.data) {
    return (
      <div className={`rounded-xl border overflow-hidden mt-3 p-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-pink-400" />
          </div>
          <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Visual Analysis</p>
        </div>
        {result.data.description && <p className={`text-xs mb-2 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>{result.data.description}</p>}
        {result.data.objects?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {result.data.objects.map((obj: string, i: number) => (
              <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-700'}`}>{obj}</span>
            ))}
          </div>
        )}
        {result.data.visible_text?.length > 0 && (
          <CollapsibleSection title="Extracted Text" isDarkMode={isDarkMode}>
            <div className="pt-2 space-y-1">
              {result.data.visible_text.map((t: string, i: number) => (
                <p key={i} className={`text-xs font-mono ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>{t}</p>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    );
  }

  // ── Multimodal / PDF Card ──
  if (result.action === 'multimodal' && result.data) {
    return (
      <div className={`rounded-xl border overflow-hidden mt-3 p-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>PDF Analysis Complete</p>
            <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Status: {result.data.status}</p>
          </div>
        </div>
        {result.data.result && typeof result.data.result === 'object' && (
          <CollapsibleSection title="Extracted Content" isDarkMode={isDarkMode}>
            <pre className={`text-xs mt-2 whitespace-pre-wrap max-h-48 overflow-y-auto ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
              {JSON.stringify(result.data.result, null, 2).slice(0, 3000)}
            </pre>
          </CollapsibleSection>
        )}
      </div>
    );
  }

  // ── Transform Card ──
  if ((result.action === 'transform' || result.action === 'transform-file') && result.data) {
    // For transform results from the smart-action endpoint, the text IS the output
    if (result.data.output_type) {
      return null; // Text already shown as message bubble
    }
    // For direct API transform results (has deliverables)
    const entries = Object.entries(result.data).filter(([key]) => !['mp3_addons', 'source_text', 'uckr', 'config', 'status'].includes(key));
    if (entries.length === 0) return null;
    return (
      <div className="mt-3 space-y-2">
        {entries.map(([key, value]) => (
          <CollapsibleSection key={key} title={key.replace(/_/g, ' ').toUpperCase()} isDarkMode={isDarkMode}>
            <div className="pt-2">
              <pre className={`text-xs whitespace-pre-wrap max-h-48 overflow-y-auto ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              </pre>
              <CopyButton text={typeof value === 'string' ? value : JSON.stringify(value, null, 2)} isDarkMode={isDarkMode} />
            </div>
          </CollapsibleSection>
        ))}
      </div>
    );
  }

  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const SmartChatbot: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('chat');
  const [isRecording, setIsRecording] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending, scrollToBottom]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  // ── Send Message ────────────────────────────────────────────────────
  const handleSend = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText !== undefined ? customText : input;
    if (!textToSend.trim() || isSending) return;

    setInput('');
    const userMessage: Message = { role: 'user', content: textToSend, timestamp: Date.now() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsSending(true);

    // Detect action for loading indicator
    const { classifyAction } = await import('../api/assistant');
    setCurrentAction(classifyAction(textToSend));

    try {
      const context = retrieveWorkspaceContext(textToSend);
      const apiMessages = updatedMessages.map((m) => ({ role: m.role, content: m.content }));
      const result = await runSmartAction(apiMessages, context);

      const assistantMessage: Message = {
        role: 'assistant',
        content: result.text,
        result: result.action === 'chat' ? undefined : result,
        timestamp: Date.now(),
      };
      setMessages([...updatedMessages, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages([...updatedMessages, {
        role: 'assistant',
        content: error?.message || 'Could not reach the AI backend. Make sure Ollama is running and FastAPI is started on port 8000.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsSending(false);
      setCurrentAction('chat');
    }
  };

  // ── File Upload ─────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isSending) return;

    setMessages((prev) => [...prev, { role: 'user', content: `📎 ${file.name}`, timestamp: Date.now() }]);
    setIsSending(true);
    setCurrentAction(file.type.startsWith('image/') ? 'visual' : file.type === 'application/pdf' ? 'multimodal' : 'transform-file');

    try {
      const result = await runAssistantFileAction(file);
      setMessages((prev) => [...prev, { role: 'assistant', content: result.text, result, timestamp: Date.now() }]);
    } catch (error: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: error?.message || 'File processing failed.', timestamp: Date.now() }]);
    } finally {
      setIsSending(false);
      setCurrentAction('chat');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Voice Input ─────────────────────────────────────────────────────
  const handleToggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Speech recognition is not supported in your browser.'); return; }

    if (isRecording) { setIsRecording(false); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      setInput((prev) => (prev ? `${prev} ${event.results[0][0].transcript}` : event.results[0][0].transcript));
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  // ── Text-to-Speech ──────────────────────────────────────────────────
  const handleToggleSpeech = (index: number, text: string) => {
    if (!('speechSynthesis' in window)) { alert('Text-to-speech not supported.'); return; }
    if (speakingIndex === index) { window.speechSynthesis.cancel(); setSpeakingIndex(null); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  // ── Clear Chat ──────────────────────────────────────────────────────
  const handleClearChat = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeakingIndex(null);
    setMessages([]);
  };

  const isEmptyChat = messages.length === 0;

  return (
    <div className={`max-w-5xl mx-auto py-6 px-4 sm:px-6 h-[calc(100vh-120px)] flex flex-col ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between pb-4 mb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1ed760] to-emerald-600 text-black flex items-center justify-center shadow-lg shadow-[#1ed760]/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>AI Assistant</h2>
            <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
              Connected to all studios · Transform · Image · Video · Audio · PPT · Quality
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button onClick={handleClearChat} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition border ${isDarkMode ? 'bg-[#181818] hover:bg-[#282828] text-[#b3b3b3] hover:text-white border-[#4d4d4d]' : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-300 shadow-sm'}`}>
            <Trash2 className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        )}
      </div>

      {/* ── Chat Area ─────────────────────────────────────────────── */}
      <div className={`flex-1 rounded-2xl border shadow-lg overflow-y-auto mb-4 transition-colors duration-300 ${isDarkMode ? 'glass-card border-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.6)]' : 'bg-white border-slate-200 shadow-sm'}`}>

        {/* ── Welcome Screen ──────────────────────────────────────── */}
        {isEmptyChat && !isSending && (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1ed760] to-emerald-600 flex items-center justify-center mb-6 shadow-xl shadow-[#1ed760]/30"
            >
              <Sparkles className="w-10 h-10 text-black" />
            </motion.div>
            <h3 className={`text-2xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>What can I help you with?</h3>
            <p className={`text-sm mb-8 max-w-md text-center ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
              I'm connected to all ContentForge studios. Ask me to transform text, generate images, plan videos, create audio, build presentations, or check quality.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl">
              {SUGGESTIONS.map((chip, idx) => (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                  onClick={() => {
                    setInput(chip.prompt);
                    inputRef.current?.focus();
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border bg-gradient-to-br ${chip.color} transition-all hover:scale-105 hover:shadow-lg cursor-pointer group`}
                >
                  <div className="transition-transform group-hover:scale-110">
                    {chip.icon}
                  </div>
                  <span className="text-xs font-bold text-center">{chip.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ── Messages ────────────────────────────────────────────── */}
        {!isEmptyChat && (
          <div className="p-6 space-y-4">
            {messages.map((msg, index) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-start space-x-3 ${isAssistant ? '' : 'flex-row-reverse space-x-reverse'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isAssistant
                    ? 'bg-gradient-to-br from-[#1ed760] to-emerald-600 text-black shadow-sm'
                    : isDarkMode ? 'bg-[#282828] text-white border border-[#4d4d4d]' : 'bg-slate-200 text-slate-800 border border-slate-300'
                  }`}>
                    {isAssistant ? <Sparkles className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  <div className={`max-w-3xl px-4 py-3 rounded-2xl text-sm leading-relaxed relative group ${
                    isAssistant
                      ? isDarkMode
                        ? 'glass-panel text-white border-white/10 rounded-tl-none'
                        : 'bg-slate-100 text-slate-900 border border-slate-200 rounded-tl-none'
                      : 'bg-[#1ed760] text-black font-medium rounded-tr-none shadow-md'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {/* Rich Result Card */}
                    {msg.result && <ResultCard result={msg.result} isDarkMode={isDarkMode} />}

                    {/* Message Actions */}
                    {isAssistant && (
                      <div className={`mt-2 pt-2 border-t flex items-center justify-end gap-2 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                        <CopyButton text={msg.content} isDarkMode={isDarkMode} />
                        <button
                          onClick={() => handleToggleSpeech(index, msg.content)}
                          className={`p-1 rounded transition flex items-center space-x-1 text-xs ${isDarkMode ? 'hover:bg-[#282828] text-[#b3b3b3] hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'}`}
                          title={speakingIndex === index ? 'Stop' : 'Listen'}
                        >
                          {speakingIndex === index
                            ? <><Square className="w-3.5 h-3.5 fill-red-400 text-red-400" /><span className="text-red-400 font-semibold">Stop</span></>
                            : <><Volume2 className="w-3.5 h-3.5 text-[#1ed760]" /><span>Listen</span></>
                          }
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* ── Typing Indicator ──────────────────────────────────── */}
            {isSending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start space-x-3"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1ed760] to-emerald-600 text-black flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className={`border px-4 py-3 rounded-2xl rounded-tl-none flex items-center space-x-3 ${isDarkMode ? 'bg-[#121212] border-[#282828]' : 'bg-slate-100 border-slate-200'}`}>
                  {ACTION_LABELS[currentAction]?.icon || <Loader2 className="w-4 h-4 animate-spin text-[#1ed760]" />}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                      {ACTION_LABELS[currentAction]?.label || 'Thinking'}...
                    </span>
                    <div className="flex space-x-1">
                      <motion.div className="w-1.5 h-1.5 rounded-full bg-[#1ed760]" animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} />
                      <motion.div className="w-1.5 h-1.5 rounded-full bg-[#1ed760]" animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} />
                      <motion.div className="w-1.5 h-1.5 rounded-full bg-[#1ed760]" animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input ──────────────────────────────────────────────────── */}
      <form onSubmit={(e) => handleSend(e)} className={`rounded-2xl border p-3 shadow-lg flex items-center space-x-3 transition-colors duration-300 ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-md'}`}>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,.txt,.pdf,.doc,.docx,.csv,.json" />

        <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-3 rounded-xl border transition flex items-center justify-center ${isDarkMode ? 'bg-[#121212] hover:bg-[#282828] border-[#4d4d4d] text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'}`} title="Upload file">
          <Plus className="w-4 h-4 text-[#1ed760]" />
        </button>

        <div className="relative flex items-center">
          {isRecording && (
            <motion.div className="absolute -inset-2 rounded-2xl bg-red-500/20 border border-red-500/40 pointer-events-none" animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }} transition={{ repeat: Infinity, duration: 1.2 }} />
          )}
          <button type="button" onClick={handleToggleMic} className={`p-3 rounded-xl border transition flex items-center justify-center relative z-10 ${isRecording ? 'bg-red-500/30 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : isDarkMode ? 'bg-[#121212] hover:bg-[#282828] border-[#4d4d4d] text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'}`} title={isRecording ? 'Stop recording' : 'Voice input'}>
            {isRecording ? <MicOff className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4 text-[#1ed760]" />}
          </button>
        </div>

        {isRecording && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded-lg">
            <motion.div className="w-1 bg-red-500 rounded-full" animate={{ height: [6, 18, 6] }} transition={{ repeat: Infinity, duration: 0.5 }} />
            <motion.div className="w-1 bg-red-500 rounded-full" animate={{ height: [12, 4, 16] }} transition={{ repeat: Infinity, duration: 0.4 }} />
            <motion.div className="w-1 bg-red-500 rounded-full" animate={{ height: [8, 20, 10] }} transition={{ repeat: Infinity, duration: 0.6 }} />
            <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider ml-1">Recording...</span>
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isRecording ? 'Listening...' : 'Ask anything — transform, generate, analyze...'}
          className={`flex-1 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition-colors ${isDarkMode ? 'bg-[#121212] border-[#4d4d4d] text-white placeholder-[#b3b3b3]' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'}`}
        />

        <button type="submit" disabled={!input.trim() || isSending} className="px-6 py-3 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition disabled:opacity-50 shadow-[0_4px_12px_rgba(30,215,96,0.3)] shrink-0">
          <span>Send</span>
          <Send className="w-4 h-4 fill-black" />
        </button>
      </form>
    </div>
  );
};
