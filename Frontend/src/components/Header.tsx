import React from 'react';
import { Sparkles, Terminal, Activity, ShieldCheck, FileText, Settings, BookOpen, Clock, MessageSquare, Sun, Moon, Menu } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenDocs: () => void;
  onToggleSidebar?: () => void;
  user?: any;
  onSignOut?: () => void;
  onGoHome?: () => void;
  onGoLogin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenDocs, onToggleSidebar, user, onSignOut, onGoHome, onGoLogin }) => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className={`${isDarkMode ? 'bg-[#121212] border-[#282828] text-white' : 'bg-white border-slate-200 text-slate-900'} border-b sticky top-0 z-30 shadow-md transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3 shrink-0">
          {onToggleSidebar && user && (
            <button
              onClick={onToggleSidebar}
              className={`p-2 rounded-xl md:hidden mr-1 border ${isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-slate-100 border-slate-300 text-slate-700'}`}
              title="Toggle Navigation"
            >
              <Menu className="w-5 h-5 text-[#1ed760]" />
            </button>
          )}
          <div 
            onClick={onGoHome}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-[#1ed760] flex items-center justify-center shadow-lg shadow-[#1ed760]/20 group-hover:scale-105 transition">
              <Sparkles className="w-4 h-4 text-black fill-black" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className={`spotify-heading text-base tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Spotify<span className="text-[#1ed760]">Synthetix</span></h1>
                <span className="spotify-pill px-2 py-0.5 rounded-full bg-[#1ed760]/10 text-[#1ed760] border border-[#1ed760]/30">v1.2.0</span>
              </div>
              <p className={`text-[10px] hidden sm:block ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Unified Content Transformation & UCKR Engine</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-full border transition-all ${isDarkMode ? 'bg-[#181818] border-[#4d4d4d] text-amber-400 hover:bg-[#282828]' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'}`}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenDocs}
            className={`spotify-btn flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs border transition ${isDarkMode ? 'bg-[#181818] border-[#4d4d4d] text-white hover:bg-[#282828]' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'}`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#1ed760]" />
            <span className="hidden sm:inline">OpenAPI</span>
          </button>
        </div>
      </div>
    </header>
  );
};

