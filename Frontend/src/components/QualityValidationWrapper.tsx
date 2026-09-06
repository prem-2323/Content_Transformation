import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FactRegistry } from './FactRegistry';
import { ConsistencyPipeline } from './ConsistencyPipeline';
import { QualityScoreDashboard } from './QualityScoreDashboard';
import { ContentIntelligence } from './ContentIntelligence';
import { ShieldCheck, Layers, Award, Brain } from 'lucide-react';

type QualitySubTab = 'registry' | 'pipeline' | 'quality' | 'intelligence';

interface QualityValidationWrapperProps {
  transformationResult?: any;
  initialSubTab?: QualitySubTab;
}

export const QualityValidationWrapper: React.FC<QualityValidationWrapperProps> = ({
  transformationResult,
  initialSubTab = 'registry'
}) => {
  const { isDarkMode } = useTheme();
  const [subTab, setSubTab] = useState<QualitySubTab>(initialSubTab);

  return (
    <div className={`min-h-full space-y-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      {/* Top Quality & Validation Header */}
      <div className={`p-4 border-b flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-[#121212] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div>
          <h2 className="text-xl font-bold tracking-tight font-serif flex items-center space-x-2">
            <span className="text-[#1ed760]">Quality & Validation</span>
          </h2>
          <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
            UCKR Fact Grounding, Dynamic Consistency Verification, Quality Audit & Content Intelligence Engine
          </p>
        </div>

        <div className={`p-1 rounded-xl border flex items-center space-x-1 flex-wrap gap-1 ${
          isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-slate-100 border-slate-300'
        }`}>
          <button
            onClick={() => setSubTab('registry')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              subTab === 'registry'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Fact Registry</span>
          </button>

          <button
            onClick={() => setSubTab('pipeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              subTab === 'pipeline'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Consistency Engine</span>
          </button>

          <button
            onClick={() => setSubTab('quality')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              subTab === 'quality'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Quality Score</span>
          </button>

          <button
            onClick={() => setSubTab('intelligence')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              subTab === 'intelligence'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Content Intelligence</span>
          </button>
        </div>
      </div>

      {/* Render Active Sub-Studio */}
      <div className="px-4 sm:px-6">
        {subTab === 'registry' && <FactRegistry />}
        {subTab === 'pipeline' && <ConsistencyPipeline />}
        {subTab === 'quality' && <QualityScoreDashboard />}
        {subTab === 'intelligence' && <ContentIntelligence transformationResult={transformationResult} />}
      </div>
    </div>
  );
};
