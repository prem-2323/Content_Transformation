import React, { useState } from 'react';
import { Image as ImageIcon, Sparkles, Download, RefreshCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { imageApi } from '../api/image';

export const ImageStudio: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [prompt, setPrompt] = useState('Futuristic sustainable smart city at sunset, 8k resolution');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(30);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await imageApi.generateImage({ prompt, width, height, steps });
      if (res.filename) {
        setImageUrl(imageApi.getImageUrl(res.filename));
      } else if (res.url) {
        setImageUrl(res.url);
      } else if (res.image_url) {
        setImageUrl(res.image_url);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Image Generation Studio</h2>
        <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
          Generate high-resolution production images using backend generative models via <code className="text-[#1ed760]">POST /generate-image</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <form onSubmit={handleGenerate} className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
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
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className={`w-full mt-1 p-2 rounded-xl text-xs border ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
            </div>
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Height</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className={`w-full mt-1 p-2 rounded-xl text-xs border ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
            </div>
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Steps</label>
              <input
                type="number"
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
            <span>Generate Image</span>
          </button>
        </form>

        <div className={`rounded-2xl border p-6 shadow-xl flex flex-col items-center justify-center ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          {imageUrl ? (
            <div className="space-y-4 text-center w-full">
              <img src={imageUrl} alt="Generated" className="max-h-80 mx-auto rounded-xl shadow-lg object-contain" />
              <a
                href={imageUrl}
                download="generated-image.png"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#1ed760] text-black font-bold text-xs shadow-md hover:bg-[#1db954] transition"
              >
                <Download className="w-4 h-4" />
                <span>Download Image</span>
              </a>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 space-y-2">
              <ImageIcon className="w-12 h-12 mx-auto opacity-40" />
              <p className="text-xs">Generated image preview will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
