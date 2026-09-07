import React, { useState } from 'react';
import {
  Sparkles,
  Download,
  RefreshCw,
  Zap,
  Sliders,
  Award,
  Cpu,
  Clock,
  Image as ImageIcon,
  Copy,
  Check,
  Maximize2,
  X,
  History,
  Layers,
  Wand2
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { imageApi, GenerateImageResponse } from '../api/image';

type GenerationMode = 'fast' | 'balanced' | 'quality';

interface AspectRatioOption {
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
}

interface ImageHistoryItem {
  id: string;
  prompt: string;
  url: string;
  filename: string;
  timestamp: string;
  meta: GenerateImageResponse;
}

export const ImageStudio: React.FC = () => {
  const { isDarkMode } = useTheme();

  // Input states
  const [prompt, setPrompt] = useState('Futuristic sustainable smart city at sunset, emerald neon lights, 8k resolution, photorealistic');
  const [negativePrompt, setNegativePrompt] = useState('blurry, low quality, distorted, extra limbs, watermark, text');
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [mode, setMode] = useState<GenerationMode>('fast');
  const [width, setWidth] = useState(768);
  const [height, setHeight] = useState(768);
  const [steps, setSteps] = useState(10);
  const [selectedAspect, setSelectedAspect] = useState('1:1');

  // Result & UI states
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generationMeta, setGenerationMeta] = useState<GenerateImageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [history, setHistory] = useState<ImageHistoryItem[]>([]);

  const aspectRatios: AspectRatioOption[] = [
    { id: '1:1', label: 'Square', ratio: '1:1', width: 768, height: 768 },
    { id: '16:9', label: 'Landscape', ratio: '16:9', width: 1024, height: 576 },
    { id: '9:16', label: 'Portrait', ratio: '9:16', width: 576, height: 1024 },
    { id: '4:3', label: 'Classic', ratio: '4:3', width: 768, height: 576 },
  ];

  const promptPresets = [
    { label: 'Cyberpunk Metropolis', prompt: 'Bioluminescent cyberpunk metropolis at night with emerald lasers and flying vehicles, cinematic lighting, 8k' },
    { label: 'Studio Portrait', prompt: 'Cinematic hyperrealistic studio portrait of a visionary founder, soft rim lighting, shallow depth of field, 8k' },
    { label: 'Isometric 3D Room', prompt: 'Minimalist 3D isometric futuristic AI workstation with glowing holographic screens, sleek materials, octane render' },
    { label: 'Epic Fantasy', prompt: 'Majestic ancient fantasy castle on floating crystal islands amidst aurora borealis, hyper-detailed, masterpiece' },
    { label: 'Abstract Data Flow', prompt: 'Vibrant neural network fiber optic pulses flowing through emerald crystal pathways, dark background, 8k wallpaper' },
  ];

  const handleAspectChange = (aspect: AspectRatioOption) => {
    setSelectedAspect(aspect.id);
    setWidth(aspect.width);
    setHeight(aspect.height);
  };

  const handleModeChange = (selectedMode: GenerationMode) => {
    setMode(selectedMode);
    if (selectedMode === 'fast') {
      setSteps(10);
      if (selectedAspect === '1:1') { setWidth(512); setHeight(512); }
    } else if (selectedMode === 'balanced') {
      setSteps(18);
      if (selectedAspect === '1:1') { setWidth(768); setHeight(768); }
    } else if (selectedMode === 'quality') {
      setSteps(28);
      if (selectedAspect === '1:1') { setWidth(1024); setHeight(1024); }
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError('Please enter a descriptive prompt before generating.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await imageApi.generateImage({
        prompt: prompt.trim(),
        negative_prompt: showNegativePrompt ? negativePrompt.trim() : undefined,
        mode,
        width,
        height,
        steps,
      });

      setGenerationMeta(res);

      let finalUrl = '';
      if (res.image_url) {
        finalUrl = imageApi.getImageUrl(res.image_url.split('/').pop() || res.filename);
      } else if (res.filename) {
        finalUrl = imageApi.getImageUrl(res.filename);
      } else if (res.image_path) {
        finalUrl = imageApi.getImageUrl(res.image_path.split('/').pop() || res.image_path);
      }

      if (finalUrl) {
        setImageUrl(finalUrl);
        const newItem: ImageHistoryItem = {
          id: Date.now().toString(),
          prompt: prompt.trim(),
          url: finalUrl,
          filename: res.filename || 'generated-image.png',
          timestamp: new Date().toLocaleTimeString(),
          meta: res,
        };
        setHistory((prev) => [newItem, ...prev]);
      } else {
        setError('Image generated, but unable to construct preview URL.');
      }
    } catch (err: any) {
      console.error('Image Generation Error:', err);
      setError(err?.response?.data?.detail || err?.message || 'Image generation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!imageUrl) return;
    try {
      await navigator.clipboard.writeText(imageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy image URL', err);
    }
  };

  return (
    <div className={`max-w-6xl mx-auto py-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      {/* Studio Header */}
      <div className={`pb-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isDarkMode ? 'border-[#282828]' : 'border-slate-200'
      }`}>
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold tracking-tight font-serif flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-[#1ed760]" />
              <span>Generate Image Studio</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#1ed760]/20 text-[#1ed760] font-mono text-[10px] font-bold uppercase tracking-wider">
              FastAPI Connected
            </span>
          </div>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
            Accelerated text-to-image synthesis powered by FastAPI backend endpoint <code className="text-[#1ed760] font-mono">POST /generate-image</code>.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
            <Cpu className="w-3.5 h-3.5" />
            <span>CUDA / High-Speed Pipeline</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Prompt, Presets, Controls & Form */}
        <div className="lg:col-span-6 space-y-6">
          <form
            onSubmit={handleGenerate}
            className={`rounded-2xl border p-6 shadow-xl space-y-5 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}
          >
            {/* Mode Presets */}
            <div className="space-y-2">
              <label className={`text-[10px] font-bold uppercase tracking-widest block ${
                isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'
              }`}>
                Inference Mode Preset
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('fast')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                    mode === 'fast'
                      ? 'bg-[#1ed760] text-black border-[#1ed760] shadow-md'
                      : isDarkMode
                      ? 'bg-[#121212] border-white/10 text-slate-300 hover:border-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-1">
                    <Zap className="w-3.5 h-3.5" />
                    <span>⚡ FAST</span>
                  </div>
                  <span className="text-[9px] font-normal opacity-80">10 steps · Quick preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('balanced')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                    mode === 'balanced'
                      ? 'bg-[#1ed760] text-black border-[#1ed760] shadow-md'
                      : isDarkMode
                      ? 'bg-[#121212] border-white/10 text-slate-300 hover:border-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-1">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Balanced</span>
                  </div>
                  <span className="text-[9px] font-normal opacity-80">18 steps · Standard</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('quality')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                    mode === 'quality'
                      ? 'bg-[#1ed760] text-black border-[#1ed760] shadow-md'
                      : isDarkMode
                      ? 'bg-[#121212] border-white/10 text-slate-300 hover:border-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-1">
                    <Award className="w-3.5 h-3.5" />
                    <span>Ultra HD</span>
                  </div>
                  <span className="text-[9px] font-normal opacity-80">28 steps · High detail</span>
                </button>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="space-y-2">
              <label className={`text-[10px] font-bold uppercase tracking-widest flex items-center justify-between ${
                isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'
              }`}>
                <span>Image Generation Prompt</span>
                <span className="text-xs font-mono text-[#1ed760] lowercase">{prompt.length} chars</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Describe what you want to create in vivid detail (subject, environment, lighting, aesthetic)..."
                className={`w-full p-3.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition font-sans ${
                  isDarkMode
                    ? 'bg-[#121212] border-white/10 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Quick Inspiration Chips */}
            <div className="space-y-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
                <Wand2 className="w-3 h-3 text-[#1ed760]" />
                <span>Prompt Inspiration</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {promptPresets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(p.prompt)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] border transition cursor-pointer ${
                      isDarkMode
                        ? 'bg-[#121212] border-white/10 hover:border-[#1ed760] text-slate-300 hover:text-white'
                        : 'bg-slate-100 border-slate-200 hover:border-[#1ed760] text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div className="space-y-2">
              <label className={`text-[10px] font-bold uppercase tracking-widest block ${
                isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'
              }`}>
                Aspect Ratio & Dimensions
              </label>
              <div className="grid grid-cols-4 gap-2">
                {aspectRatios.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleAspectChange(a)}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center space-y-0.5 cursor-pointer ${
                      selectedAspect === a.id
                        ? 'border-[#1ed760] bg-[#1ed760]/15 text-[#1ed760]'
                        : isDarkMode
                        ? 'bg-[#121212] border-white/10 text-slate-400 hover:text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="font-mono text-[11px]">{a.ratio}</span>
                    <span className="text-[9px] font-normal">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution & Steps Advanced Controls */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Width</label>
                <input
                  type="number"
                  min={256}
                  max={1024}
                  step={64}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className={`w-full mt-1 p-2 rounded-xl text-xs border font-mono ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Height</label>
                <input
                  type="number"
                  min={256}
                  max={1024}
                  step={64}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className={`w-full mt-1 p-2 rounded-xl text-xs border font-mono ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Steps ({steps})</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={steps}
                  onChange={(e) => setSteps(Number(e.target.value))}
                  className={`w-full mt-1 p-2 rounded-xl text-xs border font-mono ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            {/* Optional Negative Prompt Toggle */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowNegativePrompt(!showNegativePrompt)}
                className="text-xs text-slate-400 hover:text-white font-semibold flex items-center space-x-1 cursor-pointer transition"
              >
                <span>{showNegativePrompt ? '− Hide Negative Prompt' : '+ Add Negative Prompt'}</span>
              </button>
              {showNegativePrompt && (
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  rows={2}
                  placeholder="Elements to avoid (e.g. blurry, text, lowres, distorted hands)..."
                  className={`w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-[#1ed760] font-sans ${
                    isDarkMode
                      ? 'bg-[#121212] border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              )}
            </div>

            {/* Generate Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isLoading ? 'Generating Image via FastAPI...' : `Generate Image (${mode.toUpperCase()})`}</span>
            </button>

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-semibold" aria-live="polite">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Right Column: Generated Image Canvas & Metrics */}
        <div className="lg:col-span-6 space-y-6">
          <div className={`rounded-2xl border p-6 shadow-xl flex flex-col items-center justify-center min-h-[480px] ${
            isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
          }`}>
            {isLoading ? (
              <div className="py-24 text-center space-y-4">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-[#1ed760]/20 border-t-[#1ed760] animate-spin" />
                  <Sparkles className="w-6 h-6 text-[#1ed760] absolute inset-0 m-auto animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Synthesizing Image...</h4>
                  <p className="text-xs text-slate-400 mt-1">Executing PyTorch inference at {width}×{height} resolution</p>
                </div>
              </div>
            ) : imageUrl ? (
              <div className="space-y-5 text-center w-full">
                {/* Image Container with Hover Controls */}
                <div className="relative group rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-black/40">
                  <img
                    src={imageUrl}
                    alt="Generated output"
                    onError={() => {
                      setImageUrl(null);
                      setError('The image was generated, but its preview could not be loaded.');
                    }}
                    className="max-h-[380px] w-full object-contain mx-auto transition-transform duration-300 group-hover:scale-[1.01]"
                  />

                  {/* Top Right Canvas Actions */}
                  <div className="absolute top-3 right-3 flex items-center space-x-1.5 opacity-90">
                    <button
                      type="button"
                      onClick={() => setIsZoomOpen(true)}
                      className="p-2 rounded-lg bg-black/70 hover:bg-black text-white text-xs backdrop-blur-md border border-white/20 transition cursor-pointer"
                      title="Zoom Fullscreen"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="p-2 rounded-lg bg-black/70 hover:bg-black text-white text-xs backdrop-blur-md border border-white/20 transition cursor-pointer"
                      title="Copy Image URL"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#1ed760]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Performance Metrics Card */}
                {generationMeta && (
                  <div className={`p-4 rounded-xl border text-left space-y-2 text-xs ${
                    isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center space-x-1.5 font-bold text-emerald-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>⚡ Generated in {generationMeta.generation_time}s</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono uppercase">
                        Device: {generationMeta.device.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Resolution: {generationMeta.width}×{generationMeta.height}</span>
                      <span>Steps: {generationMeta.steps}</span>
                      <span className="truncate max-w-[120px]" title={generationMeta.filename}>{generationMeta.filename}</span>
                    </div>
                  </div>
                )}

                {/* Download Button */}
                <div className="flex items-center justify-center space-x-3">
                  <a
                    href={imageUrl}
                    download={generationMeta?.filename || 'generated-image.png'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#1ed760] text-black font-bold text-xs uppercase tracking-wider shadow-md hover:bg-[#1db954] transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download High-Res PNG</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-24 text-slate-400 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                  <ImageIcon className="w-8 h-8 opacity-40 text-[#1ed760]" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-300">No Image Generated Yet</h4>
                  <p className="text-xs text-slate-500 mt-1">Enter a prompt on the left and click Generate Image to synthesize.</p>
                </div>
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">
                  <span>⚡ Default: 768×768 · 10 steps</span>
                </div>
              </div>
            )}
          </div>

          {/* Session History Gallery */}
          {history.length > 0 && (
            <div className={`rounded-2xl border p-5 shadow-lg space-y-3 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <History className="w-3.5 h-3.5 text-[#1ed760]" />
                  <span>Recent Generations ({history.length})</span>
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setImageUrl(item.url);
                      setGenerationMeta(item.meta);
                      setPrompt(item.prompt);
                    }}
                    className={`relative rounded-xl overflow-hidden border transition cursor-pointer group aspect-square ${
                      imageUrl === item.url ? 'border-[#1ed760] ring-2 ring-[#1ed760]/30' : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 flex flex-col justify-between text-[9px] text-white">
                      <span className="line-clamp-2">{item.prompt}</span>
                      <span className="font-mono text-[#1ed760]">{item.meta.generation_time}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Zoom Modal */}
      {isZoomOpen && imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsZoomOpen(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setIsZoomOpen(false)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-[#1ed760] transition cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={imageUrl}
              alt="Fullscreen preview"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain border border-white/20"
            />
          </div>
        </div>
      )}
    </div>
  );
};
