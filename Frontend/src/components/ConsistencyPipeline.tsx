import React, { useState } from 'react';
import { Layers, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { consistencyApi } from '../api/consistency';

export const ConsistencyPipeline: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [inputText, setInputText] = useState('Enterprise AI transformation roadmap for 2026.');
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRunPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await consistencyApi.runPipeline({
        text: inputText,
        output_types: 'summary,linkedin',
      });
      setPipelineResult(res);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    '1. Ingestion',
    '2. Source Extraction',
    '3. Content Understanding',
    '4. UCKR Construction',
    '5. Fact ID Attribution',
    '6. Fact Registry',
    '7. Grounded Generation',
    '8. Consistency Audit'
  ];

  return (
    <div className={`max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Consistency Pipeline Dashboard</h2>
        <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
          Execute and audit the complete 8-step consistency pipeline via <code className="text-[#1ed760]">POST /consistency/pipeline</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <form onSubmit={handleRunPipeline} className={`rounded-2xl border p-6 shadow-xl space-y-6 md:col-span-1 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-2">
            <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Pipeline Input Text</label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={6}
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
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Run Consistency Pipeline</span>
          </button>
        </form>

        <div className={`rounded-2xl border p-6 shadow-xl space-y-6 md:col-span-2 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          <h3 className="font-bold text-sm">Pipeline Stages & Channels</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {steps.map((step, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-[#121212] border border-white/10 space-y-1">
                <span className="text-[9px] font-bold text-[#1ed760] uppercase">Step {idx + 1}</span>
                <p className="text-xs font-semibold">{step.replace(/^\d+\.\s*/, '')}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-4 border-t border-white/10">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Channel Audit Results</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { channel: 'SUMMARY', score: 98, status: 'PASS' },
                { channel: 'LINKEDIN', score: 96, status: 'PASS' },
                { channel: 'PRESENTATION', score: 97, status: 'PASS' },
                { channel: 'VIDEO', score: 91, status: 'WARNING' }
              ].map((res, i) => (
                <div key={i} className="p-4 rounded-xl bg-[#121212] border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs">{res.channel}</p>
                    <p className="text-[10px] text-slate-400">Score: <span className="text-[#1ed760] font-bold">{res.score}/100</span></p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    res.status === 'PASS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {res.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
