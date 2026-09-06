import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  ArrowRight,
  Eye,
  Layers,
  Image as ImageIcon,
  Cpu,
  Check,
  Copy,
  FileType
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { multimodalApi } from '../api/multimodal';

interface MultimodalPdfStudioProps {
  onCompleteResult: (res: any) => void;
}

export const MultimodalPdfStudio: React.FC<MultimodalPdfStudioProps> = ({ onCompleteResult }) => {
  const { isDarkMode } = useTheme();
  const [file, setFile] = useState<File | null>(null);
  const [audience, setAudience] = useState('Executive & Technical Leadership');
  const [tone, setTone] = useState('Analytical & Professional');
  const [language, setLanguage] = useState('English');
  const [detailLevel, setDetailLevel] = useState('Comprehensive');
  const [objective, setObjective] = useState('Strategic Insights & Deliverables');
  const [outputTypes, setOutputTypes] = useState<string[]>(['summary', 'presentation', 'advisory', 'linkedin']);

  const OUTPUT_OPTIONS = [
    { id: 'summary', label: 'Executive Summary' },
    { id: 'presentation', label: 'PowerPoint Deck' },
    { id: 'advisory', label: 'Strategic Advisory' },
    { id: 'linkedin', label: 'LinkedIn Post' },
    { id: 'twitter', label: 'Twitter/X Thread' },
    { id: 'video_script', label: 'Video Script' },
    { id: 'infographic', label: 'Infographic Spec' }
  ];

  const toggleOutputType = (ot: string) => {
    setOutputTypes((prev) =>
      prev.includes(ot) ? (prev.length > 1 ? prev.filter((x) => x !== ot) : prev) : [...prev, ot]
    );
  };

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<string>('summary');

  // Polling effect for job status
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const data = await multimodalApi.getStatus(jobId);
        if ((data as any)._isFallback || String(jobId).startsWith('job_fallback_')) {
          setError('Backend unreachable — ensure FastAPI is running on http://localhost:8000 and try again.');
          setIsLoading(false);
          clearInterval(interval);
          return;
        }

        setJobStatus(data);

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          setIsLoading(false);

          if (data.status === 'failed') {
            setError(data.error || 'Multimodal PDF transformation failed.');
          }

          if (data.status === 'completed' && data.result) {
            onCompleteResult(data);
          }
        }
      } catch (err: any) {
        console.error('Job polling error:', err);
        setError(err.message || 'Error checking job status.');
        setIsLoading(false);
        clearInterval(interval);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [jobId, onCompleteResult]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PDF document to transform.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported by /multimodal/transform-pdf.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setJobId(null);
    setJobStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('audience', audience);
      formData.append('tone', tone);
      formData.append('language', language);
      formData.append('detail_level', detailLevel);
      formData.append('objective', objective);
      formData.append('output_types', outputTypes.join(','));

      const res = await multimodalApi.transformPdf(formData);

      if (res.job_id) {
        setJobId(res.job_id);
        setJobStatus({
          job_id: res.job_id,
          status: 'queued',
          progress: 0,
          current_step: 'queued',
          step: 'Queued in background worker'
        });
      } else {
        throw new Error('Backend did not return a valid job ID.');
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err?.response?.data?.detail || err.message || 'Failed to submit PDF transformation job.');
      setIsLoading(false);
    }
  };

  const createSamplePdfBlob = () => {
    // Generate a dummy PDF sample for quick demonstration
    const sampleText = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 120 >>\nstream\nBT /F1 12 Tf 50 700 Td (AI Multimodal Transformation Report: Enterprise Document Analysis) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000062 00000 n \n0000000125 00000 n \n0000000224 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n395\n%%EOF`;
    const blob = new Blob([sampleText], { type: 'application/pdf' });
    const dummyFile = new File([blob], 'sample_enterprise_report.pdf', { type: 'application/pdf' });
    setFile(dummyFile);
    setError(null);
  };

  const handleCopyText = (textToCopy: string, key: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const PIPELINE_STEPS = [
    { key: 'queued', label: 'Queued', desc: 'Job submitted to background task' },
    { key: 'extracting_pdf', label: '1. Extract', desc: 'Extracting text & embedded images' },
    { key: 'analyzing_images', label: '2. Vision (Gemma)', desc: 'Multimodal image analysis with Gemma 3 4B' },
    { key: 'analyzing_text', label: '3. Understanding (Qwen)', desc: 'Structural text analysis with Qwen3 4B' },
    { key: 'building_context', label: '4. Context Assembly', desc: 'Fusing visual + textual intelligence' },
    { key: 'generating_output', label: '5. Multi-Synthesis', desc: 'Generating requested deliverable channels' },
    { key: 'completed', label: '6. Deliverables', desc: 'Multiple grounded outputs ready' },
  ];

  const getCurrentStepIndex = () => {
    if (!jobStatus) return -1;
    if (jobStatus.status === 'completed') return PIPELINE_STEPS.length - 1;
    const stepKey = jobStatus.current_step || 'queued';
    const idx = PIPELINE_STEPS.findIndex((s) => s.key === stepKey);
    return idx >= 0 ? idx : 1;
  };

  return (
    <div className={`max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      
      {/* Header Banner */}
      <div className={`pb-6 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <FileType className="w-6 h-6 text-[#1ed760]" />
              <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Multimodal PDF Studio
              </h2>
            </div>
            <p className={`text-xs mt-1.5 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
              End-to-end PDF processing pipeline for reports, research papers, advisories & enterprise documents.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold bg-[#1ed760]/10 text-[#1ed760] border border-[#1ed760]/30">
              POST /multimodal/transform-pdf
            </span>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
              GET /multimodal/status/{"{job_id}"}
            </span>
          </div>
        </div>

        {/* High Level Document Flow Diagram */}
        <div className={`mt-6 p-4 rounded-2xl border ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1ed760] mb-3">
            Document Transformation Pipeline
          </p>
          <div className="grid grid-cols-5 gap-2 text-center text-[11px] font-semibold">
            <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 ${isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-300'}`}>
              <FileType className="w-4 h-4 text-emerald-400" />
              <span>PDF Document</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 ${isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-300'}`}>
              <Upload className="w-4 h-4 text-blue-400" />
              <span>Extract</span>
              <span className="text-[9px] text-slate-400 font-normal">Text + Images</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 ${isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-300'}`}>
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>Understand</span>
              <span className="text-[9px] text-slate-400 font-normal">Gemma 3 + Qwen3</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 ${isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-300'}`}>
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Transform</span>
              <span className="text-[9px] text-slate-400 font-normal">Single Synthesis</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 ${isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-300'}`}>
              <Layers className="w-4 h-4 text-[#1ed760]" />
              <span>Multiple Outputs</span>
              <span className="text-[9px] text-slate-400 font-normal">Multi-Channel</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload & Controls + Live Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Upload & Form Controls */}
        <div className="lg:col-span-6 space-y-6">
          <form
            onSubmit={handleSubmit}
            className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}
          >
            {/* File Upload Box */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                  Upload PDF Document
                </label>
                <button
                  type="button"
                  onClick={createSamplePdfBlob}
                  className="text-[10px] text-[#1ed760] hover:underline cursor-pointer font-semibold"
                >
                  Load Sample PDF
                </button>
              </div>

              <div
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  isDarkMode ? 'border-white/20 bg-[#121212] hover:border-[#1ed760]/50' : 'border-slate-300 bg-slate-50 hover:border-[#1ed760]'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                  className="hidden"
                  id="pdf-studio-file"
                />
                <label htmlFor="pdf-studio-file" className="cursor-pointer space-y-2 block">
                  <Upload className="w-8 h-8 mx-auto text-[#1ed760]" />
                  <p className="text-xs font-bold">{file ? file.name : 'Click to browse or drag & drop PDF'}</p>
                  {file ? (
                    <p className="text-[10px] text-[#1ed760] font-mono">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • PDF Document
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400">Supports PDF documents with text & embedded images</p>
                  )}
                </label>
              </div>
            </div>

            {/* Target Output Channels Multi-select */}
            <div className="space-y-2">
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                Target Output Channels ({outputTypes.length} selected)
              </label>
              <div className="flex flex-wrap gap-2">
                {OUTPUT_OPTIONS.map((ot) => {
                  const isSelected = outputTypes.includes(ot.id);
                  return (
                    <button
                      key={ot.id}
                      type="button"
                      onClick={() => toggleOutputType(ot.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center space-x-1.5 ${
                        isSelected
                          ? 'bg-[#1ed760] text-black border-[#1ed760] shadow'
                          : isDarkMode
                          ? 'border-white/10 text-slate-300 hover:border-white/30'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span>{ot.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Context Parameters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                  Target Audience
                </label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className={`w-full mt-1 px-3 py-2 rounded-xl text-xs border ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                  Tone of Voice
                </label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className={`w-full mt-1 px-3 py-2 rounded-xl text-xs border ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                  Output Language
                </label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={`w-full mt-1 px-3 py-2 rounded-xl text-xs border ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                  Detail Level
                </label>
                <input
                  type="text"
                  value={detailLevel}
                  onChange={(e) => setDetailLevel(e.target.value)}
                  className={`w-full mt-1 px-3 py-2 rounded-xl text-xs border ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !file}
              className="w-full py-3.5 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Submit Multimodal PDF Job (POST /multimodal/transform-pdf)</span>
            </button>
          </form>
        </div>

        {/* Live Pipeline Execution & Progress Tracker */}
        <div className="lg:col-span-6">
          <div
            className={`rounded-2xl border p-6 shadow-xl h-full flex flex-col justify-between ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}
          >
            <div>
              <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
                <h3 className="font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-[#1ed760]" />
                  <span>Pipeline Execution Tracker</span>
                </h3>

                {jobStatus && (
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-bold ${
                    jobStatus.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : jobStatus.status === 'failed'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/30 animate-pulse'
                  }`}>
                    {jobStatus.status}
                  </span>
                )}
              </div>

              {jobId ? (
                <div className="space-y-6">
                  {/* Job Header Info */}
                  <div className={`p-4 rounded-xl border space-y-2 ${
                    isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-mono">Job ID:</span>
                      <span className="font-mono text-[#1ed760] font-bold">{jobId}</span>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Current Step:</span>
                      <span className="font-semibold text-purple-400">
                        {jobStatus?.step || jobStatus?.current_step || 'Initializing'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Pipeline Progress</span>
                        <span className="font-bold text-[#1ed760]">{jobStatus?.progress ?? 0}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#1ed760] h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, jobStatus?.progress ?? 0))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vertical Step Timeline */}
                  <div className="space-y-3 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Transformation Lifecycle
                    </span>
                    {PIPELINE_STEPS.map((s, idx) => {
                      const currentStepIdx = getCurrentStepIndex();
                      const isCompletedStep = idx < currentStepIdx || jobStatus?.status === 'completed';
                      const isCurrentStep = idx === currentStepIdx && jobStatus?.status !== 'completed';

                      return (
                        <div key={s.key} className="flex items-center space-x-3 text-xs">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                              isCompletedStep
                                ? 'bg-[#1ed760] text-black'
                                : isCurrentStep
                                ? 'bg-purple-500 text-white animate-bounce'
                                : isDarkMode
                                ? 'bg-white/10 text-slate-500'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {isCompletedStep ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                          </div>

                          <div className="flex-1">
                            <p className={`font-semibold ${
                              isCompletedStep
                                ? isDarkMode ? 'text-white' : 'text-slate-900'
                                : isCurrentStep
                                ? 'text-purple-400 font-bold'
                                : 'text-slate-400'
                            }`}>
                              {s.label}
                            </p>
                            <p className="text-[10px] text-slate-400">{s.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-24 text-slate-400 space-y-3 my-auto">
                  <FileText className="w-12 h-12 mx-auto opacity-40" />
                  <p className="text-xs max-w-xs mx-auto">
                    Select a PDF document and submit to start async job processing with live progress tracking.
                  </p>
                </div>
              )}
            </div>

            {/* Results Preview Footer when Completed */}
            {jobStatus?.status === 'completed' && jobStatus.result && (
              <div className="mt-6 p-4 rounded-xl bg-[#1ed760]/10 border border-[#1ed760]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1ed760] flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Multimodal Transformation Complete!</span>
                  </span>
                  <span className="text-[10px] text-slate-300 font-mono">
                    {jobStatus.result.extracted_images_count ?? 0} images • {String(jobStatus.result.extracted_text || '').length} chars
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Deliverables generated for: <strong className="text-white">{outputTypes.join(', ')}</strong>
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Complete Result Viewer (rendered inline when job completes) */}
      {jobStatus?.status === 'completed' && jobStatus.result && (
        <div className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
          isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-4">
            <div>
              <h3 className="text-lg font-bold flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-[#1ed760]" />
                <span>Multimodal Output Deliverables</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                PDF: <span className="text-white font-mono">{jobStatus.result.filename}</span>
              </p>
            </div>

            <button
              onClick={() => onCompleteResult(jobStatus.result)}
              className="px-4 py-2 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow-md transition flex items-center space-x-2 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Open in Full Results Workspace</span>
            </button>
          </div>

          {/* Sub-Tabs for each Output Deliverable */}
          <div className="space-y-4">
            <div className="flex flex-wrap border-b border-white/10 gap-2 pb-2">
              {Object.keys(jobStatus.result.outputs || {}).map((otKey) => (
                <button
                  key={otKey}
                  onClick={() => setActiveOutputTab(otKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                    activeOutputTab === otKey
                      ? 'bg-[#1ed760] text-black border-[#1ed760]'
                      : isDarkMode
                      ? 'bg-[#121212] border-white/10 text-slate-300 hover:text-white'
                      : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {otKey.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Active Channel Content Display */}
            {jobStatus.result.outputs && (
              <div className={`p-5 rounded-2xl border relative font-mono text-xs overflow-x-auto ${
                isDarkMode ? 'bg-[#121212] border-white/10 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}>
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
                  <span className="text-[10px] uppercase font-bold text-[#1ed760]">
                    Channel Output: {activeOutputTab}
                  </span>
                  <button
                    onClick={() =>
                      handleCopyText(
                        typeof jobStatus.result.outputs[activeOutputTab] === 'string'
                          ? jobStatus.result.outputs[activeOutputTab]
                          : JSON.stringify(jobStatus.result.outputs[activeOutputTab], null, 2),
                        activeOutputTab
                      )
                    }
                    className="text-xs flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 transition cursor-pointer"
                  >
                    {copiedKey === activeOutputTab ? <Check className="w-3.5 h-3.5 text-[#1ed760]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === activeOutputTab ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                  {typeof jobStatus.result.outputs[activeOutputTab] === 'string'
                    ? jobStatus.result.outputs[activeOutputTab]
                    : JSON.stringify(jobStatus.result.outputs[activeOutputTab], null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
