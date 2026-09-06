import React, { useState, useEffect } from 'react';
import { Upload, FileText, Globe, Sparkles, Sliders, CheckCircle2, ArrowRight, Layers, FileUp, Video, Image as ImageIcon, Bookmark, Trash2, Plus, Share2, MessageSquare, ShieldAlert, PieChart, Presentation, Volume2, Music, Mail, Square, Clock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { FAIcon } from './FAIcon';

interface TransformationFormProps {
  onRunTransform: (payload: any, isFile: boolean) => void;
  isLoading: boolean;
  onCancel?: () => void;
  initialConfig?: any;
  initialSourceText?: string;
}

export const TransformationForm: React.FC<TransformationFormProps> = ({ onRunTransform, isLoading, onCancel, initialConfig, initialSourceText }) => {
  const { isDarkMode } = useTheme();
  const [inputType, setInputType] = useState<'text' | 'file' | 'url'>('text');
  const [sourceText, setSourceText] = useState(initialSourceText || `Our primary objective for the coming fiscal year focuses on aggressive market expansion into the APAC region, leveraging our localized AI solutions to address specific regulatory and customer requirements across Singapore, Tokyo, and Sydney.`);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');

  // Configuration state
  const [audience, setAudience] = useState(initialConfig?.audience || 'C-Suite & Enterprise Executives');
  const [tone, setTone] = useState(initialConfig?.tone || 'Professional');
  const [language, setLanguage] = useState(initialConfig?.language || 'English');
  const [detailLevel, setDetailLevel] = useState(initialConfig?.detail_level || 'Comprehensive');
  const [objective, setObjective] = useState(initialConfig?.objective || 'Inform & Convert');
  
  const [selectedOutputs, setSelectedOutputs] = useState<string[]>(initialConfig?.output_types || [
    'Executive Summary',
    'LinkedIn Post',
    'Twitter/X Post',
    'Advisory',
    'Infographic',
    'Presentation',
    'Video',
    'Email Announcement'
  ]);
  const [selectedMp3Addons, setSelectedMp3Addons] = useState<string[]>(initialConfig?.mp3_addons || [
    'Executive Voiceover (MP3)'
  ]);

  // Custom Templates state
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('contentforge_custom_templates') || localStorage.getItem('synthetix_custom_templates');
    if (saved) {
      try {
        setCustomTemplates(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse custom templates", e);
      }
    }
  }, []);

  const calculateEstimatedTime = () => {
    let wordCount = 0;
    if (inputType === 'text') {
      wordCount = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;
    } else if (file) {
      wordCount = Math.round(file.size / 6);
    } else {
      wordCount = 150;
    }

    const baseSec = Math.max(1, Math.round(wordCount / 100));
    const outputCount = selectedOutputs.length;
    const detailFactor = detailLevel.includes('Concise') ? 0.8 : detailLevel.includes('Medium') ? 1.0 : detailLevel.includes('Comprehensive') ? 1.4 : 1.8;

    const totalSec = Math.max(3, Math.round(baseSec + (outputCount * 1.2 * detailFactor)));
    
    if (totalSec < 60) return `~${totalSec} sec`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `~${mins}m ${secs}s`;
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;
    const newTemplate = {
      id: Date.now().toString(),
      name: newTemplateName.trim(),
      config: {
        audience,
        tone,
        language,
        detail_level: detailLevel,
        objective,
        output_types: selectedOutputs
      }
    };
    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    localStorage.setItem('contentforge_custom_templates', JSON.stringify(updated));
    setNewTemplateName('');
    setShowSaveModal(false);
  };

  const handleLoadTemplate = (template: any) => {
    if (template.config) {
      setAudience(template.config.audience || audience);
      setTone(template.config.tone || tone);
      setLanguage(template.config.language || language);
      setDetailLevel(template.config.detail_level || detailLevel);
      setObjective(template.config.objective || objective);
      if (template.config.output_types) {
        setSelectedOutputs(template.config.output_types);
      }
    }
  };

  const handleDeleteTemplate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    localStorage.setItem('contentforge_custom_templates', JSON.stringify(updated));
  };

  const outputFormatOptions = [
    { id: 'Executive Summary', label: 'Executive Summary', desc: 'Concise brief with key takeaways & citations', faIcon: 'fa-solid fa-file-lines' },
    { id: 'LinkedIn Post', label: 'LinkedIn Post', desc: 'Engaging thought leadership post with hashtags', faIcon: 'fa-brands fa-linkedin' },
    { id: 'Twitter/X Post', label: 'Twitter/X Post', desc: 'Thread-optimized microblog format', faIcon: 'fa-brands fa-x-twitter' },
    { id: 'Advisory', label: 'Advisory Memo', desc: 'Formal confidential briefing document', faIcon: 'fa-solid fa-shield-halved' },
    { id: 'Infographic', label: 'Infographic Spec', desc: 'Structured metrics & bullet points for visuals', faIcon: 'fa-solid fa-chart-pie' },
    { id: 'Presentation', label: 'Presentation (.pptx)', desc: 'Slide deck outline with titles & talking points', faIcon: 'fa-solid fa-file-powerpoint' },
    { id: 'Video', label: 'Video Storyboard', desc: 'Scene-by-scene script with timestamps & voice prompts', faIcon: 'fa-solid fa-clapperboard' },
    { id: 'Email Announcement', label: 'Email Announcement', desc: 'Engaging corporate broadcast or team email update', faIcon: 'fa-solid fa-envelope' }
  ];

  const mp3AddonOptions = [
    { id: 'Executive Voiceover (MP3)', label: 'Executive Voiceover (MP3)', desc: 'Professional crisp speech synthesis for briefs', icon: Volume2 },
    { id: 'Spotify Audio Brief (MP3)', label: 'Spotify Audio Brief (MP3)', desc: 'Dynamic radio-style summary track', icon: Music },
    { id: 'Studio Podcast Edition (MP3)', label: 'Studio Podcast Edition (MP3)', desc: 'Full conversational two-host audio version', icon: Volume2 },
    { id: 'Bilingual Narration Track (MP3)', label: 'Bilingual Narration Track (MP3)', desc: 'Localized multi-language narration audio', icon: Globe }
  ];

  const audiences = ['General Public', 'C-Suite & Enterprise Executives', 'Software Developers & Engineers', 'Investors & Shareholders', 'Students & Researchers', 'Policy Makers & Regulators'];
  const tones = ['Professional', 'Authoritative', 'Conversational', 'Persuasive', 'Academic & Rigorous', 'Urgent & Inspiring'];
  const languages = ['English', 'Hindi (हिंदी)', 'Tamil (தமிழ்)', 'Telugu (తెలుగు)', 'Spanish (Español)', 'French (Français)', 'German (Deutsch)', 'Japanese (日本語)'];
  const detailLevels = ['Concise (Quick Read)', 'Medium (Balanced)', 'Comprehensive (Deep Dive)', 'Exhaustive (Full Analysis)'];
  const objectives = ['Inform', 'Persuade', 'Educate', 'Convert Customers', 'Comply & Audit', 'Entertain'];

  const toggleOutput = (id: string) => {
    if (selectedOutputs.includes(id)) {
      if (selectedOutputs.length > 1) {
        setSelectedOutputs(selectedOutputs.filter(o => o !== id));
      }
    } else {
      setSelectedOutputs([...selectedOutputs, id]);
    }
  };

  const toggleMp3Addon = (id: string) => {
    if (selectedMp3Addons.includes(id)) {
      setSelectedMp3Addons(selectedMp3Addons.filter(a => a !== id));
    } else {
      setSelectedMp3Addons([...selectedMp3Addons, id]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (inputType === 'file') {
      if (!file) {
        setFormError('Select a TXT, PDF or DOCX file first.');
        return;
      }
    } else if (inputType === 'url') {
      if (!sourceUrl.trim()) {
        setFormError('Enter a public article URL first — the backend scrapes and transforms it.');
        return;
      }
    } else if (!sourceText.trim()) {
      setFormError('Enter source text first — e.g. paste the article to turn into a LinkedIn post.');
      return;
    }
    const payload = {
      text: inputType === 'url' ? '' : sourceText,
      url: inputType === 'url' ? sourceUrl.trim() : undefined,
      audience,
      tone,
      language,
      detail_level: detailLevel,
      objective,
      output_types: selectedOutputs,
      mp3_addons: selectedMp3Addons
    };

    if (inputType === 'file' && file) {
      onRunTransform({ file, ...payload }, true);
    } else {
      onRunTransform(payload, false);
    }
  };

  return (
    <div className={`max-w-6xl mx-auto py-8 px-4 sm:px-6 transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className="mb-8 text-center">
        <h2 className={`text-3xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>AI Content Transformation Engine</h2>
        <p className={`mt-2 text-sm max-w-2xl mx-auto ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
          Transform one single source into multiple synchronized communication artifacts with atomic fact grounding (UCKR) and 7-step quality assurance.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Source Content Input */}
        <div className={`rounded-2xl border shadow-lg p-6 transition-colors duration-300 ${
          isDarkMode ? 'glass-card border-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.6)]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-full bg-[#1ed760]/20 text-[#1ed760] font-bold flex items-center justify-center text-xs border border-[#1ed760]/30">1</span>
              <h3 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Source Content Ingestion</h3>
            </div>
            <div className={`flex p-1 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors ${
              isDarkMode ? 'bg-[#121212] border-[#282828]' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setInputType('text')}
                className={`px-4 py-1.5 rounded-full transition ${inputType === 'text' ? 'bg-[#1ed760] text-black shadow-md' : isDarkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Raw Text / Prompt
              </button>
              <button
                type="button"
                onClick={() => setInputType('file')}
                className={`px-4 py-1.5 rounded-full transition ${inputType === 'file' ? 'bg-[#1ed760] text-black shadow-md' : isDarkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Upload File (PDF/DOCX/TXT)
              </button>
              <button
                type="button"
                onClick={() => setInputType('url')}
                className={`px-4 py-1.5 rounded-full transition ${inputType === 'url' ? 'bg-[#1ed760] text-black shadow-md' : isDarkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Web URL / Media
              </button>
            </div>
          </div>

          {inputType === 'text' && (
            <div>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={6}
                className={`w-full rounded-xl border p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1ed760] font-mono transition-colors ${
                  isDarkMode 
                    ? 'border-[#4d4d4d] bg-[#121212] text-white shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]' 
                    : 'border-slate-300 bg-slate-50 text-slate-900 shadow-sm'
                }`}
                placeholder="Paste source content, article, or prompt here..."
                required
              />
              <div className={`mt-2 flex justify-between text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                <span>Supports Markdown, raw text, research notes, and transcripts.</span>
                <span>{sourceText.length} characters</span>
              </div>
            </div>
          )}

          {inputType === 'file' && (
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
              isDarkMode ? 'border-[#4d4d4d] bg-[#121212] hover:border-[#1ed760]' : 'border-slate-300 bg-slate-50 hover:border-[#1ed760]'
            }`}>
              <input
                type="file"
                id="file-upload"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                accept=".pdf,.docx,.txt"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#1ed760]/10 text-[#1ed760] flex items-center justify-center mb-3 border border-[#1ed760]/30">
                  <Upload className="w-6 h-6" />
                </div>
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {file ? file.name : 'Click to upload PDF, DOCX, or TXT'}
                </span>
                <span className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Supports multimodal extraction with Gemma 3 4B</span>
              </label>
            </div>
          )}

          {inputType === 'url' && (
            <div>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/article-or-report"
                className={`w-full rounded-full border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition-colors ${
                  isDarkMode ? 'border-[#4d4d4d] bg-[#121212] text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                }`}
              />
              <p className={`mt-1 text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Enter a public URL for automated web scraping and fact extraction.</p>
            </div>
          )}
        </div>

        {/* Step 2: Transformation Parameters */}
        <div className={`rounded-2xl border shadow-lg p-6 transition-colors duration-300 ${
          isDarkMode ? 'glass-card border-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.6)]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b gap-4 ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-full bg-[#1ed760]/20 text-[#1ed760] font-bold flex items-center justify-center text-xs border border-[#1ed760]/30">2</span>
              <h3 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Transformation Parameters & Constraints</h3>
            </div>

            {/* Custom Templates Actions */}
            <div className="flex items-center space-x-2">
              {showSaveModal ? (
                <div className={`flex items-center space-x-2 p-1.5 rounded-xl border ${isDarkMode ? 'bg-[#121212] border-[#4d4d4d]' : 'bg-slate-100 border-slate-300'}`}>
                  <input
                    type="text"
                    placeholder="Template Name..."
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className={`px-3 py-1 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#1ed760] ${
                      isDarkMode ? 'bg-[#181818] border-[#4d4d4d] text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="px-3 py-1 rounded-lg bg-[#1ed760] text-black text-xs font-bold uppercase tracking-wider hover:bg-[#1db954]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSaveModal(false)}
                    className={`px-2 py-1 text-xs ${isDarkMode ? 'text-[#b3b3b3] hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center space-x-1.5 transition ${
                    isDarkMode ? 'bg-[#121212] hover:bg-[#282828] text-white border-[#4d4d4d]' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-sm'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5 text-[#1ed760]" />
                  <span>Save as Custom Template</span>
                </button>
              )}
            </div>
          </div>

          {/* Saved Templates Pills */}
          {customTemplates.length > 0 && (
            <div className={`mb-6 pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Saved Custom Templates</span>
              <div className="flex flex-wrap gap-2">
                {customTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleLoadTemplate(template)}
                    className={`group flex items-center space-x-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition shadow-sm ${
                      isDarkMode 
                        ? 'bg-[#121212] border-[#4d4d4d] hover:border-[#1ed760] text-white' 
                        : 'bg-slate-100 border-slate-300 hover:border-[#1ed760] text-slate-800'
                    }`}
                  >
                    <span>{template.name}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteTemplate(e, template.id)}
                      className={`transition ${isDarkMode ? 'text-[#b3b3b3] hover:text-red-400' : 'text-slate-400 hover:text-red-500'} opacity-0 group-hover:opacity-100`}
                      title="Delete template"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className={`block text-[10px] uppercase tracking-widest font-bold mb-2 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>Target Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className={`w-full rounded-full border px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1ed760] outline-none transition-colors ${
                  isDarkMode ? 'border-[#4d4d4d] bg-[#121212] text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                }`}
              >
                {audiences.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[10px] uppercase tracking-widest font-bold mb-2 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>Tone & Voice</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className={`w-full rounded-full border px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1ed760] outline-none transition-colors ${
                  isDarkMode ? 'border-[#4d4d4d] bg-[#121212] text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                }`}
              >
                {tones.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[10px] uppercase tracking-widest font-bold mb-2 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>Output Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={`w-full rounded-full border px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1ed760] outline-none transition-colors ${
                  isDarkMode ? 'border-[#4d4d4d] bg-[#121212] text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                }`}
              >
                {languages.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[10px] uppercase tracking-widest font-bold mb-2 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>Detail Level</label>
              <select
                value={detailLevel}
                onChange={(e) => setDetailLevel(e.target.value)}
                className={`w-full rounded-full border px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1ed760] outline-none transition-colors ${
                  isDarkMode ? 'border-[#4d4d4d] bg-[#121212] text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                }`}
              >
                {detailLevels.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[10px] uppercase tracking-widest font-bold mb-2 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>Communication Objective</label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className={`w-full rounded-full border px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1ed760] outline-none transition-colors ${
                  isDarkMode ? 'border-[#4d4d4d] bg-[#121212] text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                }`}
              >
                {objectives.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Step 3: Output Formats Selection */}
        <div className={`rounded-2xl border shadow-lg p-6 transition-colors duration-300 ${
          isDarkMode ? 'glass-card border-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.6)]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-full bg-[#1ed760]/20 text-[#1ed760] font-bold flex items-center justify-center text-xs border border-[#1ed760]/30">3</span>
              <h3 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Select Deliverable Formats</h3>
            </div>
            <span className="text-xs text-[#1ed760] font-bold uppercase tracking-wider">{selectedOutputs.length} formats selected</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {outputFormatOptions.map((opt) => {
              const isSelected = selectedOutputs.includes(opt.id);
              const IconComponent = (opt as any).icon;
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleOutput(opt.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#1ed760] bg-[#1ed760]/10 ring-1 ring-[#1ed760] shadow-lg shadow-[#1ed760]/10'
                      : isDarkMode 
                        ? 'border-[#282828] bg-[#1f1f1f] hover:border-[#4d4d4d]' 
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-[#1ed760] text-black' : isDarkMode ? 'bg-[#282828] text-[#1ed760]' : 'bg-slate-200 text-slate-700'
                    }`}>
                      <FAIcon icon={opt.faIcon} className="text-sm" />
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      isSelected 
                        ? 'bg-[#1ed760] text-black font-bold' 
                        : isDarkMode ? 'border border-[#4d4d4d] bg-[#121212]' : 'border border-slate-300 bg-white'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                    </div>
                  </div>
                  <div>
                    <h4 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{opt.label}</h4>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>{opt.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`mt-8 pt-6 border-t flex items-center justify-between ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
            <div className="space-y-2">
              <div className={`text-xs flex items-center space-x-2 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                <Sparkles className="w-4 h-4 text-[#1ed760]" />
                <span>Powered by Qwen3 4B & UCKR Consistency Engine (7-Step Pipeline)</span>
              </div>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
            </div>

            <div className="flex items-center space-x-3">
              {isLoading && onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-6 py-3 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 text-xs font-bold uppercase tracking-[1.5px] transition flex items-center space-x-2 cursor-pointer shadow-lg"
                  title="Stop Execution"
                >
                  <Square className="w-4 h-4 fill-red-400" />
                  <span>STOP</span>
                </button>
              )}

              <button
                type="submit"
                disabled={isLoading || selectedOutputs.length === 0}
                className="px-8 py-3 rounded-full bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-[1.5px] shadow-[0_8px_24px_rgba(30,215,96,0.3)] transition flex items-center space-x-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Executing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <span>TRANSFORM CONTENT</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
