import React, { useState, useEffect } from 'react';
import { Volume2, Sparkles, RefreshCw, Download, Play } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { audioApi } from '../api/audio';

export const AudioStudio: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [voices, setVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('en-US-AriaNeural');
  const [text, setText] = useState('Welcome to the AI Studio automated content transformation platform.');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    audioApi.getVoices().then(data => {
      if (Array.isArray(data)) setVoices(data);
      else if (data.voices) setVoices(data.voices);
    }).catch(e => {
      setVoices([{ id: 'en-US-AriaNeural', name: 'en-US-AriaNeural (Default)' }]);
    });
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await audioApi.generateAudio({ text, voice: selectedVoice });
      if (res.filename) {
        setAudioUrl(audioApi.getAudioUrl(res.filename));
      } else if (res.url) {
        setAudioUrl(res.url);
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
        <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Audio & Neural Voice Studio</h2>
        <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
          Generate natural voiceovers via <code className="text-[#1ed760]">GET /audio-voices</code> and <code className="text-[#1ed760]">POST /generate-audio</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <form onSubmit={handleGenerate} className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-2">
            <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Voice Model</label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className={`w-full p-3 rounded-xl text-xs border ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
            >
              {voices.map((v: any) => (
                <option key={v.id || v} value={v.id || v}>{v.name || v}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Text to Synthesize</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
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
            <span>Generate Audio MP3</span>
          </button>
        </form>

        <div className={`rounded-2xl border p-6 shadow-xl flex flex-col items-center justify-center ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          {audioUrl ? (
            <div className="space-y-4 text-center w-full">
              <audio controls src={audioUrl} className="w-full" />
              <a
                href={audioUrl}
                download="voiceover.mp3"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#1ed760] text-black font-bold text-xs shadow-md hover:bg-[#1db954] transition"
              >
                <Download className="w-4 h-4" />
                <span>Download MP3</span>
              </a>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 space-y-2">
              <Volume2 className="w-12 h-12 mx-auto opacity-40" />
              <p className="text-xs">Generated audio player will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
