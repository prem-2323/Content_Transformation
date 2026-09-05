import React, { useState } from 'react';
import { Film, Sparkles, RefreshCw, Download, Layers } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { imageApi } from '../api/image';

export const SceneGenerator: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [scriptText, setScriptText] = useState('Scene 1: Introduction to AI.\nScene 2: Architecture and UCKR Engine.\nScene 3: Conclusion and Future Outlook.');
  const [newSceneTitle, setNewSceneTitle] = useState('');
  const [newScenePrompt, setNewScenePrompt] = useState('');
  const [newSceneNarration, setNewSceneNarration] = useState('');
  const [scenes, setScenes] = useState<any[]>([
    { id: '1', title: 'Scene 01', prompt: 'Cinematic intro shot of AI core processing', duration: '5s', narration: 'Welcome to the future of AI automation.', imageUrl: null },
    { id: '2', title: 'Scene 02', prompt: 'Data nodes connecting across global network', duration: '7s', narration: 'Our platform seamlessly transforms content.', imageUrl: null }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateScenes = async () => {
    setIsLoading(true);
    try {
      const res = await imageApi.generateSceneImages({ script: scriptText });
      if (res.scenes) {
        setScenes(res.scenes);
      }
    } catch (e: any) {
      console.error(e);
      // Fallback manual generation from script
      const lines = scriptText.split('\n').filter(l => l.trim().length > 0);
      const generated = lines.map((l, i) => ({
        id: Date.now() + i,
        title: `Scene 0${i + 1}`,
        prompt: l,
        duration: '6s',
        narration: `Narration for ${l}`,
        imageUrl: null
      }));
      if (generated.length > 0) setScenes(generated);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCustomScene = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenePrompt.trim()) return;
    const custom = {
      id: Date.now().toString(),
      title: newSceneTitle.trim() || `Scene 0${scenes.length + 1}`,
      prompt: newScenePrompt,
      duration: '5s',
      narration: newSceneNarration || 'Custom scene narration track.',
      imageUrl: null
    };
    setScenes([custom, ...scenes]);
    setNewSceneTitle('');
    setNewScenePrompt('');
    setNewSceneNarration('');
  };

  return (
    <div className={`max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Scene Generator Storyboard</h2>
        <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
          Generate AI storyboard frames and prompts via <code className="text-[#1ed760]">POST /generate-scene-images</code>.
        </p>
      </div>

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
            <label className="block text-[11px] font-semibold mb-1 text-slate-400 uppercase tracking-wider">Script & Scene Outline</label>
            <textarea
              rows={4}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Enter scene script description..."
              className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] resize-none ${
                isDarkMode ? 'bg-[#181818] border-[#282828] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>
          <button
            onClick={handleGenerateScenes}
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Generate Storyboard Scenes</span>
          </button>
        </div>

        {/* Create Individual Scene */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <Film className="w-4 h-4 text-[#1ed760]" />
            <span>Create New Custom Scene</span>
          </h3>
          <form onSubmit={handleCreateCustomScene} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold mb-1 text-slate-400 uppercase tracking-wider">Scene Title</label>
                <input
                  type="text"
                  value={newSceneTitle}
                  onChange={(e) => setNewSceneTitle(e.target.value)}
                  placeholder="e.g. Scene 03"
                  className={`w-full px-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                    isDarkMode ? 'bg-[#181818] border-[#282828] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1 text-slate-400 uppercase tracking-wider">Narration</label>
                <input
                  type="text"
                  value={newSceneNarration}
                  onChange={(e) => setNewSceneNarration(e.target.value)}
                  placeholder="Narration text..."
                  className={`w-full px-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                    isDarkMode ? 'bg-[#181818] border-[#282828] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1 text-slate-400 uppercase tracking-wider">Visual Prompt</label>
              <input
                type="text"
                value={newScenePrompt}
                onChange={(e) => setNewScenePrompt(e.target.value)}
                placeholder="Describe visual cinematic shot..."
                className={`w-full px-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                  isDarkMode ? 'bg-[#181818] border-[#282828] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
            <button
              type="submit"
              className={`w-full py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                isDarkMode ? 'bg-[#181818] border-white/20 hover:bg-[#282828] text-white' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-900'
              }`}
            >
              + Create & Add Scene
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenes.map((scene, idx) => (
          <div key={scene.id || idx} className={`rounded-2xl border p-5 shadow-xl space-y-4 flex flex-col justify-between ${
            isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
          }`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1ed760] uppercase tracking-wider">{scene.title || `Scene 0${idx + 1}`}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/10">{scene.duration || '5s'}</span>
              </div>

              <div className={`aspect-video rounded-xl border flex items-center justify-center overflow-hidden ${
                isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-100 border-slate-200'
              }`}>
                {scene.imageUrl ? (
                  <img src={scene.imageUrl} alt="Scene" className="w-full h-full object-cover" />
                ) : (
                  <Film className="w-8 h-8 text-slate-500 opacity-40" />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Prompt</p>
                <p className="text-xs italic">{scene.prompt}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Narration</p>
                <p className="text-xs">{scene.narration}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between">
              <button className="text-[11px] font-bold text-[#1ed760] hover:underline">Regenerate</button>
              <button className="text-[11px] text-slate-400 hover:text-white">View Details</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
