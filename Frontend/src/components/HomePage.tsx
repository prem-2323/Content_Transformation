import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Globe } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface HomePageProps {
  onStart: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onStart }) => {
  const { isDarkMode } = useTheme();
  return (
    <div className={`max-w-6xl mx-auto py-16 px-4 sm:px-6 text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#1ed760]/10 border border-[#1ed760]/30 text-[#1ed760] text-xs font-bold uppercase tracking-wider mb-6">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Enterprise Content Transformation Engine</span>
      </div>

      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight font-serif mb-6 leading-tight">
        Transform Single Content into <span className="text-[#1ed760]">Multi-Channel Masterpieces</span>
      </h1>

      <p className={`text-base sm:text-lg max-w-3xl mx-auto mb-10 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
        Leverage Qwen3 4B and UCKR Fact Grounding consistency to instantly generate executive briefs, LinkedIn posts, advisory memos, infographics, presentations, and studio MP3 audio tracks.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
        <button
          onClick={onStart}
          className="px-8 py-4 rounded-full bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-sm uppercase tracking-[1.5px] shadow-[0_8px_24px_rgba(30,215,96,0.4)] transition flex items-center space-x-3 cursor-pointer"
        >
          <span>Launch Content Engine</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
        <div className={`rounded-2xl border p-6 shadow-lg ${isDarkMode ? 'glass-card border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="w-10 h-10 rounded-xl bg-[#1ed760]/20 text-[#1ed760] flex items-center justify-center mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base mb-2">UCKR Fact Grounding</h3>
          <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
            Rigorous 7-step QA pipeline ensuring zero hallucination and complete source fidelity across all generated artifacts.
          </p>
        </div>

        <div className={`rounded-2xl border p-6 shadow-lg ${isDarkMode ? 'glass-card border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="w-10 h-10 rounded-xl bg-[#1ed760]/20 text-[#1ed760] flex items-center justify-center mb-4">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base mb-2">Multi-Format Sync</h3>
          <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
            Produce executive summaries, social threads, advisory memos, and MP3 voiceover briefs simultaneously from any text, URL, or file.
          </p>
        </div>

        <div className={`rounded-2xl border p-6 shadow-lg ${isDarkMode ? 'glass-card border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="w-10 h-10 rounded-xl bg-[#1ed760]/20 text-[#1ed760] flex items-center justify-center mb-4">
            <Globe className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base mb-2">Global Localization</h3>
          <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
            Translate and localize content effortlessly across English, Hindi, Tamil, Telugu, Spanish, French, German, and Japanese.
          </p>
        </div>
      </div>
    </div>
  );
};
