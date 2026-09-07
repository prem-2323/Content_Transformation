import React, { useState } from 'react';
import { Film, Sparkles, RefreshCw, Trash2, Volume2, Eye, X, CheckCircle, Clapperboard, PlusCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { imageApi } from '../api/image';
import { audioApi } from '../api/audio';

interface SceneItem {
  id: string;
  title: string;
  prompt: string;
  duration: string;
  narration: string;
  imageUrl: string | null;
  audioUrl?: string | null;
}

export const SceneGenerator: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [scriptText, setScriptText] = useState<string>('');
  const [newSceneTitle, setNewSceneTitle] = useState('');
  const [newScenePrompt, setNewScenePrompt] = useState('');
  const [newSceneNarration, setNewSceneNarration] = useState('');
  const [scenes, setScenes] = useState<SceneItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerateScenes = async () => {
    if (!scriptText.trim()) {
      setErrorMessage('Please enter a script or scene outline to generate storyboard scenes.');
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await imageApi.generateSceneImages({
        script: scriptText.trim(),
        mode: 'fast',
        steps: 10,
      });

      if (res && res.images && Array.isArray(res.images)) {
        const mapped: SceneItem[] = res.images.map((img: any, i: number) => ({
          id: img.filename || String(Date.now() + i),
          title: `Scene 0${i + 1}`,
          prompt: img.prompt || `Cinematic shot for Scene ${i + 1}`,
          duration: '5s',
          narration: `Voiceover narration for Scene ${i + 1}`,
          imageUrl: img.image_url ? img.image_url : (img.filename ? imageApi.getImageUrl(img.filename) : null),
        }));
        if (mapped.length > 0) {
          setScenes(mapped);
          setStatusMessage(`Successfully generated ${mapped.length} storyboard scene frames!`);
        }
      } else if (res && res.scenes && Array.isArray(res.scenes)) {
        setScenes(res.scenes);
        setStatusMessage(`Successfully generated ${res.scenes.length} storyboard scene frames!`);
      } else {
        // Decompose script into scenes
        const lines = scriptText.split('\n').filter((l) => l.trim().length > 0);
        const fallbackScenes: SceneItem[] = lines.map((l, i) => ({
          id: String(Date.now() + i),
          title: `Scene 0${i + 1}`,
          prompt: l,
          duration: '5s',
          narration: `Narration for ${l}`,
          imageUrl: null,
        }));
        if (fallbackScenes.length > 0) {
          setScenes(fallbackScenes);
          setStatusMessage(`Extracted ${fallbackScenes.length} scenes from script.`);
        }
      }
    } catch (e: any) {
      console.error('Storyboard generation error:', e);
      // Fallback manual decomposition from script lines
      const lines = scriptText.split('\n').filter((l) => l.trim().length > 0);
      const fallbackScenes: SceneItem[] = lines.map((l, i) => ({
        id: String(Date.now() + i),
        title: `Scene 0${i + 1}`,
        prompt: l,
        duration: '5s',
        narration: `Narration for ${l}`,
        imageUrl: null,
      }));
      if (fallbackScenes.length > 0) {
        setScenes(fallbackScenes);
        setStatusMessage('Created storyboard scenes from script outline.');
      } else {
        setErrorMessage('Failed to generate storyboard scenes. Please check script input.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateScene = async (sceneId: string, promptText: string) => {
    setRegeneratingId(sceneId);
    setErrorMessage(null);
    try {
      const res = await imageApi.generateImage({
        prompt: promptText || 'Cinematic shot for video storyboard',
        mode: 'fast',
        width: 768,
        height: 768,
        steps: 10,
      });
      if (res && res.filename) {
        const url = res.image_url || imageApi.getImageUrl(res.filename);
        setScenes((prev) =>
          prev.map((s) => (s.id === sceneId ? { ...s, imageUrl: url } : s))
        );
      }
    } catch (err: any) {
      console.error('Failed to regenerate scene image:', err);
      setErrorMessage(`Failed to render frame: ${err?.message || 'Error connecting to image engine'}`);
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleGenerateSceneAudio = async (sceneId: string, narrationText: string) => {
    if (!narrationText.trim()) return;
    setAudioLoadingId(sceneId);
    setErrorMessage(null);
    try {
      const res = await audioApi.generateAudio({
        text: narrationText,
        voice: 'en-US-AriaNeural',
      });
      if (res && (res.download_url || res.url)) {
        const audioUrl = res.url || res.download_url;
        setScenes((prev) =>
          prev.map((s) => (s.id === sceneId ? { ...s, audioUrl } : s))
        );
      }
    } catch (err: any) {
      console.error('Failed to generate narration audio:', err);
      setErrorMessage('Audio generation is temporarily unavailable.');
    } finally {
      setAudioLoadingId(null);
    }
  };

  const handleDeleteScene = (sceneId: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== sceneId));
  };

  const handleCreateCustomScene = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenePrompt.trim()) return;
    const custom: SceneItem = {
      id: Date.now().toString(),
      title: newSceneTitle.trim() || `Scene 0${scenes.length + 1}`,
      prompt: newScenePrompt.trim(),
      duration: '5s',
      narration: newSceneNarration.trim() || 'Custom scene narration track.',
      imageUrl: null,
    };
    setScenes([custom, ...scenes]);
    setNewSceneTitle('');
    setNewScenePrompt('');
    setNewSceneNarration('');
    setStatusMessage('Added new custom scene to storyboard.');
  };

  return (
    <div className={`max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Scene Generator & Storyboard
        </h2>
        <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
          Engineered video prompts and Stable Diffusion visual scene frames powered by <code className="text-[#1ed760]">POST /generate-scene-images</code>.
        </p>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-[#1ed760]/10 border border-[#1ed760]/30 text-[#1ed760] text-xs font-semibold flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center space-x-2">
          <X className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Input and Generator Panel */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 rounded-2xl border shadow-lg ${
        isDarkMode ? 'glass-card border-white/10' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="space-y-4">
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#1ed760]" />
            <span>Storyboard Script Prompt Input</span>
          </h3>
          <div>
            <label className="block text-[11px] font-semibold mb-1 text-slate-400 uppercase tracking-wider">
              Script & Scene Outline
            </label>
            <textarea
              rows={4}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Paste or write your video script / scene outline here... (e.g. Scene 1: Introduction to AI, Scene 2: Product architecture, Scene 3: Conclusion)"
              className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] resize-none ${
                isDarkMode ? 'bg-[#181818] border-[#282828] text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
          <button
            onClick={handleGenerateScenes}
            disabled={isLoading || !scriptText.trim()}
            className="w-full py-2.5 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isLoading ? 'Generating Storyboard...' : 'Generate Storyboard Scenes'}</span>
          </button>
        </div>

        {/* Create Individual Scene */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <Film className="w-4 h-4 text-[#1ed760]" />
            <span>Add Custom Scene</span>
          </h3>
          <form onSubmit={handleCreateCustomScene} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold mb-1 text-slate-400 uppercase tracking-wider">
                  Scene Title
                </label>
                <input
                  type="text"
                  value={newSceneTitle}
                  onChange={(e) => setNewSceneTitle(e.target.value)}
                  placeholder={`Scene 0${scenes.length + 1}`}
                  className={`w-full px-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                    isDarkMode ? 'bg-[#181818] border-[#282828] text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1 text-slate-400 uppercase tracking-wider">
                  Narration
                </label>
                <input
                  type="text"
                  value={newSceneNarration}
                  onChange={(e) => setNewSceneNarration(e.target.value)}
                  placeholder="Voiceover narration text..."
                  className={`w-full px-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                    isDarkMode ? 'bg-[#181818] border-[#282828] text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1 text-slate-400 uppercase tracking-wider">
                Visual Prompt
              </label>
              <input
                type="text"
                value={newScenePrompt}
                onChange={(e) => setNewScenePrompt(e.target.value)}
                placeholder="Describe cinematic visual shot (e.g. Futuristic holographic display)..."
                className={`w-full px-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                  isDarkMode ? 'bg-[#181818] border-[#282828] text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={!newScenePrompt.trim()}
              className={`w-full py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-40 ${
                isDarkMode ? 'bg-[#181818] border-white/20 hover:bg-[#282828] text-white' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-900'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Custom Scene</span>
            </button>
          </form>
        </div>
      </div>

      {/* Storyboard Grid / Empty State */}
      {scenes.length === 0 ? (
        <div className={`p-12 text-center rounded-2xl border border-dashed flex flex-col items-center justify-center space-y-3 ${
          isDarkMode ? 'border-[#333] bg-[#141414]' : 'border-slate-300 bg-slate-50'
        }`}>
          <div className="w-12 h-12 rounded-full bg-[#1ed760]/10 text-[#1ed760] flex items-center justify-center border border-[#1ed760]/30">
            <Clapperboard className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold">No Storyboard Scenes Generated Yet</h3>
          <p className={`text-xs max-w-md ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Enter a video script outline in the prompt box above and click <span className="text-[#1ed760] font-semibold">Generate Storyboard Scenes</span>, or add individual custom scenes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenes.map((scene, idx) => (
            <div
              key={scene.id || idx}
              className={`rounded-2xl border p-5 shadow-xl space-y-4 flex flex-col justify-between transition-all hover:border-[#1ed760]/40 ${
                isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1ed760] uppercase tracking-wider">
                    {scene.title || `Scene 0${idx + 1}`}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 font-mono">
                      {scene.duration || '5s'}
                    </span>
                    <button
                      onClick={() => handleDeleteScene(scene.id)}
                      title="Delete Scene"
                      className="text-slate-500 hover:text-red-400 p-1 rounded transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Scene Frame */}
                <div
                  className={`aspect-video rounded-xl border relative flex items-center justify-center overflow-hidden group ${
                    isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  {regeneratingId === scene.id ? (
                    <div className="flex flex-col items-center space-y-2 text-[#1ed760]">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                      <span className="text-[10px] font-bold">Rendering Frame...</span>
                    </div>
                  ) : scene.imageUrl ? (
                    <>
                      <img
                        src={scene.imageUrl}
                        alt={scene.title}
                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2">
                        <button
                          onClick={() => setPreviewImage(scene.imageUrl)}
                          className="p-2 rounded-full bg-black/70 text-white hover:text-[#1ed760] transition cursor-pointer"
                          title="View Full Frame"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center space-y-1 text-slate-500 opacity-60">
                      <Film className="w-8 h-8" />
                      <span className="text-[10px]">No image rendered</span>
                    </div>
                  )}
                </div>

                {/* Prompts & Narration */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visual Prompt</p>
                  <p className={`text-xs italic line-clamp-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {scene.prompt}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Narration</p>
                  <p className={`text-xs line-clamp-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {scene.narration}
                  </p>
                </div>

                {/* Audio player if generated */}
                {scene.audioUrl && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <audio controls src={scene.audioUrl} className="w-full h-8" />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleRegenerateScene(scene.id, scene.prompt)}
                  disabled={regeneratingId === scene.id}
                  className="text-[11px] font-bold text-[#1ed760] hover:text-[#1db954] flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${regeneratingId === scene.id ? 'animate-spin' : ''}`} />
                  <span>Render Frame</span>
                </button>

                <button
                  onClick={() => handleGenerateSceneAudio(scene.id, scene.narration)}
                  disabled={audioLoadingId === scene.id}
                  className="text-[11px] font-bold text-slate-300 hover:text-white flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  <Volume2 className={`w-3 h-3 ${audioLoadingId === scene.id ? 'animate-spin' : ''}`} />
                  <span>Voice Narration</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className={`max-w-4xl w-full rounded-2xl overflow-hidden border p-2 relative ${
              isDarkMode ? 'bg-[#181818] border-white/20' : 'bg-white border-slate-300'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/70 text-white hover:text-red-400 transition z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Storyboard Scene Preview"
              className="w-full h-auto rounded-xl max-h-[80vh] object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};
