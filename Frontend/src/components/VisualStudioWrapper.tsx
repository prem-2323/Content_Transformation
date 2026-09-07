import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { VisualAiStudio } from './VisualAiStudio';
import { ImageStudio } from './ImageStudio';
import { Eye, Sparkles } from 'lucide-react';

interface VisualStudioWrapperProps {
  initialSubTab?: 'visual' | 'image';
}

export const VisualStudioWrapper: React.FC<VisualStudioWrapperProps> = ({ initialSubTab = 'visual' }) => {
  const { isDarkMode } = useTheme();
  const [subTab, setSubTab] = useState<'visual' | 'image'>(initialSubTab);

  return (
    <div className={`min-h-full space-y-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      {/* Top Studio Switcher Header */}
      <div className={`p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-[#121212] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div>
          <h2 className="text-xl font-bold tracking-tight font-serif flex items-center space-x-2">
            <span className="text-[#1ed760]">Visual Studio</span>
          </h2>
          <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
            Unified Visual AI Analysis & Accelerated Image Generation Suite
          </p>
        </div>

        <div className={`p-1 rounded-xl border flex items-center space-x-1 ${
          isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-slate-100 border-slate-300'
        }`}>
          <button
            onClick={() => setSubTab('visual')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
              subTab === 'visual'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visual AI Engine</span>
          </button>

          <button
            onClick={() => setSubTab('image')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
              subTab === 'image'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Image</span>
          </button>
        </div>
      </div>

      {/* Render Active Sub-Studio */}
      <div className="px-4 sm:px-6">
        {subTab === 'visual' ? <VisualAiStudio /> : <ImageStudio />}
      </div>
    </div>
  );
};
