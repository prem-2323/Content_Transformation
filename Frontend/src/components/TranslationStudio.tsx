import React, { useState, useEffect } from 'react';
import { Languages, Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { consistencyApi } from '../api/consistency';

export const TranslationStudio: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [languages, setLanguages] = useState<string[]>(['English', 'Hindi', 'Spanish', 'French', 'German', 'Japanese']);
  const [targetLang, setTargetLang] = useState('Hindi');
  const [sourceText, setSourceText] = useState('Artificial intelligence is transforming global enterprise productivity.');
  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    consistencyApi.getLanguages().then(data => {
      setLanguages(data);
    }).catch(() => {});
  }, []);

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const pipeline = await consistencyApi.runPipeline({
        text: sourceText,
        output_types: 'summary,linkedin',
      });
      const res = await consistencyApi.translateContent({
        target_language: targetLang,
        uckr: pipeline.uckr,
        outputs: pipeline.outputs,
      });
      const translatedOutputs = res.translated_outputs;
      setTranslatedText(
        translatedOutputs && typeof translatedOutputs === 'object'
          ? Object.entries(translatedOutputs)
              .map(([key, value]) => `${key}\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`)
              .join('\n\n')
          : res.translated_text || res.result || JSON.stringify(res)
      );
    } catch (e: any) {
      setTranslatedText(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Translation Studio</h2>
        <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
          Translate grounded deliverables via <code className="text-[#1ed760]">GET /consistency/languages</code> and <code className="text-[#1ed760]">POST /consistency/translate</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <form onSubmit={handleTranslate} className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-2">
            <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Target Language</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className={`w-full p-3 rounded-xl text-xs border ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
            >
              {languages.map((l: string) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Source Text</label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={5}
              className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
            <span>Translate Content</span>
          </button>
        </form>

        <div className={`rounded-2xl border p-6 shadow-xl space-y-4 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          <h3 className="font-bold text-sm">Translated Output</h3>
          <div className={`w-full h-64 p-4 rounded-xl border font-sans text-xs overflow-y-auto ${
            isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
          }`}>
            {translatedText || '// Translated text will appear here...'}
          </div>
        </div>
      </div>
    </div>
  );
};
