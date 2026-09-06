import React, { useState, useEffect } from 'react';
import { Video, Sparkles, RefreshCw, Download, Volume2, Mic } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { videoApi } from '../api/video';
import { audioApi, VoiceItem } from '../api/audio';

export const VideoStudio: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [script, setScript] = useState('Quantum computing overview video script with narration and subtitles.');
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('en-US-AriaNeural');
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    audioApi.getVoices()
      .then((data) => {
        setVoices(data);
        if (data.length > 0) {
          const defaultV = data.find(v => v.id === 'en-US-AriaNeural') || data[0];
          setSelectedVoice(defaultV.id);
        }
      })
      .catch(() => {
        setVoices([
          { id: 'en-US-AriaNeural', name: 'English (US) - Female (Aria)' },
          { id: 'en-IN-NeerjaNeural', name: 'English (India) - Female (Neerja)' }
        ]);
      });
  }, []);

  const handlePreviewAudio = async () => {
    if (!script.trim()) return;
    setIsAudioLoading(true);
    setError(null);
    try {
      const res = await audioApi.generateVideoAudio({
        video_script: script,
        voice: selectedVoice
      });
      const url = audioApi.getAudioUrl(res.filename || res.url || '');
      setPreviewAudioUrl(url);
    } catch (e: any) {
      setError(e.message || 'Audio preview failed.');
      console.error(e);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    try {
      const res = await videoApi.generateVideo({
        text: script,
        voice: selectedVoice
      });
      setMeta(res);
      const filePath = (res as any).video_file ?? (res as any).filename ?? (res as any).url ?? '';
      if (filePath) {
        setVideoUrl(videoApi.getVideoUrl(filePath));
      }
    } catch (e: any) {
      setError(e.message || 'Video generation failed.');
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
          Generate complete MP4 videos with FFmpeg composition, Edge TTS audio narration, and subtitles via <code className="text-[#1ed760]">POST /video/generate-video</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <form onSubmit={handleGenerate} className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          {/* Neural Voice Selection */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                Narration Voice Model (Edge TTS)
              </label>
              <span className="text-[10px] text-[#1ed760] font-mono">GET /audio-voices</span>
            </div>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {voices.map((v: VoiceItem) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
              Video Script & Narration Content
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={6}
              className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          {/* Quick Preview Audio Section */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handlePreviewAudio}
              disabled={isAudioLoading}
              className="w-full py-2.5 px-4 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-semibold text-xs flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
            >
              {isAudioLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5 text-purple-400" />}
              <span>Preview Narration Track Only (POST /generate-video-audio)</span>
            </button>

            {previewAudioUrl && (
              <div className="mt-3 p-3 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-2">
                <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider block">Generated Narration Preview MP3</span>
                <audio controls src={previewAudioUrl} className="w-full h-8" autoPlay />
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Generate Full MP4 Video</span>
          </button>
        </form>

        <div className={`rounded-2xl border p-6 shadow-xl flex flex-col items-center justify-center ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          {videoUrl ? (
            <div className="space-y-4 text-center w-full">
              <video controls src={videoUrl} className="w-full max-h-72 rounded-xl shadow-lg bg-black" />
              {meta && (
                <p className={`text-[11px] ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                  {meta.scenes} scenes • {meta.duration}s • {String(meta.video_file).split(/[\\/]/).pop()}
                </p>
              )}
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
