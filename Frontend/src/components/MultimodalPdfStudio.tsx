import React, { useState, useEffect } from 'react';
import { FileText, Upload, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Download, ArrowRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { multimodalApi } from '../api/multimodal';

export const MultimodalPdfStudio: React.FC<{ onCompleteResult: (res: any) => void }> = ({ onCompleteResult }) => {
  const { isDarkMode } = useTheme();
  const [file, setFile] = useState<File | null>(null);
  const [audience, setAudience] = useState('Professionals');
  const [tone, setTone] = useState('Analytical');
  const [language, setLanguage] = useState('English');
  const [detailLevel, setDetailLevel] = useState('Medium');
  const [objective, setObjective] = useState('Comprehensive Analysis');
  const [outputTypes, setOutputTypes] = useState<string[]>(['Summary', 'Presentation']);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling effect
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const data = await multimodalApi.getStatus(jobId);
        setJobStatus(data);
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          setIsLoading(false);
          if (data.status === 'completed') {
            onCompleteResult(data);
          }
        }
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PDF file.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setJobId(null);
    setJobStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('audience', audience);
      formData.append('tone', tone);
      formData.append('language', language);
      formData.append('detail_level', detailLevel);
      formData.append('objective', objective);
      outputTypes.forEach(ot => formData.append('output_types', ot));

      const res = await multimodalApi.transformPdf(formData);
      if (res.job_id) {
        setJobId(res.job_id);
        setJobStatus({ status: 'queued', step: 'Uploading' });
      } else {
        throw new Error('Backend did not return a job ID.');
      }
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className={`max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Multimodal PDF Studio</h2>
        <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
          Upload PDF documents for deep visual understanding with Gemma & Qwen transformation pipelines.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upload Form */}
        <form onSubmit={handleSubmit} className={`rounded-2xl border p-6 shadow-xl space-y-6 ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
          }`}>
          <div className="space-y-3">
            <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Select PDF Document</label>
            <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${isDarkMode ? 'border-white/20 bg-[#121212]' : 'border-slate-300 bg-slate-50'
              }`}>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                className="hidden"
                id="pdf-upload"
              />
              <label htmlFor="pdf-upload" className="cursor-pointer space-y-2 block">
                <Upload className="w-8 h-8 mx-auto text-[#1ed760]" />
                <p className="text-xs font-bold">{file ? file.name : 'Click to browse or drop PDF here'}</p>
                {file && <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Audience</label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className={`w-full mt-1 px-3 py-2 rounded-xl text-xs border ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
            </div>
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Tone</label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className={`w-full mt-1 px-3 py-2 rounded-xl text-xs border ${isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
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
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Start Multimodal Transformation</span>
          </button>
        </form>

        {/* Live Status & Pipeline Progress */}
        <div className={`rounded-2xl border p-6 shadow-xl space-y-6 flex flex-col justify-between ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
          }`}>
          <div>
            <h3 className="font-bold text-sm mb-4">Pipeline Execution Status</h3>
            {jobId ? (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-[#121212] border border-white/10 space-y-1">
                  <p className="text-[10px] text-slate-400 font-mono">Job ID: {jobId}</p>
                  <p className="text-xs font-bold text-[#1ed760] capitalize">Status: {jobStatus?.status || 'Processing...'}</p>
                  <p className="text-xs">Current Step: <span className="font-semibold">{jobStatus?.step || 'Initializing'}</span></p>
                </div>

                <div className="space-y-2">
                  {['Uploading', 'Extracting PDF', 'Analyzing images with Gemma', 'Understanding content', 'Generating outputs with Qwen', 'Running consistency checks', 'Completed'].map((stepName, idx) => {
                    const isPassed = jobStatus?.step === stepName || idx < 3;
                    return (
                      <div key={idx} className="flex items-center space-x-3 text-xs">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isPassed ? 'bg-[#1ed760] text-black' : isDarkMode ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-600'
                          }`}>
                          {idx + 1}
                        </div>
                        <span className={isPassed ? (isDarkMode ? 'text-white font-semibold' : 'text-slate-900 font-semibold') : 'text-slate-500'}>{stepName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <FileText className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-xs">Upload a PDF and start transformation to view live pipeline execution.</p>
              </div>
            )}
          </div>

          {jobStatus?.status === 'completed' && (
            <div className="p-4 rounded-xl bg-[#1ed760]/10 border border-[#1ed760]/30 space-y-2">
              <p className="text-xs font-bold text-[#1ed760]">Transformation Completed Successfully!</p>
              <p className="text-[11px]">Extracted text & generated deliverables are ready in the results workspace.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
