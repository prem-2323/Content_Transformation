import React from 'react';
import { motion } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { FAIcon } from './FAIcon';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  user?: any;
  onSignOut?: () => void;
  onGoLogin?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, onClose, user, onSignOut, onGoLogin }) => {
  const { isDarkMode } = useTheme();

  const groups = [
    {
      title: 'CORE TRANSFORM',
      items: [
        { id: 'transform', label: 'Transform Engine', faIcon: 'fa-solid fa-wand-magic-sparkles' },
        { id: 'results', label: 'Results Workspace', faIcon: 'fa-solid fa-file-lines' },
        { id: 'multimodal', label: 'PDF Studio', faIcon: 'fa-solid fa-file-pdf' },
      ]
    },
    {
      title: 'CREATION STUDIOS',
      items: [
        { id: 'visual_studio', label: 'Visual Studio', faIcon: 'fa-solid fa-[#1ed760] fa-eye' },
        { id: 'video_studio', label: 'Video Studio', faIcon: 'fa-solid fa-[#1ed760] fa-clapperboard' },
        { id: 'presentation', label: 'Presentation Studio', faIcon: 'fa-solid fa-file-powerpoint' },
      ]
    },
    {
      title: 'GOVERNANCE & CONTROLS',
      items: [
        { id: 'output_controls', label: 'Output Controls', faIcon: 'fa-solid fa-sliders' },
        { id: 'quality_validation', label: 'Quality & Validation', faIcon: 'fa-solid fa-shield-halved' },
      ]
    },
    {
      title: 'TOOLS & EXTENSIONS',
      items: [
        { id: 'chatbot', label: 'AI Assistant', faIcon: 'fa-solid fa-robot' },
        { id: 'history', label: 'History', faIcon: 'fa-solid fa-clock-rotate-left' },
        { id: 'api', label: 'API Explorer', faIcon: 'fa-solid fa-terminal' },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        sidebar w-[220px] min-w-[220px] h-full flex flex-col shrink-0 border-r transition-transform duration-300 p-3 select-none
        ${isDarkMode ? 'bg-[#121212] border-[#282828] text-white' : 'bg-white border-slate-200 text-slate-800'}
        ${isOpen !== undefined ? (isOpen ? 'fixed inset-y-0 left-0 z-50 translate-x-0' : 'fixed inset-y-0 left-0 z-50 -translate-x-full md:relative md:translate-x-0 md:z-auto') : ''}
      `}>
        <div className="flex items-center justify-between px-2 h-[30px] shrink-0 mb-2">
          <span className={`text-[12px] font-extrabold tracking-widest uppercase ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-400'}`}>
            NAVIGATION
          </span>
          {onClose && (
            <button 
              onClick={onClose}
              className={`p-1 rounded-lg md:hidden ${isDarkMode ? 'hover:bg-[#181818] text-[#b3b3b3]' : 'hover:bg-slate-100 text-slate-600'}`}
            >
              <FAIcon icon="fa-solid fa-xmark" className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="sidebar-nav flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
          {groups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-0.5">
              <div className={`h-[28px] flex items-center px-2 text-[11px] font-extrabold tracking-wider uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (onClose) onClose();
                      }}
                      className={`spotify-btn w-full h-[41px] flex items-center space-x-2.5 px-3 rounded-xl text-[12px] font-medium transition-all duration-200 relative group cursor-pointer ${
                        isActive
                          ? 'text-black font-extrabold shadow-md shadow-[#1ed760]/20'
                          : isDarkMode
                            ? 'text-[#b3b3b3] hover:text-white hover:bg-[#181818]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="absolute inset-0 bg-[#1ed760] rounded-xl z-0"
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center space-x-2.5 w-full truncate">
                        <FAIcon icon={item.faIcon} className={`text-sm shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-black' : 'text-[#1ed760]'}`} />
                        <span className="truncate">{item.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-footer shrink-0 pt-2 border-t border-dashed border-[#282828] space-y-2.5 mt-2">
          <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center space-x-1.5 mb-0.5">
              <div className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>UCKR Engine Active</span>
            </div>
            <p className={`text-[11px] leading-tight ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Atomic grounding active.</p>
          </div>

          {user ? (
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-slate-100 border-slate-200'}`}>
              <div className="flex items-center space-x-2 truncate">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-6 h-6 rounded-full border border-[#1ed760] shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#1ed760] text-black font-bold flex items-center justify-center text-[11px] shrink-0">
                    {(user.displayName || user.email || 'A')[0].toUpperCase()}
                  </div>
                )}
                <div className="truncate">
                  <p className={`text-[12px] font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {user.displayName || user.email || 'ads account'}
                  </p>
                  <p className="text-[10px] text-[#1ed760] uppercase tracking-wider font-semibold">Active</p>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase tracking-wider transition shrink-0 cursor-pointer"
                title="Sign Out"
              >
                Out
              </button>
            </div>
          ) : (
            <button
              onClick={onGoLogin}
              className="w-full py-2 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-[12px] uppercase tracking-wider shadow transition text-center cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </aside>
    </>
  );
};



