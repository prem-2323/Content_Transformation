import React, { useState } from 'react';
import { Video, Sparkles, RefreshCw, Layers, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { videoApi } from '../api/video';

export const VideoPlanner: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [content, setContent] = useState('Explain quantum computing and enterprise AI transformation.');
  const [planResult, setPlanResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await videoApi.planVideo({ content });
      setPlanResult(res);
    } catch (e: any) {
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
              <div className="p-4 rounded-xl bg-[#121212] border border-white/10 space-y-2">
                <p className="font-bold text-sm text-[#1ed760]">{planResult.title || 'Enterprise AI Video'}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <p>Duration: <span className="font-bold text-white">{planResult.duration || '60s'}</span></p>
                  <p>Aspect Ratio: <span className="font-bold text-white">{planResult.aspect_ratio || '16:9'}</span></p>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Scenes Breakdown</span>
                {(planResult.scenes || [
                  { title: 'Scene 1', prompt: 'Cinematic opening', duration: '10s' },
                  { title: 'Scene 2', prompt: 'Core explanation', duration: '30s' }
                ]).map((scene: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#121212] border border-white/10 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>{scene.title || `Scene ${idx + 1}`}</span>
                      <span className="text-[#1ed760]">{scene.duration}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 italic">{scene.prompt || scene.visual_prompt}</p>
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
