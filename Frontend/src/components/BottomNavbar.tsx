import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { FAIcon } from './FAIcon';

interface BottomNavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomNavbar: React.FC<BottomNavbarProps> = ({ activeTab, setActiveTab }) => {
  const { isDarkMode } = useTheme();

  const navItems = [
    { id: 'transform', label: 'Transform', faIcon: 'fa-solid fa-wand-magic-sparkles' },
    { id: 'results', label: 'Results', faIcon: 'fa-solid fa-file-lines' },
    { id: 'visual_studio', label: 'Visual', faIcon: 'fa-solid fa-eye' },
    { id: 'video_studio', label: 'Video', faIcon: 'fa-solid fa-clapperboard' },
    { id: 'presentation', label: 'Presentation', faIcon: 'fa-solid fa-file-powerpoint' },
    { id: 'chatbot', label: 'AI Assistant', faIcon: 'fa-solid fa-robot' },
  ];

  return (
    <nav className={`
      fixed bottom-0 inset-x-0 z-40 md:hidden border-t backdrop-blur-xl px-2 py-1 flex items-center justify-around select-none shadow-2xl transition-colors
      ${isDarkMode ? 'bg-[#121212]/95 border-[#282828] text-white' : 'bg-white/95 border-slate-200 text-slate-900'}
    `}>
      {navItems.map((item) => {
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              isActive
                ? 'text-[#1ed760] font-bold'
                : isDarkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FAIcon
              icon={item.faIcon}
              className={`text-base transition-transform ${isActive ? 'scale-110 text-[#1ed760]' : ''}`}
            />
            <span className="text-[10px] mt-0.5 font-medium tracking-tight">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
