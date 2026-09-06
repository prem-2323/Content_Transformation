import React, { useState, useEffect } from 'react';
import { StickyNote, Plus, Pin, Trash2, Search, Tag, Sparkles, CheckSquare, Share2, Palette, Archive, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  labels: string[];
  updatedAt: string;
  checklist?: { id: string; text: string; completed: boolean }[];
}

interface GoogleKeepWorkspaceProps {
  onSendToTransform?: (text: string) => void;
}

const NOTE_COLORS = [
  { name: 'Default', bgDark: '#1e1e1e', bgLight: '#ffffff', border: '#333333' },
  { name: 'Red', bgDark: '#5c2b29', bgLight: '#f28b82', border: '#d93835' },
  { name: 'Orange', bgDark: '#613915', bgLight: '#fbbc04', border: '#e37400' },
  { name: 'Yellow', bgDark: '#534517', bgLight: '#fff475', border: '#fcc934' },
  { name: 'Green', bgDark: '#133929', bgLight: '#ccff90', border: '#34a853' },
  { name: 'Teal', bgDark: '#0f383d', bgLight: '#a7ffeb', border: '#00acc1' },
  { name: 'Blue', bgDark: '#1a334e', bgLight: '#cbf0f8', border: '#4285f4' },
  { name: 'Purple', bgDark: '#3c294d', bgLight: '#fdcfe8', border: '#af5cf7' },
];

export const GoogleKeepWorkspace: React.FC<GoogleKeepWorkspaceProps> = ({ onSendToTransform }) => {
  const { isDarkMode } = useTheme();
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('contentforge_google_keep_notes') || localStorage.getItem('synthetix_google_keep_notes');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return [
      {
        id: '1',
        title: 'APAC Expansion Strategy 2026',
        content: 'Focus on localized AI compliance and multi-region deployment across Tokyo, Singapore, and Sydney. Ensure fact grounding consistency via UCKR engine.',
        color: 'Yellow',
        isPinned: true,
        labels: ['Strategy', 'APAC'],
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        title: 'Quarterly OKRs Checklist',
        content: '- Launch AI content transformation engine v1.2\n- Integrate Google Keep & Workspace modules\n- Achieve 98% fact-checking consistency score',
        color: 'Green',
        isPinned: true,
        labels: ['OKRs', 'Engineering'],
        updatedAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];
  });

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState('Default');
  const [newLabels, setNewLabels] = useState('General');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('contentforge_google_keep_notes', JSON.stringify(notes));
    // Also try syncing to Firestore in background
    notes.forEach(async (note) => {
      try {
        await setDoc(doc(db, 'keep_notes', note.id), note);
      } catch (e) {
        // offline or rules issue fallback
      }
    });
  }, [notes]);

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() && !newContent.trim()) return;

    const note: Note = {
      id: Date.now().toString(),
      title: newTitle.trim() || 'Untitled Note',
      content: newContent.trim(),
      color: newColor,
      isPinned: false,
      labels: newLabels.split(',').map(l => l.trim()).filter(Boolean),
      updatedAt: new Date().toISOString()
    };

    setNotes([note, ...notes]);
    setNewTitle('');
    setNewContent('');
    setNewColor('Default');
    setNewLabels('General');
    setIsCreating(false);
  };

  const togglePin = (id: string) => {
    setNotes(notes.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
  };

  const deleteNote = async (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
    try {
      await deleteDoc(doc(db, 'keep_notes', id));
    } catch (e) {}
  };

  const allLabels = Array.from(new Set(notes.flatMap(n => n.labels)));

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          note.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLabel = selectedLabel ? note.labels.includes(selectedLabel) : true;
    return matchesSearch && matchesLabel;
  });

  const pinnedNotes = filteredNotes.filter(n => n.isPinned);
  const otherNotes = filteredNotes.filter(n => !n.isPinned);

  const getColorStyle = (colorName: string) => {
    const c = NOTE_COLORS.find(item => item.name === colorName) || NOTE_COLORS[0];
    return isDarkMode ? { backgroundColor: c.bgDark, borderColor: c.border } : { backgroundColor: c.bgLight, borderColor: c.border + '40' };
  };

  return (
    <div className={`flex-1 flex flex-col h-full overflow-y-auto p-6 ${isDarkMode ? 'bg-[#121212] text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Top Bar / Header */}
      <div className="max-w-5xl mx-auto w-full mb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-r from-emerald-600/10 via-[#1ed760]/10 to-teal-500/10 p-6 rounded-2xl border border-[#1ed760]/20 shadow-lg">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-[#1ed760] text-black rounded-xl shadow-md">
              <StickyNote className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Google Keep Notes Integration</h1>
              <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                Manage your notes, checklists, and synced ideas. Seamlessly dispatch notes to the UCKR Transform Engine.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border transition-all focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                  isDarkMode ? 'bg-[#181818] border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Quick Note Creator */}
        <div className={`max-w-xl mx-auto rounded-2xl border shadow-xl p-4 transition-all ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          {!isCreating ? (
            <div 
              onClick={() => setIsCreating(true)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer border border-dashed transition-all ${
                isDarkMode ? 'border-white/10 hover:border-[#1ed760]/50 text-slate-400' : 'border-slate-300 hover:border-emerald-500 text-slate-500'
              }`}
            >
              <span className="text-xs font-medium">Take a note or paste content...</span>
              <div className="flex items-center space-x-2 text-[#1ed760]">
                <CheckSquare className="w-4 h-4" />
                <Plus className="w-4 h-4" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateNote} className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className={`w-full font-bold px-3 py-1.5 rounded-lg text-sm bg-transparent border-none focus:outline-none ${
                  isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
                }`}
                autoFocus
              />
              <textarea
                placeholder="Take a note..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
                className={`w-full px-3 py-1.5 rounded-lg text-xs bg-transparent border-none focus:outline-none resize-none ${
                  isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
                }`}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-dashed border-white/10">
                <div className="flex items-center space-x-2">
                  <select
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className={`text-[10px] px-2 py-1 rounded-lg border bg-transparent ${
                      isDarkMode ? 'border-white/10 text-white' : 'border-slate-300 text-slate-800'
                    }`}
                  >
                    {NOTE_COLORS.map(c => (
                      <option key={c.name} value={c.name} className={isDarkMode ? 'bg-[#181818] text-white' : 'bg-white text-slate-900'}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Labels (comma separated)"
                    value={newLabels}
                    onChange={(e) => setNewLabels(e.target.value)}
                    className={`text-[10px] px-2 py-1 rounded-lg border bg-transparent ${
                      isDarkMode ? 'border-white/10 text-white' : 'border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#1ed760] text-black font-bold rounded-lg text-xs hover:bg-[#1db954] transition-colors shadow-md"
                  >
                    Done
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Label Filters */}
        {allLabels.length > 0 && (
          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedLabel(null)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                selectedLabel === null
                  ? 'bg-[#1ed760] text-black shadow'
                  : isDarkMode ? 'bg-[#181818] text-slate-400 hover:text-white' : 'bg-slate-200 text-slate-700 hover:text-slate-900'
              }`}
            >
              All Notes
            </button>
            {allLabels.map(label => (
              <button
                key={label}
                onClick={() => setSelectedLabel(label)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center space-x-1 ${
                  selectedLabel === label
                    ? 'bg-[#1ed760] text-black shadow'
                    : isDarkMode ? 'bg-[#181818] text-slate-400 hover:text-white' : 'bg-slate-200 text-slate-700 hover:text-slate-900'
                }`}
              >
                <Tag className="w-3 h-3" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Pinned Notes Section */}
        {pinnedNotes.length > 0 && (
          <div className="space-y-3">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Pinned</span>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pinnedNotes.map(note => (
                <div
                  key={note.id}
                  style={getColorStyle(note.color)}
                  className={`rounded-2xl border p-4 shadow-lg flex flex-col justify-between transition-all hover:shadow-xl relative group ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  <button
                    onClick={() => togglePin(note.id)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg opacity-80 hover:opacity-100 bg-black/20 text-white transition-all"
                    title="Unpin note"
                  >
                    <Pin className="w-3.5 h-3.5 fill-current" />
                  </button>

                  <div className="space-y-2 pr-6">
                    <h3 className="font-bold text-sm tracking-tight">{note.title}</h3>
                    <p className="text-xs whitespace-pre-wrap opacity-90 leading-relaxed">{note.content}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {note.labels.map(l => (
                        <span key={l} className="text-[9px] px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 font-medium">
                          {l}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center space-x-1">
                      {onSendToTransform && (
                        <button
                          onClick={() => onSendToTransform(`${note.title}\n\n${note.content}`)}
                          className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
                          title="Send to Transform Engine"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other Notes Section */}
        {otherNotes.length > 0 && (
          <div className="space-y-3">
            {pinnedNotes.length > 0 && <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Others</span>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {otherNotes.map(note => (
                <div
                  key={note.id}
                  style={getColorStyle(note.color)}
                  className={`rounded-2xl border p-4 shadow-md flex flex-col justify-between transition-all hover:shadow-xl relative group ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  <button
                    onClick={() => togglePin(note.id)}
                    className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:opacity-100 bg-black/20 text-white transition-all"
                    title="Pin note"
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>

                  <div className="space-y-2 pr-6">
                    <h3 className="font-bold text-sm tracking-tight">{note.title}</h3>
                    <p className="text-xs whitespace-pre-wrap opacity-90 leading-relaxed">{note.content}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {note.labels.map(l => (
                        <span key={l} className="text-[9px] px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 font-medium">
                          {l}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center space-x-1">
                      {onSendToTransform && (
                        <button
                          onClick={() => onSendToTransform(`${note.title}\n\n${note.content}`)}
                          className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
                          title="Send to Transform Engine"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredNotes.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <StickyNote className="w-12 h-12 text-slate-500 mx-auto opacity-50" />
            <p className="text-sm font-medium text-slate-400">No notes found.</p>
          </div>
        )}
      </div>
    </div>
  );
};
