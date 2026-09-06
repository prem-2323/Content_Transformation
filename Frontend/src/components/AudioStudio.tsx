import React, { useState, useEffect } from 'react';
import { Volume2, Sparkles, RefreshCw, Download, Play, Video, FileAudio, Check, Copy, Mic } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { audioApi, VoiceItem } from '../api/audio';

export const AudioStudio: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [activeMode, setActiveMode] = useState<'tts' | 'video_audio'>('tts');
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('en-US-AriaNeural');
  
  // State for TTS Mode
  const [text, setText] = useState('Welcome to the AI Content Transformation Platform. Harness cutting-edge multi-channel generative models and neural audio synthesis.');
  
  // State for Video Audio Mode
  const [videoScript, setVideoScript] = useState(JSON.stringify({
    video_title: "AI Healthcare Transformation",
    duration: "30 seconds",
    storyboard: [
      {
        scene: 1,
        narration: "Welcome to the future of healthcare. Artificial intelligence is enabling doctors to detect critical conditions early."
      },
      {
        scene: 2,
        narration: "Advanced deep learning algorithms analyze medical imagery with speed and precision."
      },
      {
        scene: 3,
        narration: "Empowering medical professionals worldwide for better patient outcomes."
      }
    ]
  }, null, 2));

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMeta, setAudioMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    audioApi.getVoices()
      .then((data) => {
        setVoices(data);
        if (data.length > 0) {
          // Default to Aria or first available voice
          const defaultV = data.find(v => v.id === 'en-US-AriaNeural') || data[0];
          setSelectedVoice(defaultV.id);
        }
      })
      .catch(() => {
        setVoices([
          { id: 'en-US-AriaNeural', name: 'English (US) - Female (Aria) (en-US-AriaNeural)' },
          { id: 'en-IN-NeerjaNeural', name: 'English (India) - Female (Neerja) (en-IN-NeerjaNeural)' },
          { id: 'hi-IN-SwaraNeural', name: 'Hindi (India) - Female (Swara) (hi-IN-SwaraNeural)' },
          { id: 'ta-IN-PallaviNeural', name: 'Tamil (India) - Female (Pallavi) (ta-IN-PallaviNeural)' },
        ]);
      });
  }, []);

  const handleGenerateTTS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.strip ? !text.trim() : false) return;
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    try {
      const res = await audioApi.generateAudio({ text: text.trim(), voice: selectedVoice, translate_to_voice_language: true });
      setAudioMeta(res);
      const url = audioApi.getAudioUrl(res.filename || res.url || '');
      setAudioUrl(url);
    } catch (err: any) {
      console.error('TTS Generation failed:', err);
      setError(err?.response?.data?.detail || err.message || 'Audio synthesis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateVideoAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoScript.trim()) return;
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    let scriptPayload: any = videoScript;
    try {
      scriptPayload = JSON.parse(videoScript);
    } catch {
      scriptPayload = videoScript;
    }

    try {
      const res = await audioApi.generateVideoAudio({
        video_script: scriptPayload,
        voice: selectedVoice,
        translate_to_voice_language: true
      });
      setAudioMeta(res);
      const url = audioApi.getAudioUrl(res.filename || res.url || '');
      setAudioUrl(url);
    } catch (err: any) {
      console.error('Video Audio Generation failed:', err);
      setError(err?.response?.data?.detail || err.message || 'Video narration synthesis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSampleTTS = () => {
    setText("Artificial intelligence and automated content transformation are reshaping how digital media is produced, localized, and rendered.");
  };

  const loadSampleVideoScript = () => {
    setVideoScript(JSON.stringify({
      video_title: "Quantum Computing Breakdown",
      storyboard: [
        {
          scene: 1,
          narration: "Quantum computing operates on qubits, enabling simultaneous calculation states."
        },
        {
          scene: 2,
          narration: "This exponential processing power revolutionizes cryptography, drug discovery, and artificial intelligence."
        }
      ]
    }, null, 2));
  };

  const handleCopyUrl = () => {
    if (!audioUrl) return;
    navigator.clipboard.writeText(audioUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      {/* Header Banner */}
      <div className={`pb-6 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Mic className="w-6 h-6 text-[#1ed760]" />
              <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Audio & Neural Voice Studio
              </h2>
            </div>
            <p className={`text-xs mt-1.5 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
              Synthesize natural neural voiceovers for single text passages or full multi-scene video pipeline scripts.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold bg-[#1ed760]/10 text-[#1ed760] border border-[#1ed760]/30">
              GET /audio-voices
            </span>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              POST /generate-audio
            </span>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
              POST /generate-video-audio
            </span>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="mt-6 flex border-b border-white/10 space-x-4">
          <button
            onClick={() => setActiveMode('tts')}
            className={`pb-2 text-xs font-semibold flex items-center space-x-2 transition border-b-2 cursor-pointer ${
              activeMode === 'tts'
                ? 'border-[#1ed760] text-[#1ed760]'
                : `${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} border-transparent`
            }`}
          >
            <FileAudio className="w-4 h-4" />
            <span>Single Text Speech (POST /generate-audio)</span>
          </button>

          <button
            onClick={() => setActiveMode('video_audio')}
            className={`pb-2 text-xs font-semibold flex items-center space-x-2 transition border-b-2 cursor-pointer ${
              activeMode === 'video_audio'
                ? 'border-[#1ed760] text-[#1ed760]'
                : `${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} border-transparent`
            }`}
          >
            <Video className="w-4 h-4 text-purple-400" />
            <span>Video Script Narration (POST /generate-video-audio)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Input Form + Audio Output Player */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Form Panel */}
        <div className="lg:col-span-7">
          <form
            onSubmit={activeMode === 'tts' ? handleGenerateTTS : handleGenerateVideoAudio}
            className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}
          >
            {/* Voice Model Selector */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                  Neural Voice Model
                </label>
                <span className="text-[10px] text-slate-400">Edge TTS Engine</span>
              </div>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                  isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                {voices.map((v: VoiceItem) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Input Content Area based on Active Mode */}
            {activeMode === 'tts' ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                    Text to Synthesize
                  </label>
                  <button
                    type="button"
                    onClick={loadSampleTTS}
                    className="text-[10px] text-[#1ed760] hover:underline cursor-pointer"
                  >
                    Load Sample Text
                  </button>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder="Type or paste narration text here..."
                  className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] font-sans ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                    Video Script Storyboard (JSON or Structured Text)
                  </label>
                  <button
                    type="button"
                    onClick={loadSampleVideoScript}
                    className="text-[10px] text-purple-400 hover:underline cursor-pointer"
                  >
                    Load Sample Script
                  </button>
                </div>
                <textarea
                  value={videoScript}
                  onChange={(e) => setVideoScript(e.target.value)}
                  rows={8}
                  placeholder="Paste video script JSON with storyboard scenes..."
                  className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-emerald-400' : 'bg-slate-50 border-slate-300 text-emerald-800'
                  }`}
                />
                <p className="text-[10px] text-slate-400">
                  <code className="text-purple-400">POST /generate-video-audio</code> automatically parses scene narrations from your storyboard and generates a full cohesive MP3 track for your video.
                </p>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 rounded-xl p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 ${
                activeMode === 'tts'
                  ? 'bg-[#1ed760] hover:bg-[#1db954] text-black'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>
                {isLoading
                  ? 'Synthesizing Audio MP3...'
                  : activeMode === 'tts'
                  ? 'Generate Audio MP3 (POST /generate-audio)'
                  : 'Generate Video Narration Track (POST /generate-video-audio)'}
              </span>
            </button>
          </form>
        </div>

        {/* Audio Result & Player Output Panel */}
        <div className="lg:col-span-5 flex flex-col">
          <div className={`rounded-2xl border p-6 shadow-xl h-full flex flex-col justify-between ${
            isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
          }`}>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-[#1ed760]" />
                  <span>Synthesized Audio Track</span>
                </span>
                {audioMeta && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
                    {audioMeta.status || 'success'}
                  </span>
                )}
              </div>

              {audioUrl ? (
                <div className="space-y-6 pt-2">
                  {/* Waveform Visualizer simulation */}
                  <div className={`p-4 rounded-xl border flex flex-col items-center justify-center space-y-3 ${
                    isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center space-x-1 h-12">
                      <span className="w-1.5 bg-[#1ed760] h-6 rounded-full animate-pulse" />
                      <span className="w-1.5 bg-[#1ed760] h-10 rounded-full animate-pulse delay-75" />
                      <span className="w-1.5 bg-[#1ed760] h-4 rounded-full animate-pulse delay-150" />
                      <span className="w-1.5 bg-[#1ed760] h-12 rounded-full animate-pulse delay-100" />
                      <span className="w-1.5 bg-[#1ed760] h-7 rounded-full animate-pulse delay-200" />
                      <span className="w-1.5 bg-[#1ed760] h-10 rounded-full animate-pulse delay-300" />
                      <span className="w-1.5 bg-[#1ed760] h-5 rounded-full animate-pulse delay-75" />
                    </div>
                    
                    <audio controls src={audioUrl} className="w-full" autoPlay />
                  </div>

                  {/* Audio File Metadata */}
                  {audioMeta && (
                    <div className={`p-4 rounded-xl border space-y-2 text-xs ${
                      isDarkMode ? 'bg-[#121212] border-white/10 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Filename:</span>
                        <span className="font-mono text-emerald-400 truncate max-w-[200px]">
                          {audioMeta.filename}
                        </span>
                      </div>
                      {audioMeta.translated && (
                        <div className="border-t border-white/10 pt-2 space-y-1">
                          <span className="text-slate-400 block">Spoken text (translated to voice language):</span>
                          <p className="text-emerald-400 whitespace-pre-wrap leading-relaxed">{audioMeta.spoken_text}</p>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-400">Voice Model:</span>
                        <span className="font-mono text-purple-400">
                          {audioMeta.voice || selectedVoice}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Endpoint:</span>
                        <span className="font-mono text-[#1ed760]">
                          {activeMode === 'tts' ? '/generate-audio' : '/generate-video-audio'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <a
                      href={audioUrl}
                      download={audioMeta?.filename || "generated_audio.mp3"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-[#1ed760] text-black font-bold text-xs shadow-md hover:bg-[#1db954] transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download MP3</span>
                    </a>

                    <button
                      onClick={handleCopyUrl}
                      className={`inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        isDarkMode ? 'border-white/10 hover:bg-white/5 text-white' : 'border-slate-300 hover:bg-slate-100 text-slate-900'
                      }`}
                    >
                      {copied ? <Check className="w-4 h-4 text-[#1ed760]" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied URL!' : 'Copy Audio URL'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-24 text-slate-400 space-y-3 my-auto">
                  <div className="w-16 h-16 mx-auto rounded-full bg-[#1ed760]/10 flex items-center justify-center text-[#1ed760]">
                    <Volume2 className="w-8 h-8 opacity-60" />
                  </div>
                  <p className="text-xs max-w-xs mx-auto">
                    Select a voice model and submit text or video script to generate a high-quality neural narration MP3.
                  </p>
                </div>
              )}
            </div>

            {/* Video Pipeline Info Footer */}
            <div className={`mt-6 pt-4 border-t text-[11px] flex items-center justify-between ${
              isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
            }`}>
              <span className="flex items-center space-x-1.5">
                <Video className="w-3.5 h-3.5 text-purple-400" />
                <span>Video Pipeline Sync Active</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400">FFmpeg + Edge TTS</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
