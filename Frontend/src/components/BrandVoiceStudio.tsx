import React, { useState, useEffect } from 'react';
import { Sliders, Save, Check, ShieldAlert, Sparkles, Tag, Ban, Palette, FileText, Globe, RefreshCw, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { transformApi, BrandVoiceProfile } from '../api/transform';

const DEFAULT_PROFILE: BrandVoiceProfile = {
  brand_name: 'Acme Enterprise Solutions',
  brand_tone: 'Authoritative & Direct',
  preferred_vocabulary: ['quantum-ready', 'mission-critical', 'zero-trust', 'enterprise-grade', 'lattice-proof'],
  forbidden_phrases: ['game-changer', 'synergy', 'revolutionary', 'best-in-class', 'paradigm shift'],
  hashtag_rules: '#AcmeSecurity #CyberResilience #PostQuantum #EnterpriseAI',
  formatting_style: 'Clean markdown structure with bold takeaway headers, key metric bullet points, and bulleted takeaways.',
  disclaimer: 'CONFIDENTIAL & PROPRIETARY: The information in this document is intended solely for authorized personnel. © 2026 Acme Enterprise Solutions Inc.',
  logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  primary_color: '#1ed760',
  secondary_color: '#0f172a',
  accent_color: '#3b82f6'
};

const TONE_OPTIONS = [
  'Authoritative & Direct',
  'Friendly & Accessible',
  'Technical & Precise',
  'Inspiring & Visionary',
  'Formal & Regulatory',
  'Conversational & Energetic'
];

export const BrandVoiceStudio: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [profile, setProfile] = useState<BrandVoiceProfile>(DEFAULT_PROFILE);
  const [vocabInput, setVocabInput] = useState('');
  const [forbiddenInput, setForbiddenInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const data = await transformApi.getBrandVoice();
      if (data && data.brand_name) {
        setProfile(data);
        localStorage.setItem('brand_voice_profile', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Failed to load profile from backend, using fallback:', err);
      const cached = localStorage.getItem('brand_voice_profile');
      if (cached) {
        try {
          setProfile(JSON.parse(cached));
        } catch {
          // ignore
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const saved = await transformApi.saveBrandVoice(profile);
      setProfile(saved);
      localStorage.setItem('brand_voice_profile', JSON.stringify(saved));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save brand voice profile:', err);
      setError(err?.response?.data?.detail || 'Failed to save brand voice profile to server.');
    } finally {
      setIsSaving(false);
    }
  };

  const addVocabTag = () => {
    if (!vocabInput.trim()) return;
    const clean = vocabInput.trim().toLowerCase();
    if (!profile.preferred_vocabulary.includes(clean)) {
      setProfile(prev => ({
        ...prev,
        preferred_vocabulary: [...prev.preferred_vocabulary, clean]
      }));
    }
    setVocabInput('');
  };

  const removeVocabTag = (tag: string) => {
    setProfile(prev => ({
      ...prev,
      preferred_vocabulary: prev.preferred_vocabulary.filter(t => t !== tag)
    }));
  };

  const addForbiddenTag = () => {
    if (!forbiddenInput.trim()) return;
    const clean = forbiddenInput.trim().toLowerCase();
    if (!profile.forbidden_phrases.includes(clean)) {
      setProfile(prev => ({
        ...prev,
        forbidden_phrases: [...prev.forbidden_phrases, clean]
      }));
    }
    setForbiddenInput('');
  };

  const removeForbiddenTag = (phrase: string) => {
    setProfile(prev => ({
      ...prev,
      forbidden_phrases: prev.forbidden_phrases.filter(p => p !== phrase)
    }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'} flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
        <div className="flex items-center space-x-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg text-black transition-colors"
            style={{ backgroundColor: profile.primary_color || '#1ed760' }}
          >
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Brand Voice Memory & Identity
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#1ed760]/20 text-[#1ed760] border border-[#1ed760]/30">
                Persistent Identity
              </span>
            </div>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Enforce organization tone, preferred jargon, scrubbed forbidden phrases, formatting, disclaimers & brand colors across every generated output.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition shadow-lg cursor-pointer ${
            saveSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-[#1ed760] hover:bg-[#1db954] text-black shadow-[#1ed760]/20'
          }`}
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Saving Profile...</span>
            </>
          ) : saveSuccess ? (
            <>
              <Check className="w-4 h-4" />
              <span>Profile Saved!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Communication Profile</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-8 space-y-6">
          {/* General Identity & Tone */}
          <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'} space-y-4`}>
            <h2 className={`text-xs font-extrabold uppercase tracking-wider flex items-center space-x-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              <Globe className="w-4 h-4 text-[#1ed760]" />
              <span>Organization Identity & Tone</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Brand / Organization Name
                </label>
                <input
                  type="text"
                  value={profile.brand_name}
                  onChange={(e) => setProfile({ ...profile, brand_name: e.target.value })}
                  placeholder="e.g. Acme Enterprise"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition ${
                    isDarkMode ? 'bg-[#121212] border border-[#282828] text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Brand Communication Tone
                </label>
                <select
                  value={profile.brand_tone}
                  onChange={(e) => setProfile({ ...profile, brand_tone: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition ${
                    isDarkMode ? 'bg-[#121212] border border-[#282828] text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'
                  }`}
                >
                  {TONE_OPTIONS.map(tone => (
                    <option key={tone} value={tone}>{tone}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Hashtag Rules & Mandated Tags
              </label>
              <input
                type="text"
                value={profile.hashtag_rules}
                onChange={(e) => setProfile({ ...profile, hashtag_rules: e.target.value })}
                placeholder="e.g. #AcmeCorp #Innovation #QuantumReady"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition ${
                  isDarkMode ? 'bg-[#121212] border border-[#282828] text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Formatting Guidelines & Preferences
              </label>
              <textarea
                rows={2}
                value={profile.formatting_style}
                onChange={(e) => setProfile({ ...profile, formatting_style: e.target.value })}
                placeholder="e.g. Always use bullet points for key takeaways, bold key metrics..."
                className={`w-full p-3 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition resize-none ${
                  isDarkMode ? 'bg-[#121212] border border-[#282828] text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* Vocabulary & Forbidden Phrases */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Preferred Vocabulary */}
            <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'} space-y-3`}>
              <h3 className={`text-xs font-extrabold uppercase tracking-wider flex items-center space-x-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                <Tag className="w-4 h-4 text-[#1ed760]" />
                <span>Preferred Vocabulary</span>
              </h3>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={vocabInput}
                  onChange={(e) => setVocabInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVocabTag())}
                  placeholder="Add term (e.g. quantum-ready)"
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                    isDarkMode ? 'bg-[#121212] border border-[#282828] text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'
                  }`}
                />
                <button
                  onClick={addVocabTag}
                  className="px-3 py-1.5 rounded-lg bg-[#1ed760] text-black font-bold text-xs uppercase"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {profile.preferred_vocabulary.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30"
                  >
                    <span>{tag}</span>
                    <button onClick={() => removeVocabTag(tag)} className="hover:text-white">&times;</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Forbidden Phrases */}
            <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'} space-y-3`}>
              <h3 className={`text-xs font-extrabold uppercase tracking-wider flex items-center space-x-2 text-red-400`}>
                <Ban className="w-4 h-4 text-red-400" />
                <span>Forbidden Phrases (Scrubbed)</span>
              </h3>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={forbiddenInput}
                  onChange={(e) => setForbiddenInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addForbiddenTag())}
                  placeholder="Add phrase (e.g. game-changer)"
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    isDarkMode ? 'bg-[#121212] border border-[#282828] text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'
                  }`}
                />
                <button
                  onClick={addForbiddenTag}
                  className="px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold text-xs uppercase"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {profile.forbidden_phrases.map(phrase => (
                  <span
                    key={phrase}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30"
                  >
                    <span>{phrase}</span>
                    <button onClick={() => removeForbiddenTag(phrase)} className="hover:text-white">&times;</button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Legal Disclaimer & Assets */}
          <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'} space-y-4`}>
            <h2 className={`text-xs font-extrabold uppercase tracking-wider flex items-center space-x-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              <ShieldAlert className="w-4 h-4 text-[#1ed760]" />
              <span>Standard Legal Disclaimer & Assets</span>
            </h2>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Mandatory Disclaimer Footer
              </label>
              <textarea
                rows={3}
                value={profile.disclaimer}
                onChange={(e) => setProfile({ ...profile, disclaimer: e.target.value })}
                className={`w-full p-3 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition ${
                  isDarkMode ? 'bg-[#121212] border border-[#282828] text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Organization Logo URL
              </label>
              <input
                type="text"
                value={profile.logo_url || ''}
                onChange={(e) => setProfile({ ...profile, logo_url: e.target.value })}
                placeholder="https://..."
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition ${
                  isDarkMode ? 'bg-[#121212] border border-[#282828] text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Visual Palette & Live Output Card */}
        <div className="lg:col-span-4 space-y-6">
          {/* Brand Palette Colors */}
          <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-sm'} space-y-4`}>
            <h3 className={`text-xs font-extrabold uppercase tracking-wider flex items-center space-x-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              <Palette className="w-4 h-4 text-[#1ed760]" />
              <span>Brand Color Palette</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Primary Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={profile.primary_color}
                    onChange={(e) => setProfile({ ...profile, primary_color: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={profile.primary_color}
                    onChange={(e) => setProfile({ ...profile, primary_color: e.target.value })}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono ${
                      isDarkMode ? 'bg-[#121212] border border-[#282828] text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Secondary Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={profile.secondary_color}
                    onChange={(e) => setProfile({ ...profile, secondary_color: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={profile.secondary_color}
                    onChange={(e) => setProfile({ ...profile, secondary_color: e.target.value })}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono ${
                      isDarkMode ? 'bg-[#121212] border border-[#282828] text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Accent Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={profile.accent_color}
                    onChange={(e) => setProfile({ ...profile, accent_color: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={profile.accent_color}
                    onChange={(e) => setProfile({ ...profile, accent_color: e.target.value })}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono ${
                      isDarkMode ? 'bg-[#121212] border border-[#282828] text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Brand Preview Box */}
          <div className="p-5 rounded-2xl border bg-slate-900 text-white space-y-3 shadow-xl overflow-hidden relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#1ed760] flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                Live Brand Profile Preview
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{profile.brand_tone}</span>
            </div>

            <div className="p-4 rounded-xl space-y-2 border border-white/10" style={{ backgroundColor: profile.secondary_color || '#0f172a' }}>
              <div className="flex items-center space-x-2">
                {profile.logo_url ? (
                  <img src={profile.logo_url} alt="Logo" className="w-5 h-5 rounded object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-black" style={{ backgroundColor: profile.primary_color }}>
                    {profile.brand_name[0]}
                  </div>
                )}
                <span className="text-xs font-bold" style={{ color: profile.primary_color }}>
                  {profile.brand_name}
                </span>
              </div>

              <p className="text-xs text-slate-200 font-normal leading-relaxed">
                Deploying our zero-trust lattice-proof cryptography architecture across 12 enterprise data centers.
              </p>

              <div className="text-[11px] font-medium" style={{ color: profile.accent_color }}>
                {profile.hashtag_rules}
              </div>

              <p className="text-[9px] text-slate-400 border-t border-white/10 pt-2 leading-normal">
                {profile.disclaimer}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
