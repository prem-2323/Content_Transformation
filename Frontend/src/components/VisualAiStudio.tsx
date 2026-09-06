import React, { useState } from 'react';
import { Sparkles, Image as ImageIcon, ShieldCheck, RefreshCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { visualApi } from '../api/visual';

export const VisualAiStudio: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [task, setTask] = useState<'description' | 'ocr' | 'objects' | 'summary' | 'caption' | 'qa' | 'chart' | 'scene'>('description');
  const [prompt, setPrompt] = useState('Analyze this image');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setAnalysisResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      // Backend expects: image (File), task, prompt — see visual/routes.py
      const res = await visualApi.analyzeImage(file, task, prompt);
      // Backend returns { status, message, result: { description, objects, visible_text, important_details } }
      setAnalysisResult(res?.result ?? res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Visual AI Studio (Gemma Intelligence)</h2>
        <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
          Upload images to perform advanced visual understanding, OCR, entity detection, and scene description.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upload & Preview */}
        <div className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
            isDarkMode ? 'border-white/20 bg-[#121212]' : 'border-slate-300 bg-slate-50'
          }`}>
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="visual-upload" />
            <label htmlFor="visual-upload" className="cursor-pointer space-y-2 block">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-xl object-contain shadow" />
              ) : (
                <>
                  <ImageIcon className="w-10 h-10 mx-auto text-[#1ed760]" />
                  <p className="text-xs font-bold">Click to browse or drop image here</p>
                </>
              )}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs space-y-1 block">
              <span className="font-bold uppercase text-[10px] opacity-70">Task</span>
              <select
                value={task}
                onChange={(e) => setTask(e.target.value as any)}
                className="w-full rounded-lg border px-2 py-2 text-xs bg-transparent"
              >
                <option value="description">description</option>
                <option value="ocr">ocr</option>
                <option value="objects">objects</option>
                <option value="summary">summary</option>
                <option value="caption">caption - detailed caption</option>
                <option value="qa">qa - visual Q&A</option>
                <option value="chart">chart - chart/document parse</option>
                <option value="scene">scene - scene + sentiment</option>
              </select>
            </label>
            <label className="text-xs space-y-1 block col-span-2">
              <span className="font-bold uppercase text-[10px] opacity-70">Prompt (optional)</span>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Analyze this image"
                className="w-full rounded-lg border px-2 py-2 text-xs bg-transparent"
              />
            </label>
          </div>

          {error && (
            <p className="text-xs text-red-500 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!file || isLoading}
            className="w-full py-3 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Analyze Image with Gemma</span>
          </button>
        </div>

        {/* Results Cards */}
        <div className={`rounded-2xl border p-6 shadow-xl space-y-4 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          <h3 className="font-bold text-sm">Visual Analysis Result</h3>
          {error && !analysisResult && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          {analysisResult ? (
            <div className="space-y-4 text-xs">
              <div className={`p-3 rounded-xl border space-y-1 ${isDarkMode ? 'bg-[#121212] border-white/10 text-gray-100' : 'bg-slate-900 border-slate-900 text-slate-100'}`}>
                <span className="text-[10px] font-bold text-[#1ed760] uppercase">Visual Description</span>
                <p className="leading-relaxed text-slate-100">{analysisResult.description || analysisResult.summary || JSON.stringify(analysisResult)}</p>
              </div>

              {Array.isArray(analysisResult.objects) && analysisResult.objects.length > 0 && (
                <div className={`p-3 rounded-xl border space-y-1 ${isDarkMode ? 'bg-[#121212] border-white/10 text-gray-100' : 'bg-slate-900 border-slate-900 text-slate-100'}`}>
                  <span className="text-[10px] font-bold text-[#1ed760] uppercase">Detected Objects</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {analysisResult.objects.map((obj: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-white/15 text-white text-[11px]">{obj}</span>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(analysisResult.visible_text) && analysisResult.visible_text.length > 0 && (
                <div className={`p-3 rounded-xl border space-y-1 ${isDarkMode ? 'bg-[#121212] border-white/10 text-gray-100' : 'bg-slate-900 border-slate-900 text-slate-100'}`}>
                  <span className="text-[10px] font-bold text-[#1ed760] uppercase">OCR / Extracted Text</span>
                  <p className="font-mono text-[11px] text-slate-100 whitespace-pre-wrap">{analysisResult.visible_text.join('\n')}</p>
                </div>
              )}

              {Array.isArray(analysisResult.important_details) && analysisResult.important_details.length > 0 && (
                <div className={`p-3 rounded-xl border space-y-1 ${isDarkMode ? 'bg-[#121212] border-white/10 text-gray-100' : 'bg-slate-900 border-slate-900 text-slate-100'}`}>
                  <span className="text-[10px] font-bold text-[#1ed760] uppercase">Important Details</span>
                  <ul className="list-disc ml-4 space-y-1 text-slate-100">
                    {analysisResult.important_details.map((d: string, i: number) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 space-y-2">
              <ShieldCheck className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-xs">Upload an image and click analyze to view structured Gemma insights.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
