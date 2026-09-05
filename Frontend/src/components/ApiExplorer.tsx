import React, { useState } from 'react';
import { Terminal, Send, CheckCircle2, Code, FileCode, Play, Search, Copy, Check, RefreshCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api/client';

export const ApiExplorer: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  
  const endpoints = [
    // TEXT TRANSFORMATION
    { category: 'TEXT TRANSFORMATION', method: 'POST', path: '/transform', desc: 'Transform direct text input into selected output formats', defaultPayload: { text: "AI is transforming enterprise productivity.", output_types: ["Summary", "LinkedIn"], audience: "Professionals", tone: "Formal", language: "English", detail_level: "Medium", objective: "Inform" } },
    { category: 'TEXT TRANSFORMATION', method: 'POST', path: '/transform-file', desc: 'Transform uploaded document file content', defaultPayload: { audience: "Professionals", tone: "Formal", language: "English" } },
    
    // MULTIMODAL
    { category: 'MULTIMODAL', method: 'POST', path: '/multimodal/transform-pdf', desc: 'Upload PDF for multi-model PDF transformation pipeline', defaultPayload: { audience: "Professionals", tone: "Analytical" } },
    { category: 'MULTIMODAL', method: 'GET', path: '/multimodal/status/{job_id}', desc: 'Poll status of long-running PDF transformation job', defaultPayload: {} },

    // VISUAL AI
    { category: 'VISUAL AI', method: 'POST', path: '/visual/analyze', desc: 'Analyze uploaded image using Gemma visual intelligence', defaultPayload: {} },

    // IMAGE GENERATION
    { category: 'IMAGE GENERATION', method: 'POST', path: '/generate-image', desc: 'Generate high-res image from prompt', defaultPayload: { prompt: "Futuristic sustainable smart city at sunset", width: 1024, height: 1024, steps: 30 } },
    { category: 'IMAGE GENERATION', method: 'POST', path: '/generate-scene-images', desc: 'Generate storyboard scene images', defaultPayload: { scenes: [{ prompt: "Scene 1 overview" }] } },
    { category: 'IMAGE GENERATION', method: 'POST', path: '/generate-scene-images-from-file', desc: 'Generate scene images from script file', defaultPayload: {} },
    { category: 'IMAGE GENERATION', method: 'GET', path: '/image/{filename}', desc: 'Serve generated image file', defaultPayload: {} },

    // VIDEO
    { category: 'VIDEO', method: 'POST', path: '/video/plan', desc: 'Plan video storyboard and scene breakdown', defaultPayload: { content: "Explain quantum computing in simple terms." } },
    { category: 'VIDEO', method: 'POST', path: '/video/generate-video', desc: 'Generate complete MP4 video with narration and subtitles', defaultPayload: { script: "Quantum computing video script" } },
    { category: 'VIDEO', method: 'GET', path: '/video/{filename}', desc: 'Serve generated MP4 video file', defaultPayload: {} },

    // AUDIO
    { category: 'AUDIO', method: 'GET', path: '/audio-voices', desc: 'List available Edge TTS / neural voice models', defaultPayload: {} },
    { category: 'AUDIO', method: 'POST', path: '/generate-audio', desc: 'Generate MP3 audio from text and voice', defaultPayload: { text: "Welcome to AI Studio.", voice: "en-US-AriaNeural" } },
    { category: 'AUDIO', method: 'POST', path: '/generate-video-audio', desc: 'Generate audio track for video script', defaultPayload: {} },
    { category: 'AUDIO', method: 'GET', path: '/audio/{filename}', desc: 'Serve generated MP3 audio file', defaultPayload: {} },

    // PRESENTATION
    { category: 'PRESENTATION', method: 'POST', path: '/export-pptx', desc: 'Export structured PowerPoint presentation', defaultPayload: { title: "AI Strategy 2026", slides: [{ title: "Overview", points: ["Point 1"] }] } },
    { category: 'PRESENTATION', method: 'POST', path: '/export-pptx-file', desc: 'Export PPTX from source file', defaultPayload: {} },

    // CONSISTENCY
    { category: 'CONSISTENCY', method: 'POST', path: '/consistency/extract', desc: 'Extract atomic facts from source text', defaultPayload: { text: "Company revenue reached $50M in Q4." } },
    { category: 'CONSISTENCY', method: 'POST', path: '/consistency/analyze', desc: 'Analyze semantic consistency across outputs', defaultPayload: {} },
    { category: 'CONSISTENCY', method: 'GET', path: '/consistency/registry/{source_id}/facts', desc: 'Get fact registry for source ID', defaultPayload: {} },
    { category: 'CONSISTENCY', method: 'POST', path: '/consistency/generate', desc: 'Generate grounded deliverables with fact IDs', defaultPayload: {} },
    { category: 'CONSISTENCY', method: 'POST', path: '/consistency/pipeline', desc: 'Run complete 7-step consistency pipeline', defaultPayload: { text: "AI transformation roadmap." } },
    { category: 'CONSISTENCY', method: 'POST', path: '/consistency/quality-score', desc: 'Calculate 6-dimension quality score', defaultPayload: { text: "AI content evaluation text." } },
    { category: 'CONSISTENCY', method: 'POST', path: '/consistency/translate', desc: 'Translate grounded deliverables across languages', defaultPayload: { text: "Hello world", target_language: "Hindi" } },
    { category: 'CONSISTENCY', method: 'GET', path: '/consistency/languages', desc: 'List supported translation languages', defaultPayload: {} },

    // OTHER
    { category: 'OTHER', method: 'GET', path: '/v1/models', desc: 'List active model configuration', defaultPayload: {} }
  ];

  const [selectedEndpoint, setSelectedEndpoint] = useState(endpoints[0]);
  const [requestPayload, setRequestPayload] = useState(JSON.stringify(endpoints[0].defaultPayload, null, 2));
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);

  const categories = ['ALL', 'TEXT TRANSFORMATION', 'MULTIMODAL', 'VISUAL AI', 'IMAGE GENERATION', 'VIDEO', 'AUDIO', 'PRESENTATION', 'CONSISTENCY', 'OTHER'];

  const filteredEndpoints = endpoints.filter(ep => {
    const matchesSearch = ep.path.toLowerCase().includes(searchTerm.toLowerCase()) || ep.desc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || ep.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleSelectEndpoint = (ep: typeof endpoints[0]) => {
    setSelectedEndpoint(ep);
    setRequestPayload(JSON.stringify(ep.defaultPayload, null, 2));
    setResponseOutput(null);
    setStatusCode(null);
  };

  const handleSendRequest = async () => {
    setIsExecuting(true);
    setResponseOutput(null);
    setStatusCode(null);
    try {
      let parsedData = {};
      try {
        parsedData = JSON.parse(requestPayload);
      } catch (e) {
        parsedData = { raw: requestPayload };
      }

      let res;
      const path = selectedEndpoint.path.replace('{job_id}', 'job_demo_123').replace('{source_id}', 'source_demo_123').replace('{filename}', 'demo.png');
      
      if (selectedEndpoint.method === 'GET') {
        res = await apiClient.get(path);
      } else {
        res = await apiClient.post(path, parsedData);
      }

      setStatusCode(res.status);
      setResponseOutput(JSON.stringify(res.data, null, 2));
    } catch (err: any) {
      setStatusCode(err.response?.status || 500);
      setResponseOutput(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyResponse = () => {
    if (responseOutput) {
      navigator.clipboard.writeText(responseOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>FastAPI Interactive Explorer</h2>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
            Explore and test all 23 backend REST endpoints connected to FastAPI (`http://localhost:8000`).
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Search endpoints..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
              isDarkMode ? 'bg-[#181818] border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900'
            }`}
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-[#1ed760] text-black shadow-md'
                : isDarkMode ? 'bg-[#181818] text-[#b3b3b3] hover:text-white' : 'bg-slate-200 text-slate-700 hover:text-slate-900'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Endpoint List */}
        <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2">
          {filteredEndpoints.map((ep, idx) => {
            const isSelected = selectedEndpoint.path === ep.path && selectedEndpoint.method === ep.method;
            return (
              <div
                key={idx}
                onClick={() => handleSelectEndpoint(ep)}
                className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                  isSelected 
                    ? 'border-[#1ed760] bg-[#1ed760]/10 shadow-lg shadow-[#1ed760]/10' 
                    : isDarkMode 
                      ? 'bg-[#181818] border-white/10 hover:border-white/30' 
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${
                    ep.method === 'POST' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-[#1ed760]/20 text-[#1ed760] border border-[#1ed760]/30'
                  }`}>
                    {ep.method}
                  </span>
                  <span className={`font-mono text-xs font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{ep.path}</span>
                </div>
                <p className={`text-[11px] mt-1.5 leading-relaxed line-clamp-2 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>{ep.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Request & Response Console */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`rounded-2xl border p-6 shadow-xl space-y-4 ${
            isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded uppercase ${
                  selectedEndpoint.method === 'POST' ? 'bg-amber-500/20 text-amber-400' : 'bg-[#1ed760]/20 text-[#1ed760]'
                }`}>
                  {selectedEndpoint.method}
                </span>
                <span className="font-mono text-xs font-bold">{selectedEndpoint.path}</span>
              </div>
              <button
                onClick={handleSendRequest}
                disabled={isExecuting}
                className="px-6 py-2 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isExecuting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-black" />}
                <span>Send Request</span>
              </button>
            </div>

            <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>{selectedEndpoint.desc}</p>

            {selectedEndpoint.method === 'POST' && (
              <div className="space-y-2">
                <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Request Payload (JSON)</label>
                <textarea
                  value={requestPayload}
                  onChange={(e) => setRequestPayload(e.target.value)}
                  rows={8}
                  className={`w-full font-mono text-xs p-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Response Box */}
          <div className={`rounded-2xl border p-6 shadow-xl space-y-3 ${
            isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h3 className="font-bold text-xs uppercase tracking-wider">Response</h3>
                {statusCode !== null && (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    statusCode >= 200 && statusCode < 300 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    HTTP {statusCode}
                  </span>
                )}
              </div>
              {responseOutput && (
                <button
                  onClick={handleCopyResponse}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 border transition ${
                    isDarkMode ? 'border-white/10 hover:bg-white/5 text-[#b3b3b3]' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#1ed760]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              )}
            </div>

            <div className={`rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-96 ${
              isDarkMode ? 'bg-[#121212] text-white border border-white/10' : 'bg-slate-900 text-white border border-slate-800'
            }`}>
              <pre>{responseOutput || '// Response will appear here after sending request...'}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
