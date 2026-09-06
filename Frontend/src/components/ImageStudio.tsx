import React, { useState } from 'react';
import { Image as ImageIcon, Sparkles, Download, RefreshCw, Zap, Sliders, Award, Cpu, Clock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { imageApi, GenerateImageResponse } from '../api/image';

type GenerationMode = 'fast' | 'balanced' | 'quality';

export const ImageStudio: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [prompt, setPrompt] = useState('Futuristic sustainable smart city at sunset, 8k resolution');
  const [mode, setMode] = useState<GenerationMode>('fast');
  const [width, setWidth] = useState(768);
  const [height, setHeight] = useState(768);
  const [steps, setSteps] = useState(10);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generationMeta, setGenerationMeta] = useState<GenerateImageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleModeChange = (selectedMode: GenerationMode) => {
    setMode(selectedMode);
    if (selectedMode === 'fast') {
      setWidth(768);
      setHeight(768);
      setSteps(10);
    } else if (selectedMode === 'balanced') {
      setWidth(768);
      setHeight(768);
      setSteps(18);
    } else if (selectedMode === 'quality') {
      setWidth(1024);
      setHeight(1024);
      setSteps(28);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError('Enter a prompt before generating an image.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setImageUrl(null);
    setGenerationMeta(null);
    try {
      const res = await imageApi.generateImage({ prompt, mode, width, height, steps });
      setGenerationMeta(res);

      const generatedUrl = res.image_url;
      if (generatedUrl) {
        setImageUrl(imageApi.getImageUrl(generatedUrl.split('/').pop() || res.filename));
      } else if (res.filename) {
        setImageUrl(imageApi.getImageUrl(res.filename));
      } else if (res.image_path) {
        setImageUrl(imageApi.getImageUrl(res.image_path.split('/').pop() || res.image_path));
      } else {
        setError('The image was generated, but no preview URL was returned.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Image generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b flex items-center justify-between ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <div>
          <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Image Generation Studio</h2>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
            Accelerated CUDA FP16 pipeline producing production visuals in under 60 seconds.
          </p>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Cpu className="w-3.5 h-3.5" />
          <span>CUDA FP16 Singleton</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <form onSubmit={handleGenerate} className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          {/* Generation Mode Selector */}
          <div className="space-y-2">
            <label className={`text-[10px] font-bold uppercase tracking-widest block ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
              Generation Mode
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
                <span className="text-[9px] font-normal opacity-80">768×768 · 10 steps</span>
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
                <span className="text-[9px] font-normal opacity-80">768×768 · 18 steps</span>
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
                  <span>Quality</span>
                </div>
                <span className="text-[9px] font-normal opacity-80">1024×1024 · 28 steps</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Width</label>
              <input
                type="number"
                min={256}
                max={1024}
                step={64}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className={`w-full mt-1 p-2 rounded-xl text-xs border ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
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
                className={`w-full mt-1 p-2 rounded-xl text-xs border ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
            </div>
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Steps</label>
              <input
                type="number"
                min={1}
                max={50}
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                className={`w-full mt-1 p-2 rounded-xl text-xs border ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Generate Image ({mode.toUpperCase()})</span>
          </button>

          {error && (
            <p role="alert" className="text-xs text-red-400" aria-live="polite">
              {error}
            </p>
          )}
        </form>

        <div className={`rounded-2xl border p-6 shadow-xl flex flex-col items-center justify-center ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          {imageUrl ? (
            <div className="space-y-4 text-center w-full">
              <img
                src={imageUrl}
                alt="Generated"
                onError={() => {
                  setImageUrl(null);
                  setError('The image was generated, but its preview could not be loaded.');
                }}
                className="max-h-80 mx-auto rounded-xl shadow-lg object-contain"
              />

              {/* Real Performance Timing & Metadata Badge */}
              {generationMeta && (
                <div className={`p-3 rounded-xl border space-y-2 text-left text-xs ${
                  isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center space-x-1.5 font-bold text-emerald-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>⚡ Generated in {generationMeta.generation_time}s</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono uppercase">
                      Device: {generationMeta.device.toUpperCase()} (FP16)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Resolution: {generationMeta.width}x{generationMeta.height}</span>
                    <span>Steps: {generationMeta.steps}</span>
                  </div>
                </div>
              )}

              <a
                href={imageUrl}
                download="generated-image.png"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#1ed760] text-black font-bold text-xs shadow-md hover:bg-[#1db954] transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Image</span>
              </a>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 space-y-2">
              <ImageIcon className="w-12 h-12 mx-auto opacity-40" />
              <p className="text-xs">Generated image preview will appear here.</p>
              <p className="text-[11px] text-emerald-400 font-mono">⚡ FAST mode default: 768x768 (10 steps)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
