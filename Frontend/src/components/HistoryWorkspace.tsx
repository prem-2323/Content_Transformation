import React, { useState, useEffect } from 'react';
import { Clock, FileText, Trash2, ArrowRight, Calendar, Sparkles } from 'lucide-react';
import { collection, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTheme } from '../context/ThemeContext';

interface HistoryWorkspaceProps {
  onLoadSession: (session: any) => void;
}

export const HistoryWorkspace: React.FC<HistoryWorkspaceProps> = ({ onLoadSession }) => {
  const { isDarkMode } = useTheme();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const querySnapshot = await getDocs(collection(db, 'history'));
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (docs.length > 0) {
          // Sort by timestamp desc
          docs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setHistory(docs);
        } else {
          // Fallback to localStorage
          const saved = localStorage.getItem('contentforge_transformation_history') || localStorage.getItem('synthetix_transformation_history');
          if (saved) {
            setHistory(JSON.parse(saved));
          }
        }
      } catch (e) {
        console.error("Failed to fetch history from Firestore, falling back to localStorage", e);
        const saved = localStorage.getItem('contentforge_transformation_history') || localStorage.getItem('synthetix_transformation_history');
        if (saved) {
          try {
            setHistory(JSON.parse(saved));
          } catch (err) {
            console.error("Failed to parse local history", err);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'history', id));
    } catch (err) {
      console.error("Error deleting from Firestore:", err);
    }
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('contentforge_transformation_history', JSON.stringify(updated));
  };

  const handleClearAll = async () => {
    try {
      for (const item of history) {
        await deleteDoc(doc(db, 'history', item.id));
      }
    } catch (err) {
      console.error("Error clearing Firestore history:", err);
    }
    setHistory([]);
    localStorage.removeItem('contentforge_transformation_history');
    localStorage.removeItem('synthetix_transformation_history');
  };

  return (
    <div className={`max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6 transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-4 ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <div>
          <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Transformation History</h2>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
            Access past transformation sessions and generated multi-channel deliverables saved locally.
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center space-x-2 transition self-start sm:self-auto ${
              isDarkMode ? 'bg-[#181818] hover:bg-[#282828] text-red-400 border-red-500/30' : 'bg-white hover:bg-slate-100 text-red-600 border-red-300 shadow-sm'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center shadow-lg transition-colors ${
          isDarkMode ? 'glass-card border-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.6)]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="w-16 h-16 rounded-full bg-[#1ed760]/10 text-[#1ed760] flex items-center justify-center mx-auto mb-4 border border-[#1ed760]/30">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No Previous Sessions Found</h3>
          <p className={`text-xs max-w-md mx-auto ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
            Once you execute content transformations, past results and session configurations will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => onLoadSession(item)}
              className={`rounded-2xl border p-6 shadow-lg transition-all duration-300 hover:border-[#1ed760] cursor-pointer flex flex-col justify-between group relative ${
                isDarkMode ? 'glass-card border-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.6)]' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#1ed760]/10 text-[#1ed760] border border-[#1ed760]/30">
                    {item.config?.audience || 'General'}
                  </span>
                  <button
                    onClick={(e) => handleDeleteItem(e, item.id)}
                    className={`p-1.5 rounded-full transition ${isDarkMode ? 'hover:bg-white/10 text-[#b3b3b3] hover:text-red-400' : 'hover:bg-slate-100 text-slate-400 hover:text-red-500'}`}
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className={`text-xs font-mono line-clamp-3 p-3 rounded-xl border transition-colors ${
                  isDarkMode ? 'text-white glass-panel border-white/10' : 'text-slate-800 bg-slate-50 border-slate-200'
                }`}>
                  {item.sourceText || 'Source file or prompt...'}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${isDarkMode ? 'bg-[#282828] text-[#b3b3b3]' : 'bg-slate-100 text-slate-700'}`}>
                    Tone: {item.config?.tone}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${isDarkMode ? 'bg-[#282828] text-[#b3b3b3]' : 'bg-slate-100 text-slate-700'}`}>
                    Lang: {item.config?.language}
                  </span>
                </div>
              </div>

              <div className={`mt-6 pt-4 border-t flex items-center justify-between text-xs ${isDarkMode ? 'border-[#282828] text-[#b3b3b3]' : 'border-slate-100 text-slate-500'}`}>
                <div className="flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#1ed760]" />
                  <span>{new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex items-center space-x-1 text-[#1ed760] font-bold group-hover:translate-x-1 transition">
                  <span>Load</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
