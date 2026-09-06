import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { AudienceReframer } from './AudienceReframer';
import { BrandVoiceStudio } from './BrandVoiceStudio';
import { TranslationStudio } from './TranslationStudio';
import { Users, Sliders, Languages } from 'lucide-react';

type OutputControlsSubTab = 'audience' | 'brand_voice' | 'translation';

interface OutputControlsWrapperProps {
  initialSubTab?: OutputControlsSubTab;
}

export const OutputControlsWrapper: React.FC<OutputControlsWrapperProps> = ({ initialSubTab = 'audience' }) => {
  const { isDarkMode } = useTheme();
  const [subTab, setSubTab] = useState<OutputControlsSubTab>(initialSubTab);

  return (
    <div className={`min-h-full space-y-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      {/* Top Output Controls Header */}
      <div className={`p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-[#121212] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div>
          <h2 className="text-xl font-bold tracking-tight font-serif flex items-center space-x-2">
            <span className="text-[#1ed760]">Output Controls</span>
          </h2>
          <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
            Audience Knowledge Reframing, Organization Brand Voice Constraints & Multilingual Translation
          </p>
        </div>

        <div className={`p-1 rounded-xl border flex items-center space-x-1 flex-wrap gap-1 ${
          isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-slate-100 border-slate-300'
        }`}>
          <button
            onClick={() => setSubTab('audience')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
              subTab === 'audience'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Audience Reframing</span>
          </button>

          <button
            onClick={() => setSubTab('brand_voice')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
              subTab === 'brand_voice'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Brand Voice</span>
          </button>

          <button
            onClick={() => setSubTab('translation')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
              subTab === 'translation'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>Translation</span>
          </button>
        </div>
      </div>

      {/* Render Active Sub-Studio */}
      <div className="px-4 sm:px-6">
        {subTab === 'audience' && <AudienceReframer />}
        {subTab === 'brand_voice' && <BrandVoiceStudio />}
        {subTab === 'translation' && <TranslationStudio />}
      </div>
    </div>
  );
};
