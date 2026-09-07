import React, { useState } from 'react';
import {
  Presentation,
  Download,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  X,
  Palette
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { presentationApi } from '../api/presentation';

export const PresentationStudio: React.FC = () => {
  const { isDarkMode } = useTheme();

  // Primary Request Field (Matching POST /export-pptx Schema)
  const [sourceText, setSourceText] = useState<string>('');

  // Parameters
  const [audience, setAudience] = useState<string>('General public');
  const [tone, setTone] = useState<string>('Professional');
  const [language, setLanguage] = useState<string>('English');
  const [detailLevel, setDetailLevel] = useState<string>('Medium');
  const [objective, setObjective] = useState<string>('Inform');
  const [numSlides, setNumSlides] = useState<number>(6);
  const [theme, setTheme] = useState<string>('spotify_emerald');

  // Brand Voice (Optional Schema Extension)
  const [showBrandVoice, setShowBrandVoice] = useState<boolean>(false);
  const [brandName, setBrandName] = useState<string>('Enterprise AI');
  const [brandTone, setBrandTone] = useState<string>('Professional, Authoritative & Empathetic');
  const [primaryColor, setPrimaryColor] = useState<string>('#1ED760');
  const [secondaryColor, setSecondaryColor] = useState<string>('#181818');
  const [accentColor, setAccentColor] = useState<string>('#9333EA');
  const [preferredVocabulary, setPreferredVocabulary] = useState<string>('enterprise-grade, seamless, synergy, grounded intelligence');
  const [forbiddenPhrases, setForbiddenPhrases] = useState<string>('game-changer, revolutionary, cheap, unmatched');
  const [disclaimer, setDisclaimer] = useState<string>('Confidential & Proprietary. All rights reserved.');

  // Status & Loaders
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audiences = [
    'General public',
    'C-Suite & Enterprise Executives',
    'Software Developers & Engineers',
    'Investors & Shareholders',
    'Students & Researchers',
    'Sales & Marketing Teams',
  ];

  const tones = [
    'Professional',
    'Authoritative',
    'Conversational',
    'Persuasive',
    'Academic & Rigorous',
    'Urgent & Inspiring',
  ];

  const languages = [
    'English',
    'Spanish',
    'French',
    'German',
    'Hindi',
    'Tamil',
    'Telugu',
    'Japanese',
  ];

  const detailLevels = [
    'Concise (Quick Read)',
    'Medium (Balanced)',
    'Comprehensive (Deep Dive)',
    'Exhaustive (Full Analysis)',
  ];

  const objectives = [
    'Inform',
    'Persuade',
    'Educate',
    'Convert Customers',
    'Comply & Audit',
  ];

  const themes = [
    { id: 'spotify_emerald', label: 'Spotify Emerald', color: '#1ED760' },
    { id: 'executive_navy', label: 'Executive Navy', color: '#38BDF8' },
    { id: 'corporate_purple', label: 'Corporate Indigo', color: '#818CF8' },
    { id: 'crimson_minimal', label: 'Crimson Tech', color: '#F43F5E' },
    { id: 'modern_tech', label: 'Modern Slate', color: '#2563EB' },
  ];

  // Helper to trigger browser blob download
  const triggerDownload = (blob: Blob, filename: string) => {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'presentation.pptx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  // Direct POST /export-pptx Execution
  const handleExportPptx = async () => {
    if (!sourceText.trim()) {
      setErrorMessage('Please enter a presentation topic or content to generate PowerPoint.');
      return;
    }

    setIsExporting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const requestPayload = {
        text: sourceText.trim(),
        audience,
        tone,
        language,
        detail_level: detailLevel,
        objective,
        duration: numSlides * 5,
        output_type: 'presentation',
        output_types: ['presentation'],
        theme,
        brand_voice: showBrandVoice ? {
          brand_name: brandName,
          brand_tone: brandTone,
          preferred_vocabulary: preferredVocabulary.split(',').map((s) => s.trim()).filter(Boolean),
          forbidden_phrases: forbiddenPhrases.split(',').map((s) => s.trim()).filter(Boolean),
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          disclaimer: disclaimer,
        } : {
          primary_color: themes.find(t => t.id === theme)?.color || '#1ED760',
          disclaimer: disclaimer
        },
      };

      const { blob, filename } = await presentationApi.exportPptx(requestPayload);
      triggerDownload(blob, filename);
      setStatusMessage(`PowerPoint presentation "${filename}" generated and downloaded successfully!`);
    } catch (err: any) {
      console.error('Export PPTX Error:', err);
      setErrorMessage(err?.response?.data?.detail || err?.message || 'Failed to export PowerPoint (.pptx) file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      {/* Top Studio Header Banner */}
      <div className={`pb-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isDarkMode ? 'border-[#282828]' : 'border-slate-200'
      }`}>
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-serif flex items-center space-x-2">
            <Presentation className="w-6 h-6 text-[#1ed760]" />
            <span>Presentation Studio</span>
          </h2>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
            Generate structured Microsoft PowerPoint (.pptx) slide decks via <code className="text-[#1ed760] font-mono">POST /export-pptx</code>.
          </p>
        </div>

        <button
          onClick={handleExportPptx}
          disabled={isExporting}
          className="px-6 py-2.5 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition cursor-pointer disabled:opacity-40"
        >
          {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>{isExporting ? 'Generating PPTX...' : 'Download PowerPoint (.pptx)'}</span>
        </button>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-[#1ed760]/10 border border-[#1ed760]/30 text-[#1ed760] text-xs font-semibold flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center space-x-2">
          <X className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Request Form Panel */}
      <div className={`p-6 rounded-2xl border shadow-lg space-y-6 ${
        isDarkMode ? 'glass-card border-white/10' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        {/* Input Content Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <span>Presentation Topic or Document Content</span>
            </label>
            <span className="text-[11px] font-mono text-slate-400">
              {sourceText.length} characters
            </span>
          </div>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            rows={7}
            placeholder="Enter a simple presentation topic (e.g. 'The Future of Renewable Energy in 2030' or 'AI in Modern Medicine') or paste full document text to generate structured slides..."
            className={`w-full p-4 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition font-sans ${
              isDarkMode
                ? 'bg-[#121212] border-white/10 text-white placeholder-slate-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Presentation Parameters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {/* Audience */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Audience</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className={`w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-[#1ed760] cursor-pointer ${
                isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {audiences.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Tone */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className={`w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-[#1ed760] cursor-pointer ${
                isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {tones.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-[#1ed760] cursor-pointer ${
                isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {languages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Detail Level */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Detail Level</label>
            <select
              value={detailLevel}
              onChange={(e) => setDetailLevel(e.target.value)}
              className={`w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-[#1ed760] cursor-pointer ${
                isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {detailLevels.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Objective */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Objective</label>
            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className={`w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-[#1ed760] cursor-pointer ${
                isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {objectives.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Slide Count */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Slide Count</label>
              <span className="text-xs font-mono font-bold text-[#1ed760]">{numSlides} slides</span>
            </div>
            <input
              type="range"
              min={3}
              max={15}
              value={numSlides}
              onChange={(e) => setNumSlides(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1ed760]"
            />
          </div>
        </div>

        {/* Color Theme Selector */}
        <div className="space-y-2 pt-1 border-t border-white/10">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <Palette className="w-3.5 h-3.5 text-[#1ed760]" />
            <span>PowerPoint Color Theme</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`p-2.5 rounded-xl border flex items-center space-x-2.5 transition cursor-pointer text-left ${
                  theme === t.id
                    ? 'border-[#1ed760] bg-[#1ed760]/10 shadow'
                    : isDarkMode
                    ? 'border-white/10 bg-[#181818] hover:border-white/20'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: t.color }}
                />
                <span className="text-xs font-semibold truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Brand Voice Customization */}
        <div className="pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => setShowBrandVoice(!showBrandVoice)}
            className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition cursor-pointer"
          >
            <span className="flex items-center space-x-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#1ed760]" />
              <span>Brand Voice & Custom Guidelines (Optional)</span>
            </span>
            {showBrandVoice ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showBrandVoice && (
            <div className={`mt-3 p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-4 ${
              isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Brand Name</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#1ed760] ${
                    isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Brand Tone</label>
                <input
                  type="text"
                  value={brandTone}
                  onChange={(e) => setBrandTone(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#1ed760] ${
                    isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Primary Accent Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#1ed760] font-mono ${
                      isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Footer Disclaimer</label>
                <input
                  type="text"
                  value={disclaimer}
                  onChange={(e) => setDisclaimer(e.target.value)}
                  placeholder="Confidential & Proprietary. All rights reserved."
                  className={`w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#1ed760] ${
                    isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Preferred Vocabulary (comma separated)</label>
                <input
                  type="text"
                  value={preferredVocabulary}
                  onChange={(e) => setPreferredVocabulary(e.target.value)}
                  placeholder="e.g. enterprise-grade, seamless, synergy, grounded intelligence"
                  className={`w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-[#1ed760] ${
                    isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={handleExportPptx}
            disabled={isExporting}
            className="w-full py-3.5 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isExporting ? 'Generating PowerPoint (.pptx)...' : 'Download PowerPoint (.pptx)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
