import React, { useState } from 'react';
import { Video, Sparkles, RefreshCw, Layers, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { videoApi } from '../api/video';

export const VideoPlanner: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [content, setContent] = useState('Explain quantum computing and enterprise AI transformation.');
  const [planResult, setPlanResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      // Backend POST /video/plan expects { text, ... }, not { content }
      const res = await videoApi.planVideo({ text: content });
      setPlanResult(res);
    } catch (e: any) {
      setError(e.message);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Video Planner & Storyboard Studio</h2>
        <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
          Plan video structure, duration, style, and scenes via <code className="text-[#1ed760]">POST /video/plan</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <form onSubmit={handlePlan} className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-2">
            <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Source Content / Topic</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Generate Video Storyboard Plan</span>
          </button>
        </form>

        <div className={`rounded-2xl border p-6 shadow-xl space-y-4 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          <h3 className="font-bold text-sm">Video Overview & Storyboard</h3>
          {planResult ? (
            <div className="space-y-4 text-xs">
              <div className={`p-4 rounded-xl border space-y-2 ${isDarkMode ? 'bg-[#121212] border-white/10 text-gray-100' : 'bg-slate-900 border-slate-900 text-slate-100'}`}>
                <p className="font-bold text-sm text-[#1ed760]">{planResult.title || 'Enterprise AI Video'}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <p>Target: <span className="font-bold text-white">{planResult.target_duration ?? '?'}s</span></p>
                  <p>Scenes: <span className="font-bold text-white">{planResult.num_scenes ?? planResult.scenes?.length ?? '?'}</span></p>
                  <p>Total: <span className="font-bold text-white">{planResult.total_calculated_duration ?? planResult.duration ?? '?'}s</span></p>
                  <p>Pacing: <span className="font-bold text-white">{planResult.pacing ?? 'balanced'}</span></p>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Scenes Breakdown</span>
                {(planResult.scenes || []).map((scene: any, idx: number) => (
                  <div key={idx} className={`p-3 rounded-xl border space-y-1 ${isDarkMode ? 'bg-[#121212] border-white/10 text-gray-100' : 'bg-slate-900 border-slate-900 text-slate-100'}`}>
                    <div className="flex justify-between font-bold">
                      <span>Scene {scene.scene_number ?? idx + 1}</span>
                      <span className="text-[#1ed760]">{scene.duration}s</span>
                    </div>
                    <p className="text-[11px] italic opacity-90">{scene.visual_prompt || scene.prompt}</p>
                    {scene.narration && <p className="text-[11px] opacity-80">🎙 {scene.narration}</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 space-y-2">
              <Video className="w-12 h-12 mx-auto opacity-40" />
              <p className="text-xs">Submit source content to generate video storyboard plan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
