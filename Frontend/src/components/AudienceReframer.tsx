import React, { useState } from 'react';
import { Users, Sparkles, Copy, Check, RefreshCw, Briefcase, Code, Globe, GraduationCap, ShoppingBag, Newspaper, Landmark, AlertCircle, FileText, Square, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { transformApi, BrandVoiceProfile } from '../api/transform';
import { FAIcon } from './FAIcon';

export const AUDIENCE_PERSONAS = [
  {
    id: 'CEO or Executives',
    label: 'CEO & Executives',
    faIcon: 'fa-solid fa-user-tie',
    color: 'from-amber-500 to-orange-600',
    description: 'High-level ROI, strategic impact, metrics, decision points, concise takeaways.'
  },
  {
    id: 'Technical Teams',
    label: 'Technical Teams',
    faIcon: 'fa-solid fa-code',
    color: 'from-blue-500 to-indigo-600',
    description: 'Architecture details, data specs, technical nuances, integration steps, APIs.'
  },
  {
    id: 'General Public',
    label: 'General Public',
    faIcon: 'fa-solid fa-earth-americas',
    color: 'from-emerald-500 to-teal-600',
    description: 'Clear non-jargon language, relatable analogies, real-world relevance, easy flow.'
  },
  {
    id: 'Students',
    label: 'Students & Learners',
    faIcon: 'fa-solid fa-graduation-cap',
    color: 'from-purple-500 to-violet-600',
    description: 'Educational framing, foundational principles, learning takeaways, glossaries.'
  },
  {
    id: 'Customers',
    label: 'Customers & Clients',
    faIcon: 'fa-solid fa-bag-shopping',
    color: 'from-pink-500 to-rose-600',
    description: 'Direct user benefits, value proposition, actionable steps, problem-solution focus.'
  },
  {
    id: 'Journalists',
    label: 'Journalists & Press',
    faIcon: 'fa-solid fa-newspaper',
    color: 'from-cyan-500 to-blue-600',
    description: 'Press release style, punchy headline, lead paragraph, quotes, stat callouts.'
  },
  {
    id: 'Government Officials',
    label: 'Government & Regulators',
    faIcon: 'fa-solid fa-landmark',
    color: 'from-[#1ed760] to-emerald-700',
    description: 'Formal policy alignment, compliance impacts, risk assessment, governance facts.'
  }
];

const SAMPLE_DOC = `QuantumSecure Encryption Engine Architecture & Q3 Deployment Advisory:
Our engineering team has finalized the v3.4 release of QuantumSecure, featuring post-quantum lattice-based cryptography (Kyber-1024), reducing handshake latency by 38% while bolstering defense against harvest-now-decrypt-later vectors. Total deployment cost is $420,000 across 12 data centers, with zero unplanned downtime during migration. Compliance with NIST FIPS 203 standards has been audited and certified by ISO-27001 auditors. Key benefits include automated key rotation, zero-trust hardware security module (HSM) integration, and seamless API backward compatibility.`;

export const AudienceReframer: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [sourceText, setSourceText] = useState(SAMPLE_DOC);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(
    AUDIENCE_PERSONAS.map(p => p.id)
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('grid');

  const toggleAudience = (id: string) => {
    setSelectedAudiences(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedAudiences(AUDIENCE_PERSONAS.map(p => p.id));
  const deselectAll = () => setSelectedAudiences([]);

  const handleReframe = async () => {
    if (!sourceText.trim()) {
      setError('Please enter source text to reframe.');
      return;
    }
    if (selectedAudiences.length === 0) {
      setError('Please select at least one target audience persona.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Optional brand voice profile from localStorage if exists
      let brandVoice: BrandVoiceProfile | undefined = undefined;
      const savedProfile = localStorage.getItem('brand_voice_profile');
      if (savedProfile) {
        try {
          brandVoice = JSON.parse(savedProfile);
        } catch {
          // ignore parsing error
        }
      }

      const res = await transformApi.reframeAudience({
        text: sourceText,
        audiences: selectedAudiences,
        brand_voice: brandVoice
      });

      setResults(res.reframed_outputs);
    } catch (err: any) {
      console.error('Audience Reframing Error:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to reframe content for selected audiences.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'} flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1ed760] to-emerald-700 flex items-center justify-center shadow-lg shadow-[#1ed760]/20 text-black">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Audience Reframing Engine
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#1ed760]/20 text-[#1ed760] border border-[#1ed760]/30">
                Persona Adaptive
              </span>
            </div>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Transform 1 source document into specialized versions for Executives, Engineers, Public, Students, Clients, Press & Regulators.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Input & Options */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Source Text Input */}
        <div className="lg:col-span-7 space-y-4">
          <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'} space-y-3`}>
            <div className="flex items-center justify-between">
              <label className={`text-xs font-extrabold uppercase tracking-wider flex items-center space-x-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                <FileText className="w-4 h-4 text-[#1ed760]" />
                <span>Source Document / Text</span>
              </label>
              <button
                onClick={() => setSourceText(SAMPLE_DOC)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${isDarkMode ? 'border-white/10 hover:bg-white/5 text-[#1ed760]' : 'border-slate-200 hover:bg-slate-50 text-emerald-600'}`}
              >
                Load Sample Document
              </button>
            </div>

            <textarea
              rows={8}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Paste original whitepaper, technical report, press release, or advisory document here..."
              className={`w-full p-4 rounded-xl text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition resize-none ${
                isDarkMode
                  ? 'bg-[#121212] border border-[#282828] text-white placeholder-slate-600'
                  : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{sourceText.length} characters | {sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0} words</span>
              {error && (
                <span className="text-red-400 font-semibold flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                  {error}
                </span>
              )}
            </div>
          </div>

          {/* Action Card */}
          <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'} flex items-center justify-between`}>
            <div className="flex items-center space-x-3 text-xs">
              <div>
                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Selected Target Personas:
                </span>{' '}
                <span className="text-[#1ed760] font-extrabold">{selectedAudiences.length} of {AUDIENCE_PERSONAS.length}</span>
              </div>

              <div className={`px-3 py-1 rounded-full border flex items-center space-x-1.5 text-[11px] font-bold ${
                isDarkMode ? 'bg-[#121212] border-[#282828] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}>
                <Clock className="w-3.5 h-3.5 text-[#1ed760]" />
                <span>Est. Time: <strong className="text-[#1ed760]">~{Math.max(2, Math.round((sourceText.trim().split(/\s+/).length / 100) + (selectedAudiences.length * 1.5)))} sec</strong></span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {isProcessing ? (
                <button
                  onClick={() => setIsProcessing(false)}
                  className="px-5 py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center space-x-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 transition shadow-lg cursor-pointer"
                  title="Stop Reframing"
                >
                  <Square className="w-4 h-4 fill-red-400" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  onClick={handleReframe}
                  disabled={!sourceText.trim() || selectedAudiences.length === 0}
                  className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition shadow-lg cursor-pointer ${
                    !sourceText.trim() || selectedAudiences.length === 0
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-[#1ed760] hover:bg-[#1db954] text-black shadow-[#1ed760]/20'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Reframe for Selected Audiences</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Persona Selection Grid */}
        <div className="lg:col-span-5 space-y-4">
          <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'} space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Target Audiences
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={selectAll}
                  className="text-[10px] font-bold uppercase text-[#1ed760] hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-600">|</span>
                <button
                  onClick={deselectAll}
                  className="text-[10px] font-bold uppercase text-slate-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
              {AUDIENCE_PERSONAS.map(persona => {
                const Icon = (persona as any).icon;
                const isSelected = selectedAudiences.includes(persona.id);

                return (
                  <div
                    key={persona.id}
                    onClick={() => toggleAudience(persona.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-start space-x-3 ${
                      isSelected
                        ? isDarkMode
                          ? 'bg-[#121212] border-[#1ed760]/50 shadow-sm'
                          : 'bg-emerald-50/70 border-emerald-300'
                        : isDarkMode
                          ? 'bg-[#121212]/50 border-[#282828] hover:border-slate-700 opacity-60'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300 opacity-60'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${persona.color} flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm`}>
                      <FAIcon icon={persona.faIcon} className="text-xs text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {persona.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-slate-700 text-[#1ed760] focus:ring-[#1ed760]"
                        />
                      </div>
                      <p className={`text-[11px] leading-tight mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {persona.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Reframed Outputs Grid & Viewer */}
      {results && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[#282828] pb-3">
            <h2 className={`text-lg font-bold flex items-center space-x-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <Sparkles className="w-5 h-5 text-[#1ed760]" />
              <span>Reframed Audience Outputs ({Object.keys(results).length})</span>
            </h2>

            <div className="flex items-center space-x-1 p-1 rounded-xl bg-[#181818] border border-[#282828]">
              <button
                onClick={() => setActiveTab('grid')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeTab === 'grid' ? 'bg-[#1ed760] text-black' : 'text-slate-400 hover:text-white'}`}
              >
                Grid View
              </button>
              <button
                onClick={() => setActiveTab('tabs')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeTab === 'tabs' ? 'bg-[#1ed760] text-black' : 'text-slate-400 hover:text-white'}`}
              >
                Tabbed View
              </button>
            </div>
          </div>

          {activeTab === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(results as Record<string, string>).map(([audience, content]: [string, string]) => {
                const persona = AUDIENCE_PERSONAS.find(p => p.id === audience) || {
                  label: audience,
                  faIcon: 'fa-solid fa-users',
                  color: 'from-emerald-500 to-teal-600',
                  description: 'Tailored audience profile'
                };

                return (
                  <div
                    key={audience}
                    className={`p-5 rounded-2xl border flex flex-col justify-between ${
                      isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-md'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-[#282828] pb-3">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${persona.color} flex items-center justify-center text-white shrink-0 shadow`}>
                            <FAIcon icon={persona.faIcon || 'fa-solid fa-users'} className="text-xs text-white" />
                          </div>
                          <div>
                            <h3 className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {persona.label}
                            </h3>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {content.length} chars | {content.trim().split(/\s+/).length} words
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleCopy(audience, content)}
                          className={`p-1.5 rounded-lg border transition ${
                            copiedKey === audience
                              ? 'bg-[#1ed760]/20 border-[#1ed760] text-[#1ed760]'
                              : isDarkMode
                                ? 'border-[#282828] hover:bg-[#282828] text-slate-400'
                                : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                          }`}
                          title="Copy Output"
                        >
                          {copiedKey === audience ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className={`p-3.5 rounded-xl text-xs font-normal leading-relaxed whitespace-pre-wrap ${
                        isDarkMode ? 'bg-[#121212] text-slate-300 border border-[#282828]' : 'bg-slate-50 text-slate-800 border border-slate-200'
                      }`}>
                        {content}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#282828] flex items-center justify-between text-[11px] text-slate-500">
                      <span className="truncate">{persona.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Tabbed View */
            <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-md'} space-y-4`}>
              <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-thin">
                {Object.keys(results).map(aud => {
                  const persona = AUDIENCE_PERSONAS.find(p => p.id === aud);
                  const isSelected = activeTab === aud;
                  return (
                    <button
                      key={aud}
                      onClick={() => setActiveTab(aud)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition ${
                        isSelected
                          ? 'bg-[#1ed760] text-black shadow-md'
                          : isDarkMode
                            ? 'bg-[#121212] text-slate-400 hover:text-white border border-[#282828]'
                            : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                      }`}
                    >
                      {persona?.label || aud}
                    </button>
                  );
                })}
              </div>

              {results[activeTab] && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1ed760] uppercase tracking-wider">
                      Target Output Preview
                    </span>
                    <button
                      onClick={() => handleCopy(activeTab, results[activeTab])}
                      className="px-3 py-1.5 rounded-lg bg-[#1ed760]/20 hover:bg-[#1ed760]/30 text-[#1ed760] font-bold text-xs flex items-center space-x-1.5 border border-[#1ed760]/40 transition"
                    >
                      {copiedKey === activeTab ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedKey === activeTab ? 'Copied!' : 'Copy to Clipboard'}</span>
                    </button>
                  </div>

                  <div className={`p-5 rounded-xl text-sm leading-relaxed font-normal whitespace-pre-wrap ${
                    isDarkMode ? 'bg-[#121212] text-white border border-[#282828]' : 'bg-slate-50 text-slate-900 border border-slate-200'
                  }`}>
                    {results[activeTab]}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
