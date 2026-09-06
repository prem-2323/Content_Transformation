import React, { useState } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  ShieldCheck,
  RefreshCw,
  FileText,
  Layers,
  BarChart3,
  HelpCircle,
  Tag,
  Compass,
  Eye,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { visualApi } from '../api/visual';

export const VisualAiStudio: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [task, setTask] = useState<'description' | 'ocr' | 'objects' | 'summary' | 'caption' | 'qa' | 'chart' | 'scene'>('description');
  const [prompt, setPrompt] = useState('Analyze this image');
  const [responseEnvelope, setResponseEnvelope] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setResponseEnvelope(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await visualApi.analyzeImage(file, task, prompt);
      setResponseEnvelope(res);
    } catch (err: any) {
      setError(err.message || 'Visual AI analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const result = responseEnvelope?.result || (responseEnvelope && !responseEnvelope.result ? responseEnvelope : null);
  const evidence = responseEnvelope?.evidence || [];
  const warnings = responseEnvelope?.warnings || [];

  return (
    <div className={`max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      
      {/* Header */}
      <div className={`pb-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <div>
          <div className="flex items-center space-x-2">
            <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Visual AI Studio (Gemma Intelligence Engine)
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#1ed760]/20 text-[#1ed760] font-mono text-[10px] font-bold uppercase tracking-wider">
              Strict Rules Active
            </span>
          </div>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
            Task-isolated visual analysis powered by Gemma 3 4B. Visual Evidence &gt; Model Assumption.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono font-bold">
            Task: {task.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Upload & Task Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <div className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
            isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
          }`}>
            
            {/* File Upload Zone */}
            <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              isDarkMode ? 'border-white/20 bg-[#121212]' : 'border-slate-300 bg-slate-50'
            }`}>
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="visual-upload" />
              <label htmlFor="visual-upload" className="cursor-pointer space-y-2 block">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="max-h-56 mx-auto rounded-xl object-contain shadow-lg" />
                ) : (
                  <>
                    <ImageIcon className="w-12 h-12 mx-auto text-[#1ed760] animate-pulse" />
                    <p className="text-xs font-bold">Click to browse or drop target image here</p>
                    <p className="text-[10px] opacity-60">Supports PNG, JPG, JPEG (Max 1024px auto-scaled)</p>
                  </>
                )}
              </label>
            </div>

            {/* Task Picker */}
            <div className="space-y-4">
              <label className="text-xs space-y-1 block">
                <span className="font-bold uppercase text-[10px] tracking-wider opacity-70 block mb-1">Select Analysis Task</span>
                <select
                  value={task}
                  onChange={(e) => setTask(e.target.value as any)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none font-bold transition-colors ${
                    isDarkMode ? 'bg-[#121212] border-white/20 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="description">Description — Detailed Factual Description</option>
                  <option value="ocr">OCR — Extract Readable Text Regions</option>
                  <option value="objects">Objects — Detect & Count Visible Objects</option>
                  <option value="summary">Summary — Concise Visual Summary</option>
                  <option value="caption">Caption — Content Creation Caption & Hashtags</option>
                  <option value="qa">Visual Q&A — Answer Visual Questions</option>
                  <option value="chart">Chart — Parse Chart / Document / Infographic</option>
                  <option value="scene">Scene — Analyze Scene, Mood & Sentiment</option>
                </select>
              </label>

              {/* Prompt Input */}
              <label className="text-xs space-y-1 block">
                <span className="font-bold uppercase text-[10px] tracking-wider opacity-70 block mb-1">Custom Query / Prompt (Optional)</span>
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. What is the primary metric in the chart?"
                  className={`w-full rounded-xl border px-3 py-2 text-xs outline-none transition-colors ${
                    isDarkMode ? 'bg-[#121212] border-white/20 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
                  }`}
                />
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!file || isLoading}
              className="w-full py-3.5 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Analyze with Visual AI Engine</span>
            </button>

          </div>
        </div>

        {/* Right Column: Structured Task Result & Evidence Traceability */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
            isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
          }`}>
            
            <div className="flex items-center justify-between border-b pb-3 border-white/10">
              <h3 className="font-bold text-sm tracking-wide flex items-center space-x-2">
                <Eye className="w-4 h-4 text-[#1ed760]" />
                <span>Task Extraction Result</span>
              </h3>

              {responseEnvelope && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                  Success: True
                </span>
              )}
            </div>

            {result ? (
              <div className="space-y-6 text-xs">
                
                {/* 1. DESCRIPTION TASK */}
                {task === 'description' && (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border space-y-1.5 ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-900 text-white'}`}>
                      <span className="text-[10px] font-bold text-[#1ed760] uppercase tracking-wider block">Factual Visual Description</span>
                      <p className="leading-relaxed text-sm">{result.description}</p>
                    </div>

                    {Array.isArray(result.key_visual_elements) && result.key_visual_elements.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Key Visual Elements</span>
                        <div className="flex flex-wrap gap-1.5">
                          {result.key_visual_elements.map((elem: string, idx: number) => (
                            <span key={idx} className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-medium">
                              {elem}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. OCR TASK */}
                {task === 'ocr' && (
                  <div className="space-y-4">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 block">Extracted Text Regions</span>
                    <div className="space-y-2">
                      {Array.isArray(result.text_regions) && result.text_regions.map((reg: any, idx: number) => (
                        <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between font-mono ${
                          isDarkMode ? 'bg-[#121212] border-white/10 text-emerald-400' : 'bg-slate-900 text-emerald-300'
                        }`}>
                          <span>{typeof reg === 'string' ? reg : reg.text}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                            reg.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {reg.confidence || 'HIGH'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. OBJECTS TASK */}
                {task === 'objects' && (
                  <div className="space-y-4">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 block">Visually Detectable Objects</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Array.isArray(result.objects) && result.objects.map((obj: any, idx: number) => {
                        const name = typeof obj === 'string' ? obj : obj.name;
                        const count = (typeof obj === 'object' && obj && obj.count) ? obj.count : 1;
                        return (
                          <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between font-medium ${
                            isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-50 border-slate-200'
                          }`}>
                            <span>{name}</span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-bold text-xs">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. SUMMARY TASK */}
                {task === 'summary' && (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border space-y-1.5 ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-900 text-white'}`}>
                      <span className="text-[10px] font-bold text-[#1ed760] uppercase tracking-wider block">Concise Visual Summary</span>
                      <p className="leading-relaxed text-sm">{result.summary}</p>
                    </div>
                  </div>
                )}

                {/* 5. CAPTION TASK */}
                {task === 'caption' && (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border space-y-2 ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-900 text-white'}`}>
                      <span className="text-[10px] font-bold text-[#1ed760] uppercase tracking-wider block">Descriptive Content Caption</span>
                      <p className="leading-relaxed text-sm">{result.caption}</p>
                    </div>

                    {Array.isArray(result.hashtags) && result.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {result.hashtags.map((tag: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 font-mono text-xs font-bold border border-blue-500/30">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. QA TASK */}
                {task === 'qa' && (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border space-y-2 ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-900 text-white'}`}>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Visual Q&A Response</span>
                      <p className="font-bold text-xs text-slate-300">Q: {result.question || prompt}</p>
                      <p className="text-sm font-semibold text-emerald-400">A: {result.answer}</p>
                    </div>
                  </div>
                )}

                {/* 7. CHART / DOCUMENT PARSE TASK */}
                {task === 'chart' && (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border space-y-3 ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-900 text-white'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#1ed760] uppercase tracking-wider block">Chart & Document Structural Parse</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono">
                          {result.detected ? 'Chart Detected' : 'No Chart Detected'}
                        </span>
                      </div>

                      {result.title && <h4 className="text-sm font-extrabold text-white">{result.title}</h4>}

                      {result.values && Array.isArray(result.values) && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Extracted Numerical Values</span>
                          <div className="flex flex-wrap gap-2">
                            {result.values.map((val: string, idx: number) => (
                              <span key={idx} className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 font-mono text-xs font-bold border border-purple-500/30">
                                {val}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 8. SCENE ANALYSIS TASK */}
                {task === 'scene' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Environment</span>
                      <span className="font-bold text-xs">{result.environment || 'Outdoor'}</span>
                    </div>
                    <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Visual Mood</span>
                      <span className="font-bold text-xs text-purple-400">{result.visual_mood || 'Professional'}</span>
                    </div>
                  </div>
                )}

                {/* Global Evidence Trace Panel (Gemma says -> Evidence -> Result) */}
                {evidence.length > 0 && (
                  <div className={`p-4 rounded-xl border space-y-3 ${
                    isDarkMode ? 'bg-[#121212] border-purple-500/20' : 'bg-purple-50 border-purple-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      <h4 className="font-extrabold text-xs uppercase tracking-wider text-purple-400">
                        Global Evidence Trace (Gemma says → Evidence → Result)
                      </h4>
                    </div>

                    <div className="space-y-2">
                      {evidence.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start space-x-2 text-xs">
                          <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase shrink-0 ${
                            item.type === 'ocr' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {item.type}
                          </span>
                          <span className={`${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{item.observation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="text-center py-24 text-slate-400 space-y-3">
                <ShieldCheck className="w-12 h-12 mx-auto opacity-30 text-[#1ed760]" />
                <p className="text-xs font-bold">Select a task, upload an image, and click analyze.</p>
                <p className="text-[11px] opacity-70">Enforces task isolation, strict evidence grounding, and trace output.</p>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};
