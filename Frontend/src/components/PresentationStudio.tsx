import React, { useState } from 'react';
import { Presentation, Sparkles, RefreshCw, Download } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { presentationApi } from '../api/presentation';

export const PresentationStudio: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [title, setTitle] = useState('Enterprise AI Strategy 2026');
  const [content, setContent] = useState('AI automation, multi-region deployment, UCKR fact grounding consistency.');
  const [slides, setSlides] = useState<any[]>([
    { title: 'Executive Summary', content: 'Accelerating enterprise automation with Gemma & Qwen.' },
    { title: 'Core Architecture', content: 'Atomic fact registry and 7-step consistency pipeline.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const { blob, filename } = await presentationApi.exportPptx({ title, slides });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Unable to export the presentation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'} flex items-center justify-between`}>
        <div>
          <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Presentation Studio (PPTX Export)</h2>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
            Export structured PowerPoint slide decks via <code className="text-[#1ed760]">POST /export-pptx</code>.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow cursor-pointer disabled:opacity-50"
        >
          {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>Download PowerPoint</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {slides.map((slide, idx) => (
          <div key={idx} className={`rounded-2xl border p-5 shadow-xl space-y-4 ${
            isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#1ed760] uppercase tracking-wider">Slide 0{idx + 1}</span>
            </div>
            <input
              type="text"
              value={slide.title}
              onChange={(e) => {
                const updated = [...slides];
                updated[idx].title = e.target.value;
                setSlides(updated);
              }}
              className={`w-full font-bold text-sm px-3 py-1.5 rounded-lg border ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
            />
            <textarea
              value={slide.content}
              onChange={(e) => {
                const updated = [...slides];
                updated[idx].content = e.target.value;
                setSlides(updated);
              }}
              rows={4}
              className={`w-full text-xs p-3 rounded-xl border resize-none ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
