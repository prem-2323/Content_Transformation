import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Sparkles,
  RefreshCw,
  Download,
  Volume2,
  Mic,
  Film,
  Clapperboard,
  Clock,
  Settings2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  Trash2,
  Layers,
  FileText,
  Zap,
  Play,
  Share2,
  X,
  Gauge,
  MonitorPlay,
  RotateCcw
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { videoApi, VideoPlan, VideoGenerateResponse } from '../api/video';
import { audioApi, VoiceItem } from '../api/audio';
import { imageApi } from '../api/image';

interface VideoHistoryItem {
  id: string;
  title: string;
  prompt: string;
  videoUrl: string;
  subtitleUrl?: string;
  duration: number;
  scenesCount: number;
  timestamp: string;
  resolution: string;
  voice: string;
}

const PRESET_PROMPTS = [
  {
    title: '⚡ Enterprise AI Cloud',
    text: 'Enterprise AI infrastructure is transforming global businesses by integrating autonomous agent workflows, distributed cloud architectures, and real-time operational intelligence.',
    pacing: 'balanced',
    duration: 30,
    tone: 'Professional',
  },
  {
    title: '🌌 Quantum Frontiers',
    text: 'Quantum computing unlocks exponential computational supremacy, breaking cryptographic boundaries and simulating quantum molecular dynamics for breakthrough drug discovery.',
    pacing: 'cinematic',
    duration: 35,
    tone: 'Cinematic',
  },
  {
    title: '🚀 Deep Space Colonization',
    text: 'Humanity reaches beyond the solar system with thermonuclear ion drives, terraforming Martian ecosystems, and deploying self-assembling orbital megastructures.',
    pacing: 'cinematic',
    duration: 40,
    tone: 'Inspiring',
  },
  {
    title: '🛡️ Zero-Trust Cybersecurity',
    text: 'Modern cyber defense leverages AI-driven behavioral threat detection, quantum-resistant encryption, and autonomous incident containment to protect critical infrastructure.',
    pacing: 'fast',
    duration: 25,
    tone: 'Authoritative',
  },
  {
    title: '🌿 Clean Fusion Grid',
    text: 'Next-generation magnetic confinement fusion reactors achieve net energy gain, supplying limitless carbon-free electricity to sustainable zero-emission megacities.',
    pacing: 'balanced',
    duration: 30,
    tone: 'Educational',
  }
];

const RESOLUTION_OPTIONS = [
  { id: 'landscape', label: '16:9 Landscape', width: 768, height: 512, desc: 'YouTube & Desktop Video' },
  { id: 'square', label: '1:1 Square', width: 512, height: 512, desc: 'Instagram & Feed Posts' },
  { id: 'portrait', label: '9:16 Portrait', width: 512, height: 768, desc: 'Shorts, Reels & TikTok' },
  { id: 'widescreen_hd', label: '16:9 HD', width: 1024, height: 576, desc: 'High-Res Presentation' },
];

export const VideoGenerator: React.FC = () => {
  const { isDarkMode } = useTheme();

  // Core generation states
  const [prompt, setPrompt] = useState(
    'Artificial intelligence is revolutionizing modern manufacturing with automated robotic precision, predictive maintenance algorithms, and autonomous supply chains.'
  );
  const [targetDuration, setTargetDuration] = useState<number>(30);
  const [pacing, setPacing] = useState<'fast' | 'balanced' | 'cinematic'>('balanced');
  const [selectedResolution, setSelectedResolution] = useState(RESOLUTION_OPTIONS[0]);
  const [steps, setSteps] = useState<number>(20);
  const [tone, setTone] = useState<string>('Professional');
  const [audience, setAudience] = useState<string>('General public');
  const [language, setLanguage] = useState<string>('English');

  // Voices state
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('en-US-AriaNeural');
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPreviewAudioLoading, setIsPreviewAudioLoading] = useState(false);

  // Execution states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Results
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedSubtitleUrl, setGeneratedSubtitleUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoGenerateResponse | null>(null);
  const [planResult, setPlanResult] = useState<VideoPlan | null>(null);
  const [activeTab, setActiveTab] = useState<'video' | 'timeline' | 'plan'>('video');

  // Lightbox preview for scene images
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // History
  const [history, setHistory] = useState<VideoHistoryItem[]>([]);
  const timerRef = useRef<any>(null);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);

  // Load voices & history on mount
  useEffect(() => {
    audioApi.getVoices()
      .then((data) => {
        if (data && data.length > 0) {
          setVoices(data);
          const defaultV = data.find(v => v.id === 'en-US-AriaNeural') || data[0];
          setSelectedVoice(defaultV.id);
        }
      })
      .catch(() => {
        setVoices([
          { id: 'en-US-AriaNeural', name: 'English (US) - Female (Aria)' },
          { id: 'en-US-GuyNeural', name: 'English (US) - Male (Guy)' },
          { id: 'en-GB-SoniaNeural', name: 'English (UK) - Female (Sonia)' },
          { id: 'en-IN-NeerjaNeural', name: 'English (India) - Female (Neerja)' },
          { id: 'en-AU-NatNeural', name: 'English (Australia) - Female (Nat)' }
        ]);
      });

    try {
      const saved = localStorage.getItem('contentforge_video_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load video history:', e);
    }
  }, []);

  // Timer effect for generation progress
  useEffect(() => {
    if (isGenerating) {
      setElapsedSeconds(0);
      setCurrentStepIndex(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          if (next > 45) setCurrentStepIndex(4);
          else if (next > 30) setCurrentStepIndex(3);
          else if (next > 15) setCurrentStepIndex(2);
          else if (next > 4) setCurrentStepIndex(1);
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGenerating]);

  // Estimated scenes calculation based on pacing
  const estimatedScenes = Math.max(
    2,
    Math.round(
      targetDuration / (pacing === 'fast' ? 3.5 : pacing === 'cinematic' ? 7.0 : 5.0)
    )
  );

  const handleApplyPreset = (preset: typeof PRESET_PROMPTS[0]) => {
    setPrompt(preset.text);
    setPacing(preset.pacing as any);
    setTargetDuration(preset.duration);
    setTone(preset.tone);
  };

  // Preview voice narration sample
  const handlePreviewVoice = async () => {
    if (!prompt.trim()) return;
    setIsPreviewAudioLoading(true);
    setError(null);
    try {
      const sampleText = prompt.slice(0, 140) + '...';
      const res = await audioApi.generateAudio({
        text: sampleText,
        voice: selectedVoice
      });
      const audioUrl = audioApi.getAudioUrl(res.filename || res.url || res.download_url || '');
      setPreviewAudioUrl(audioUrl);
    } catch (err: any) {
      setError(err?.message || 'Voice preview failed.');
    } finally {
      setIsPreviewAudioLoading(false);
    }
  };

  // Generate Video Storyboard Plan Only (Fast, ~1s)
  const handlePlanOnly = async () => {
    if (!prompt.trim()) {
      setError('Please provide a video script or topic prompt.');
      return;
    }
    setIsPlanning(true);
    setError(null);
    try {
      const plan = await videoApi.planVideo({
        text: prompt.trim(),
        target_duration: targetDuration,
        pacing,
        language,
        tone,
        audience
      });
      setPlanResult(plan);
      setActiveTab('plan');
    } catch (err: any) {
      setError(err?.message || 'Failed to generate video plan.');
    } finally {
      setIsPlanning(false);
    }
  };

  // Generate Full Video Pipeline (FastAPI: Plan -> Forge SD -> Edge TTS -> FFmpeg)
  const handleGenerateFullVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) {
      setError('Please provide a video script or topic prompt.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedVideoUrl(null);
    setGeneratedSubtitleUrl(null);

    try {
      const res = await videoApi.generateVideo({
        text: prompt.trim(),
        target_duration: targetDuration,
        pacing,
        voice: selectedVoice,
        width: selectedResolution.width,
        height: selectedResolution.height,
        steps,
        language,
        tone,
        audience
      });

      setVideoMeta(res);

      if (res.video_plan) {
        setPlanResult(res.video_plan);
      }

      const videoUrl = videoApi.getVideoUrl(res.video_file);
      setGeneratedVideoUrl(videoUrl);

      if (res.subtitle_file) {
        setGeneratedSubtitleUrl(videoApi.getSubtitleUrl(res.subtitle_file));
      }

      setActiveTab('video');

      // Save to localStorage history
      const historyItem: VideoHistoryItem = {
        id: Date.now().toString(),
        title: res.video_plan?.title || prompt.slice(0, 40) + '...',
        prompt: prompt.trim(),
        videoUrl,
        subtitleUrl: res.subtitle_file ? videoApi.getSubtitleUrl(res.subtitle_file) : undefined,
        duration: res.duration || targetDuration,
        scenesCount: res.scenes || (res.scene_details?.length ?? estimatedScenes),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        resolution: `${selectedResolution.width}x${selectedResolution.height}`,
        voice: selectedVoice.split('-').pop()?.replace('Neural', '') || selectedVoice
      };

      const updatedHistory = [historyItem, ...history.slice(0, 9)];
      setHistory(updatedHistory);
      localStorage.setItem('contentforge_video_history', JSON.stringify(updatedHistory));
    } catch (err: any) {
      console.error('Video generation failed:', err);
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        'Video generation failed. Ensure backend and Stable Diffusion Forge are accessible.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedVideoUrl) return;
    navigator.clipboard.writeText(generatedVideoUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleRestoreFromHistory = (item: VideoHistoryItem) => {
    setPrompt(item.prompt);
    setGeneratedVideoUrl(item.videoUrl);
    if (item.subtitleUrl) setGeneratedSubtitleUrl(item.subtitleUrl);
    setActiveTab('video');
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('contentforge_video_history');
  };

  const pipelineSteps = [
    { title: 'Intelligent Video Planning', desc: 'Analyzing source text, generating atomic scene cards, & pacing word quota' },
    { title: 'Stable Diffusion Scene Rendering', desc: `Synthesizing ${estimatedScenes} cinematic visuals at ${selectedResolution.width}x${selectedResolution.height} (${steps} steps)` },
    { title: 'Edge TTS Neural Voiceover', desc: `Generating high-fidelity voice narration audio tracks with ${selectedVoice}` },
    { title: 'FFmpeg Scene Video Composition', desc: 'Encoding individual scene videos and calibrating frame rate & audio sync' },
    { title: 'Concatenation & Subtitle Burning', desc: 'Rendering final master MP4 video with synchronized on-screen SRT captions' }
  ];

  return (
    <div className={`max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      {/* Studio Header Banner */}
      <div className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${
        isDarkMode ? 'bg-gradient-to-r from-[#181818] via-[#121212] to-[#1a1a1a] border-white/10' : 'bg-gradient-to-r from-emerald-50 via-white to-slate-50 border-slate-200'
      }`}>
        <div className="space-y-1.5 z-10 max-w-2xl">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#1ed760]/20 text-[#1ed760] border border-[#1ed760]/30 flex items-center space-x-1">
              <Zap className="w-3 h-3" />
              <span>FastAPI End-to-End Engine</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
              POST /video/generate-video
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-serif">
            AI Video Generator & Studio
          </h1>
          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Convert any script, concept, or document into broadcast-quality subtitled MP4 video with AI scene planning, Stable Diffusion visual generation, and Neural Edge-TTS voiceovers.
          </p>
        </div>

        <div className="flex items-center space-x-2 z-10">
          <button
            onClick={handlePlanOnly}
            disabled={isPlanning || isGenerating || !prompt.trim()}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition flex items-center space-x-2 cursor-pointer disabled:opacity-50 ${
              isDarkMode ? 'bg-[#222] border-white/15 hover:bg-[#2a2a2a] text-white' : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800'
            }`}
          >
            {isPlanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1ed760]" /> : <Layers className="w-3.5 h-3.5 text-[#1ed760]" />}
            <span>Plan Storyboard</span>
          </button>

          <button
            onClick={() => handleGenerateFullVideo()}
            disabled={isGenerating || isPlanning || !prompt.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-[#1ed760]/20 transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Generate Video</span>
          </button>
        </div>
      </div>

      {/* Preset Inspiration Pills */}
      <div className="space-y-2">
        <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Quick Topic Presets
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {PRESET_PROMPTS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(preset)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1.5 ${
                prompt === preset.text
                  ? 'bg-[#1ed760]/20 border-[#1ed760] text-[#1ed760]'
                  : isDarkMode
                    ? 'bg-[#181818] border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <span>{preset.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio Grid: Controls on Left, Live Output / Timeline on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Production Settings (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className={`p-6 rounded-3xl border shadow-xl space-y-6 ${
            isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-[#1ed760]" />
                <span>Video Generation Parameters</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                {prompt.length} chars
              </span>
            </div>

            {/* Prompt / Script Input */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Source Script / Topic Prompt
              </label>
              <textarea
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter a descriptive topic, script outline, or enterprise brief..."
                className={`w-full p-3.5 rounded-2xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] resize-none ${
                  isDarkMode ? 'bg-[#121212] border-white/10 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Target Duration Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#1ed760]" />
                  <span>Target Duration</span>
                </label>
                <span className="font-extrabold text-[#1ed760] font-mono">
                  {targetDuration}s (~{estimatedScenes} scenes)
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="5"
                value={targetDuration}
                onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1ed760]"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>10s (Short)</span>
                <span>30s (Recommended)</span>
                <span>60s (Standard)</span>
                <span>120s (Extended)</span>
              </div>
            </div>

            {/* Pacing Selector */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#1ed760]" />
                <span>Pacing & Narrative Rhythm</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'fast', label: 'Fast', speed: '3.5s / scene', desc: 'Punchy & Viral' },
                  { id: 'balanced', label: 'Balanced', speed: '5.0s / scene', desc: 'Optimal Story' },
                  { id: 'cinematic', label: 'Cinematic', speed: '7.0s / scene', desc: 'Immersive Depth' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPacing(item.id as any)}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      pacing === item.id
                        ? 'bg-[#1ed760]/15 border-[#1ed760] text-[#1ed760]'
                        : isDarkMode
                          ? 'bg-[#121212] border-white/10 text-slate-300 hover:border-white/20'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold capitalize">{item.label}</p>
                    <p className="text-[10px] opacity-75">{item.speed}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Neural Voice Selection */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Mic className="w-3.5 h-3.5 text-[#1ed760]" />
                  <span>Neural Voiceover (Edge TTS)</span>
                </label>
                <button
                  type="button"
                  onClick={handlePreviewVoice}
                  disabled={isPreviewAudioLoading}
                  className="text-[10px] text-[#1ed760] font-bold hover:underline flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  {isPreviewAudioLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
                  <span>Preview Voice</span>
                </button>
              </div>

              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                  isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>

              {previewAudioUrl && (
                <div className={`p-2.5 rounded-xl border flex items-center space-x-2 ${
                  isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-100 border-slate-200'
                }`}>
                  <Volume2 className="w-4 h-4 text-[#1ed760] shrink-0" />
                  <audio controls src={previewAudioUrl} className="w-full h-7" autoPlay />
                </div>
              )}
            </div>

            {/* Aspect Ratio / Resolution */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Film className="w-3.5 h-3.5 text-[#1ed760]" />
                <span>Aspect Ratio & Resolution</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {RESOLUTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedResolution(opt)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      selectedResolution.id === opt.id
                        ? 'bg-[#1ed760]/15 border-[#1ed760] text-[#1ed760]'
                        : isDarkMode
                          ? 'bg-[#121212] border-white/10 text-slate-300 hover:border-white/20'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className="text-[10px] opacity-75 font-mono">{opt.width}x{opt.height}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone & Diffusion Steps */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className={`w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="Professional">Professional</option>
                  <option value="Cinematic">Cinematic</option>
                  <option value="Inspiring">Inspiring</option>
                  <option value="Educational">Educational</option>
                  <option value="Authoritative">Authoritative</option>
                  <option value="Casual">Casual</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Diffusion Steps</label>
                <select
                  value={steps}
                  onChange={(e) => setSteps(parseInt(e.target.value))}
                  className={`w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value={10}>10 Steps (Fast Draft)</option>
                  <option value={20}>20 Steps (Balanced)</option>
                  <option value={30}>30 Steps (High Quality)</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Main Action Button */}
            <button
              type="button"
              onClick={() => handleGenerateFullVideo()}
              disabled={isGenerating || isPlanning || !prompt.trim()}
              className="w-full py-4 rounded-2xl bg-[#1ed760] hover:bg-[#1db954] text-black font-extrabold text-xs uppercase tracking-wider shadow-xl shadow-[#1ed760]/20 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Video ({elapsedSeconds}s)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Full AI Video (MP4)</span>
                </>
              )}
            </button>
          </div>

          {/* History Drawer */}
          {history.length > 0 && (
            <div className={`p-5 rounded-3xl border shadow-xl space-y-3 ${
              isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#1ed760]" />
                  <span>Recent Video History ({history.length})</span>
                </h4>
                <button
                  onClick={handleClearHistory}
                  className="text-[10px] text-slate-400 hover:text-red-400 transition cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleRestoreFromHistory(item)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                      generatedVideoUrl === item.videoUrl
                        ? 'border-[#1ed760] bg-[#1ed760]/10'
                        : isDarkMode
                          ? 'border-white/5 bg-[#121212] hover:border-white/20'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="truncate max-w-[200px] space-y-0.5">
                      <p className="font-bold truncate">{item.title}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {item.duration}s • {item.scenesCount} scenes • {item.resolution}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <Play className="w-3.5 h-3.5 text-[#1ed760]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Video Player, Progress, Timeline & Storyboard (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Generation Multi-Stage Progress View */}
          {isGenerating && (
            <div className={`p-6 rounded-3xl border shadow-xl space-y-5 ${
              isDarkMode ? 'bg-[#181818] border-[#1ed760]/30' : 'bg-white border-emerald-300 shadow-emerald-500/5'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-[#1ed760] animate-ping" />
                  <h3 className="font-bold text-sm">Pipeline Execution in Progress</h3>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-[#1ed760]/20 text-[#1ed760] font-bold">
                  {elapsedSeconds}s elapsed
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-700/50 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#1ed760] to-emerald-400 h-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(95, (currentStepIndex + 1) * 20)}%` }}
                />
              </div>

              {/* Step checklist */}
              <div className="space-y-2.5">
                {pipelineSteps.map((s, idx) => {
                  const isDone = idx < currentStepIndex;
                  const isCurrent = idx === currentStepIndex;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border text-xs transition flex items-start space-x-3 ${
                        isCurrent
                          ? 'border-[#1ed760] bg-[#1ed760]/10 text-white font-medium'
                          : isDone
                            ? 'border-white/5 bg-white/5 text-slate-400'
                            : 'border-transparent opacity-40'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-[#1ed760]" />
                        ) : isCurrent ? (
                          <RefreshCw className="w-4 h-4 text-[#1ed760] animate-spin" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-500" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <p className={`font-bold ${isCurrent ? 'text-[#1ed760]' : ''}`}>{s.title}</p>
                        <p className="text-[11px] opacity-75">{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-Tabs: Video Player vs. Storyboard Timeline vs. Plan Blueprint */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('video')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'video'
                    ? 'bg-[#1ed760] text-black shadow-md'
                    : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <MonitorPlay className="w-3.5 h-3.5" />
                <span>Video Player</span>
              </button>

              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'timeline'
                    ? 'bg-[#1ed760] text-black shadow-md'
                    : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Scene Timeline ({videoMeta?.scene_details?.length || planResult?.scenes?.length || 0})</span>
              </button>

              {planResult && (
                <button
                  onClick={() => setActiveTab('plan')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    activeTab === 'plan'
                      ? 'bg-[#1ed760] text-black shadow-md'
                      : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Blueprint Plan</span>
                </button>
              )}
            </div>

            {generatedVideoUrl && (
              <span className="text-[10px] text-[#1ed760] font-mono font-bold flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Ready to stream</span>
              </span>
            )}
          </div>

          {/* TAB 1: Main Video Player */}
          {activeTab === 'video' && (
            <div className={`p-6 rounded-3xl border shadow-xl space-y-6 ${
              isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-200'
            }`}>
              {generatedVideoUrl ? (
                <div className="space-y-5">
                  <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl relative">
                    <video
                      ref={videoPlayerRef}
                      controls
                      autoPlay
                      src={generatedVideoUrl}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Metadata Bar */}
                  {videoMeta && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className={`p-3 rounded-2xl border text-center ${
                        isDarkMode ? 'bg-[#121212] border-white/5' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Duration</span>
                        <span className="text-xs font-extrabold text-[#1ed760] font-mono">{videoMeta.duration}s</span>
                      </div>
                      <div className={`p-3 rounded-2xl border text-center ${
                        isDarkMode ? 'bg-[#121212] border-white/5' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Scenes</span>
                        <span className="text-xs font-extrabold text-white font-mono">{videoMeta.scenes}</span>
                      </div>
                      <div className={`p-3 rounded-2xl border text-center ${
                        isDarkMode ? 'bg-[#121212] border-white/5' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Resolution</span>
                        <span className="text-xs font-extrabold text-white font-mono">{selectedResolution.width}x{selectedResolution.height}</span>
                      </div>
                      <div className={`p-3 rounded-2xl border text-center ${
                        isDarkMode ? 'bg-[#121212] border-white/5' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Voice Model</span>
                        <span className="text-xs font-extrabold text-white truncate block">
                          {selectedVoice.split('-').pop()?.replace('Neural', '')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <a
                      href={generatedVideoUrl}
                      download={`ai-video-${Date.now()}.mp4`}
                      className="flex-1 py-3 px-4 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-extrabold text-xs shadow-md transition flex items-center justify-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download MP4 Video</span>
                    </a>

                    {generatedSubtitleUrl && (
                      <a
                        href={generatedSubtitleUrl}
                        download={`subtitles-${Date.now()}.srt`}
                        className={`py-3 px-4 rounded-xl border text-xs font-bold transition flex items-center space-x-2 ${
                          isDarkMode ? 'bg-[#222] border-white/15 hover:bg-[#2a2a2a] text-white' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-800'
                        }`}
                      >
                        <FileText className="w-4 h-4 text-purple-400" />
                        <span>Download .SRT</span>
                      </a>
                    )}

                    <button
                      onClick={handleCopyLink}
                      className={`py-3 px-4 rounded-xl border text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
                        isDarkMode ? 'bg-[#222] border-white/15 hover:bg-[#2a2a2a] text-white' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-[#1ed760]" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? 'Copied Link' : 'Copy URL'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-24 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#1ed760]/10 text-[#1ed760] flex items-center justify-center mx-auto border border-[#1ed760]/20">
                    <Clapperboard className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h4 className="text-base font-bold">No Video Rendered Yet</h4>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Select your parameters on the left and click <span className="text-[#1ed760] font-bold">Generate Video</span> to assemble your custom MP4.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Scene-by-Scene Timeline */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {((videoMeta?.scene_details && videoMeta.scene_details.length > 0)
                ? videoMeta.scene_details
                : (planResult?.scenes || [])
              ).map((scene: any, idx: number) => {
                const imageSrc = scene.image_file ? imageApi.getImageUrl(scene.image_file) : null;
                const audioSrc = scene.audio_file ? audioApi.getAudioUrl(scene.audio_file) : null;

                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl border shadow-lg space-y-4 ${
                      isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#1ed760]/20 text-[#1ed760] text-xs font-extrabold font-mono">
                          Scene {scene.scene_number ?? idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                          {scene.duration}s
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {scene.visual_tier && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                            scene.visual_tier === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {scene.visual_tier} Priority
                          </span>
                        )}
                        {scene.transition_type && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                            {scene.transition_type}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      {/* Scene Image Thumbnail */}
                      {imageSrc && (
                        <div
                          onClick={() => setLightboxImage(imageSrc)}
                          className="md:col-span-4 aspect-video rounded-xl overflow-hidden bg-black/40 border border-white/10 cursor-pointer group relative"
                        >
                          <img
                            src={imageSrc}
                            alt={`Scene ${scene.scene_number}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <Eye className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      )}

                      {/* Scene Text & Narration */}
                      <div className={imageSrc ? 'md:col-span-8 space-y-2' : 'md:col-span-12 space-y-2'}>
                        {scene.on_screen_text && (
                          <div className="p-2 rounded-lg bg-[#1ed760]/10 border border-[#1ed760]/20">
                            <span className="text-[10px] font-bold uppercase text-[#1ed760] block">On-Screen Banner</span>
                            <p className="text-xs font-bold">{scene.on_screen_text}</p>
                          </div>
                        )}

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Visual Prompt</span>
                          <p className="text-xs italic opacity-90">{scene.visual_prompt}</p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-400">🎙️ Voice Narration</span>
                          <p className="text-xs font-medium">{scene.narration}</p>
                        </div>

                        {audioSrc && (
                          <div className="pt-2">
                            <audio controls src={audioSrc} className="w-full h-7" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Subtitle Timestamp Sync */}
                    {scene.subtitle_start && scene.subtitle_end && (
                      <div className="text-[10px] font-mono text-slate-500 flex items-center space-x-2 pt-1 border-t border-white/5">
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span>SRT Sync: {scene.subtitle_start} ➔ {scene.subtitle_end}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {!videoMeta?.scene_details?.length && !planResult?.scenes?.length && (
                <div className="text-center py-20 text-slate-400 space-y-2">
                  <Film className="w-12 h-12 mx-auto opacity-40" />
                  <p className="text-xs">No scene timeline available yet. Generate or plan a video first.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Blueprint Plan View */}
          {activeTab === 'plan' && planResult && (
            <div className={`p-6 rounded-3xl border shadow-xl space-y-6 ${
              isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className="space-y-1 border-b border-white/10 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#1ed760]">
                  Intelligent Video Plan Blueprint
                </span>
                <h3 className="text-lg font-bold">{planResult.title || 'AI Generated Storyboard'}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#121212] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Target Duration</span>
                    <span className="text-xs font-bold font-mono text-white">{planResult.target_duration}s</span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#121212] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Calc Duration</span>
                    <span className="text-xs font-bold font-mono text-[#1ed760]">{planResult.total_calculated_duration}s</span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#121212] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Scenes</span>
                    <span className="text-xs font-bold font-mono text-white">{planResult.num_scenes}</span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#121212] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Pacing</span>
                    <span className="text-xs font-bold font-mono text-white capitalize">{planResult.pacing}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Calculated Scene Hierarchy
                </span>
                {planResult.scenes?.map((scene: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border space-y-2 ${
                      isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between font-bold text-xs">
                      <span className="text-[#1ed760]">Scene {scene.scene_number ?? idx + 1} ({scene.duration}s)</span>
                      <span className="text-[10px] font-mono text-slate-400">Quota: {scene.max_word_count} words</span>
                    </div>
                    <p className="text-xs italic text-slate-300">"{scene.visual_prompt}"</p>
                    <p className="text-xs text-slate-400">🎙️ {scene.narration}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className={`max-w-4xl w-full rounded-2xl overflow-hidden border p-2 relative ${
              isDarkMode ? 'bg-[#181818] border-white/20' : 'bg-white border-slate-300'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/70 text-white hover:text-red-400 transition z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Scene Full Render"
              className="w-full h-auto rounded-xl max-h-[80vh] object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};
