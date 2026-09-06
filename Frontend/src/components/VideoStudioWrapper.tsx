import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { SceneGenerator } from './SceneGenerator';
import { VideoPlanner } from './VideoPlanner';
import { VideoStudio } from './VideoStudio';
import { AudioStudio } from './AudioStudio';
import { Film, Video, Clapperboard, Volume2 } from 'lucide-react';

type VideoSubTab = 'scene' | 'video_plan' | 'video' | 'audio';

interface VideoStudioWrapperProps {
  initialSubTab?: VideoSubTab;
}

export const VideoStudioWrapper: React.FC<VideoStudioWrapperProps> = ({ initialSubTab = 'scene' }) => {
  const { isDarkMode } = useTheme();
  const [subTab, setSubTab] = useState<VideoSubTab>(initialSubTab);

  return (
    <div className={`min-h-full space-y-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      {/* Top Video Studio Header */}
      <div className={`p-4 border-b flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-[#121212] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div>
          <h2 className="text-xl font-bold tracking-tight font-serif flex items-center space-x-2">
            <span className="text-[#1ed760]">Video Studio</span>
          </h2>
          <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
            End-to-End Multimodal Video Suite: Storyboard, Scene Prompts, Assembly & Neural TTS Audio
          </p>
        </div>

        <div className={`p-1 rounded-xl border flex items-center space-x-1 flex-wrap gap-1 ${
          isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-slate-100 border-slate-300'
        }`}>
          <button
            onClick={() => setSubTab('scene')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              subTab === 'scene'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Scene Generator</span>
          </button>

          <button
            onClick={() => setSubTab('video_plan')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              subTab === 'video_plan'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video Planner</span>
          </button>

          <button
            onClick={() => setSubTab('video')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              subTab === 'video'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span>Video Assembly</span>
          </button>

          <button
            onClick={() => setSubTab('audio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              subTab === 'audio'
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Audio Studio</span>
          </button>
        </div>
      </div>

      {/* Render Active Sub-Studio */}
      <div className="px-4 sm:px-6">
        {subTab === 'scene' && <SceneGenerator />}
        {subTab === 'video_plan' && <VideoPlanner />}
        {subTab === 'video' && <VideoStudio />}
        {subTab === 'audio' && <AudioStudio />}
      </div>
    </div>
  );
};
