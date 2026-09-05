import React, { useState } from 'react';
import { Video, Sparkles, RefreshCw, Download, Play } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { videoApi } from '../api/video';

export const VideoStudio: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [script, setScript] = useState('Quantum computing overview video script with narration and subtitles.');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await videoApi.generateVideo({ script });
      if (res.filename) {
        setVideoUrl(videoApi.getVideoUrl(res.filename));
      } else if (res.url) {
        setVideoUrl(res.url);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Video Composition Studio</h2>
        <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
          Generate complete MP4 videos with FFmpeg composition, TTS narration, and subtitles via <code className="text-[#1ed760]">POST /video/generate-video</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <form onSubmit={handleGenerate} className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-2">
            <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Video Script & Narration</label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
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
            <span>Generate MP4 Video</span>
          </button>
        </form>

        <div className={`rounded-2xl border p-6 shadow-xl flex flex-col items-center justify-center ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          {videoUrl ? (
            <div className="space-y-4 text-center w-full">
              <video controls src={videoUrl} className="w-full max-h-72 rounded-xl shadow-lg bg-black" />
              <a
                href={videoUrl}
                download="composed-video.mp4"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#1ed760] text-black font-bold text-xs shadow-md hover:bg-[#1db954] transition"
              >
                <Download className="w-4 h-4" />
                <span>Download MP4 Video</span>
              </a>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 space-y-2">
              <Video className="w-12 h-12 mx-auto opacity-40" />
              <p className="text-xs">Composed video player will appear here upon completion.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
