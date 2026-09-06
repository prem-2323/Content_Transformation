import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Wrench,
  GitCompare,
  FileCheck,
  Check,
  Copy,
  ArrowRight,
  Sliders,
  CheckSquare
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { consistencyApi } from '../api/consistency';

export const ConsistencyPipeline: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'pipeline' | 'audit_validate' | 'repair' | 'diff_regen' | 'evidence'>('pipeline');

  // --- Tab 1: Pipeline State ---
  const [inputText, setInputText] = useState(
    'Company revenue reached $50M in Q4 2025 with 20% year-over-year growth across North America and Europe.'
  );
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [isPipelineLoading, setIsPipelineLoading] = useState(false);

  // --- Tab 2: Audit & Validation State ---
  const [auditSourceId, setAuditSourceId] = useState('src_demo_01');
  const [auditOutputs, setAuditOutputs] = useState(
    JSON.stringify({
      summary: "Company revenue reached $50M in Q4 2025 with 20% YoY growth [F001].",
      linkedin: "🚀 Excited to announce Q4 revenue reached $50M [F001] with 20% growth!"
    }, null, 2)
  );
  const [auditResult, setAuditResult] = useState<any>(null);
  const [validationReport, setValidationReport] = useState<any>(null);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [isValidationLoading, setIsValidationLoading] = useState(false);

  // --- Tab 3: Auto-Repair State ---
  const [repairUckr, setRepairUckr] = useState(
    JSON.stringify({
      source_id: "src_repair_01",
      facts: [
        { fact_id: "F001", statement: "Revenue reached $50M in Q4 2025", category: "FINANCIAL", importance: 1.0 },
        { fact_id: "F002", statement: "Year-over-year growth rate was 20%", category: "FINANCIAL", importance: 0.9 }
      ]
    }, null, 2)
  );
  const [repairOutputs, setRepairOutputs] = useState(
    JSON.stringify({
      summary: "Revenue reached $95M in Q4 2025 with 50% growth.",
      linkedin: "Q4 revenue reached $50M with 20% growth."
    }, null, 2)
  );
  const [repairResult, setRepairResult] = useState<any>(null);
  const [isRepairLoading, setIsRepairLoading] = useState(false);

  // --- Tab 4: Diff & Selective Regeneration State ---
  const [uckrV1, setUckrV1] = useState(
    JSON.stringify({
      source_id: "src_diff_01",
      version: 1,
      facts: [
        { fact_id: "F001", statement: "Revenue reached $50M in Q4 2025", category: "FINANCIAL", importance: 1.0 },
        { fact_id: "F002", statement: "Growth rate was 20%", category: "FINANCIAL", importance: 0.8 }
      ]
    }, null, 2)
  );
  const [uckrV2, setUckrV2] = useState(
    JSON.stringify({
      source_id: "src_diff_01",
      version: 2,
      facts: [
        { fact_id: "F001", statement: "Revenue reached $55M in Q4 2025", category: "FINANCIAL", importance: 1.0 },
        { fact_id: "F002", statement: "Growth rate was 20%", category: "FINANCIAL", importance: 0.8 },
        { fact_id: "F003", statement: "New market expansion launched in APAC", category: "EXPANSION", importance: 0.9 }
      ]
    }, null, 2)
  );
  const [diffOutputs, setDiffOutputs] = useState(
    JSON.stringify({
      summary: "Revenue reached $50M in Q4 2025 with 20% growth.",
      linkedin: "Q4 revenue reached $50M."
    }, null, 2)
  );

  const [diffResult, setDiffResult] = useState<any>(null);
  const [regenResult, setRegenResult] = useState<any>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [isRegenLoading, setIsRegenLoading] = useState(false);

  // --- Tab 5: Evidence Traceability State ---
  const [evidenceUckr, setEvidenceUckr] = useState('');
  const [evidenceOutputs, setEvidenceOutputs] = useState('');
  const [evidenceResult, setEvidenceResult] = useState<any>(null);
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // --- Handlers ---
  const handleRunPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPipelineLoading(true);
    setError(null);
    try {
      const res = await consistencyApi.runPipeline({
        text: inputText,
        output_types: 'summary,linkedin,presentation',
      });
      setPipelineResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message || 'Pipeline execution failed.');
    } finally {
      setIsPipelineLoading(false);
    }
  };

  const handleAudit = async () => {
    setIsAuditLoading(true);
    setError(null);
    try {
      let parsedOut = JSON.parse(auditOutputs);
      const res = await consistencyApi.audit({
        source_id: auditSourceId,
        outputs: parsedOut
      });
      setAuditResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message || 'Audit failed. Check JSON formatting.');
    } finally {
      setIsAuditLoading(false);
    }
  };

  const handleValidate = async () => {
    setIsValidationLoading(true);
    setError(null);
    try {
      let parsedUckr = JSON.parse(repairUckr);
      let parsedOut = JSON.parse(auditOutputs);
      const res = await consistencyApi.validate({
        uckr: parsedUckr,
        outputs: parsedOut
      });
      setValidationReport(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message || 'Validation failed.');
    } finally {
      setIsValidationLoading(false);
    }
  };

  const handleRepair = async () => {
    setIsRepairLoading(true);
    setError(null);
    try {
      let parsedUckr = JSON.parse(repairUckr);
      let parsedOut = JSON.parse(repairOutputs);
      const res = await consistencyApi.repair({
        uckr: parsedUckr,
        outputs: parsedOut
      });
      setRepairResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message || 'Auto-repair failed.');
    } finally {
      setIsRepairLoading(false);
    }
  };

  const handleDiff = async () => {
    setIsDiffLoading(true);
    setError(null);
    try {
      let v1Obj = JSON.parse(uckrV1);
      let v2Obj = JSON.parse(uckrV2);
      const res = await consistencyApi.diff({ v1: v1Obj, v2: v2Obj });
      setDiffResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message || 'UCKR diff failed.');
    } finally {
      setIsDiffLoading(false);
    }
  };

  const handleRegenerateAffected = async () => {
    if (!diffResult) {
      setError('Please compute UCKR diff first before running selective regeneration.');
      return;
    }
    setIsRegenLoading(true);
    setError(null);
    try {
      let v2Obj = JSON.parse(uckrV2);
      let prevOutObj = JSON.parse(diffOutputs);
      const res = await consistencyApi.regenerateAffected({
        uckr_v2: v2Obj,
        diff: diffResult,
        previous_outputs: prevOutObj
      });
      setRegenResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message || 'Selective regeneration failed.');
    } finally {
      setIsRegenLoading(false);
    }
  };

  const handleUsePipelineResultForEvidence = () => {
    if (!pipelineResult?.uckr || !pipelineResult?.outputs) {
      setError('Run the 8-step pipeline first — its UCKR and outputs will prefill the evidence form.');
      return;
    }
    setEvidenceUckr(JSON.stringify(pipelineResult.uckr, null, 2));
    setEvidenceOutputs(JSON.stringify(pipelineResult.outputs, null, 2));
    setError(null);
  };

  const handleEvidence = async () => {
    setIsEvidenceLoading(true);
    setError(null);
    try {
      const uckrObj = JSON.parse(evidenceUckr);
      const outputsObj = JSON.parse(evidenceOutputs);
      const res = await consistencyApi.getEvidence({
        uckr: uckrObj,
        outputs: outputsObj,
      });
      setEvidenceResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Evidence trace failed. Check JSON formatting.');
    } finally {
      setIsEvidenceLoading(false);
    }
  };

  const pipelineSteps = [
    '1. Ingestion',
    '2. Source Extraction',
    '3. Content Understanding',
    '4. UCKR Construction',
    '5. Fact ID Attribution',
    '6. Fact Registry',
    '7. Grounded Generation',
    '8. Consistency Audit'
  ];

  return (
    <div className={`max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      
      {/* Header Banner */}
      <div className={`pb-6 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-6 h-6 text-[#1ed760]" />
              <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Consistency & Verification Engine
              </h2>
            </div>
            <p className={`text-xs mt-1.5 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
              Full suite for UCKR Fact Registry, Multi-Dimensional Validation, Auto-Repair, Version Diffs, and Selective Regeneration.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              /consistency/pipeline
            </span>
            <span className="px-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              /audit
            </span>
            <span className="px-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              /validate
            </span>
            <span className="px-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
              /repair
            </span>
            <span className="px-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              /diff
            </span>
            <span className="px-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
              /regenerate-affected
            </span>
            <span className="px-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/30">
              /evidence
            </span>
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="mt-6 flex flex-wrap border-b border-white/10 gap-4">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`pb-2 text-xs font-semibold flex items-center space-x-2 transition border-b-2 cursor-pointer ${
              activeTab === 'pipeline'
                ? 'border-[#1ed760] text-[#1ed760]'
                : `${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} border-transparent`
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>8-Step Pipeline (/pipeline)</span>
          </button>

          <button
            onClick={() => setActiveTab('audit_validate')}
            className={`pb-2 text-xs font-semibold flex items-center space-x-2 transition border-b-2 cursor-pointer ${
              activeTab === 'audit_validate'
                ? 'border-[#1ed760] text-[#1ed760]'
                : `${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} border-transparent`
            }`}
          >
            <FileCheck className="w-4 h-4 text-blue-400" />
            <span>Audit & Validation (/audit, /validate)</span>
          </button>

          <button
            onClick={() => setActiveTab('repair')}
            className={`pb-2 text-xs font-semibold flex items-center space-x-2 transition border-b-2 cursor-pointer ${
              activeTab === 'repair'
                ? 'border-[#1ed760] text-[#1ed760]'
                : `${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} border-transparent`
            }`}
          >
            <Wrench className="w-4 h-4 text-purple-400" />
            <span>Auto-Repair Engine (/repair)</span>
          </button>

          <button
            onClick={() => setActiveTab('diff_regen')}
            className={`pb-2 text-xs font-semibold flex items-center space-x-2 transition border-b-2 cursor-pointer ${
              activeTab === 'diff_regen'
                ? 'border-[#1ed760] text-[#1ed760]'
                : `${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} border-transparent`
            }`}
          >
            <GitCompare className="w-4 h-4 text-amber-400" />
            <span>UCKR Diff & Selective Re-Gen (/diff, /regenerate-affected)</span>
          </button>

          <button
            onClick={() => setActiveTab('evidence')}
            className={`pb-2 text-xs font-semibold flex items-center space-x-2 transition border-b-2 cursor-pointer ${
              activeTab === 'evidence'
                ? 'border-[#1ed760] text-[#1ed760]'
                : `${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} border-transparent`
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Evidence Trace (/evidence)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── TAB 1: 8-Step Consistency Pipeline ── */}
      {activeTab === 'pipeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form onSubmit={handleRunPipeline} className={`lg:col-span-5 rounded-2xl border p-6 shadow-xl space-y-6 ${
            isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
          }`}>
            <div className="space-y-2">
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                Source Text for Pipeline
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={6}
                className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#1ed760] ${
                  isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={isPipelineLoading}
              className="w-full py-3.5 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isPipelineLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Execute 8-Step Pipeline (POST /consistency/pipeline)</span>
            </button>
          </form>

          <div className={`lg:col-span-7 rounded-2xl border p-6 shadow-xl space-y-6 ${
            isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
          }`}>
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#1ed760]">8-Stage Consistency Pipeline Flow</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {pipelineSteps.map((step, idx) => (
                <div key={idx} className={`p-3 rounded-xl border space-y-1 ${
                  isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[9px] font-bold text-[#1ed760] uppercase">Stage {idx + 1}</span>
                  <p className="text-xs font-semibold">{step.replace(/^\d+\.\s*/, '')}</p>
                </div>
              ))}
            </div>

            {pipelineResult ? (
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-400">Pipeline Execution Successful!</span>
                  <span className="text-[10px] font-mono text-slate-400">Source ID: {pipelineResult.source_id}</span>
                </div>
                
                <div className={`p-4 rounded-xl border max-h-60 overflow-y-auto font-mono text-xs ${
                  isDarkMode ? 'bg-[#121212] border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}>
                  <pre className="whitespace-pre-wrap font-sans text-xs">{JSON.stringify(pipelineResult, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <Layers className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-xs">Submit source text to execute the complete 8-step consistency pipeline.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: Audit & Multi-Dimensional Validation ── */}
      {activeTab === 'audit_validate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Form Side */}
          <div className="lg:col-span-6 space-y-6">
            {/* Audit Form */}
            <div className={`rounded-2xl border p-6 shadow-xl space-y-4 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}>
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xs uppercase tracking-wider text-blue-400 flex items-center space-x-2">
                  <FileCheck className="w-4 h-4" />
                  <span>Audit Deliverables against Registry (POST /consistency/audit)</span>
                </h3>
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Source ID</label>
                <input
                  type="text"
                  value={auditSourceId}
                  onChange={(e) => setAuditSourceId(e.target.value)}
                  className={`w-full mt-1 p-2.5 rounded-xl text-xs border ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Deliverable Outputs JSON</label>
                <textarea
                  value={auditOutputs}
                  onChange={(e) => setAuditOutputs(e.target.value)}
                  rows={4}
                  className={`w-full mt-1 p-2.5 rounded-xl text-xs font-mono border ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-emerald-400' : 'bg-slate-50 border-slate-300 text-emerald-800'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={handleAudit}
                disabled={isAuditLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider shadow transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isAuditLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                <span>Run Fact Registry Audit</span>
              </button>
            </div>

            {/* Validation Form */}
            <div className={`rounded-2xl border p-6 shadow-xl space-y-4 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}>
              <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-400 flex items-center space-x-2">
                <Sliders className="w-4 h-4" />
                <span>6-Dimensional Validation (POST /consistency/validate)</span>
              </h3>

              <div>
                <label className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>UCKR JSON</label>
                <textarea
                  value={repairUckr}
                  onChange={(e) => setRepairUckr(e.target.value)}
                  rows={4}
                  className={`w-full mt-1 p-2.5 rounded-xl text-xs font-mono border ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-purple-300' : 'bg-slate-50 border-slate-300 text-purple-900'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={handleValidate}
                disabled={isValidationLoading}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isValidationLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sliders className="w-4 h-4" />}
                <span>Calculate Validation Scores</span>
              </button>
            </div>
          </div>

          {/* Results Side */}
          <div className="lg:col-span-6 space-y-6">
            <div className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}>
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#1ed760]">Audit & Validation Report</h3>

              {auditResult && (
                <div className="space-y-3 p-4 rounded-xl bg-[#121212] border border-blue-500/30 text-xs">
                  <span className="font-bold text-blue-400 block">Fact Registry Audit Output</span>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-bold text-emerald-400">{auditResult.status || 'Audited'}</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto">
                    {JSON.stringify(auditResult, null, 2)}
                  </pre>
                </div>
              )}

              {validationReport && (
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="font-bold text-sm text-indigo-400">Detailed Consistency Report</span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-bold font-mono">
                      Overall: {validationReport.overall_score ?? validationReport.consistency_score ?? 100}/100
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: 'Fact Score', val: validationReport.fact_score },
                      { label: 'Numeric Score', val: validationReport.numeric_score },
                      { label: 'Entity Score', val: validationReport.entity_score },
                      { label: 'Semantic Score', val: validationReport.semantic_score },
                      { label: 'Claim Score', val: validationReport.claim_score },
                      { label: 'Cross-Output Score', val: validationReport.cross_output_score },
                    ].map((m, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-[#121212] border border-white/10 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">{m.label}</span>
                          <span className="font-bold text-[#1ed760]">{m.val ?? 100}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5">
                          <div
                            className="bg-[#1ed760] h-1.5 rounded-full"
                            style={{ width: `${m.val ?? 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!auditResult && !validationReport && (
                <div className="text-center py-20 text-slate-400 space-y-2">
                  <FileCheck className="w-10 h-10 mx-auto opacity-40" />
                  <p className="text-xs">Run an Audit or Validation to inspect multi-dimensional fact matrix scores.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Auto-Repair Engine ── */}
      {activeTab === 'repair' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 space-y-6">
            <div className={`rounded-2xl border p-6 shadow-xl space-y-4 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}>
              <h3 className="font-bold text-xs uppercase tracking-wider text-purple-400 flex items-center space-x-2">
                <Wrench className="w-4 h-4" />
                <span>Automatic Repair Engine (POST /consistency/repair)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Detects numeric, entity, or claim inconsistencies and performs automated targeted repairs.
              </p>

              <div>
                <label className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>UCKR Ground Truth</label>
                <textarea
                  value={repairUckr}
                  onChange={(e) => setRepairUckr(e.target.value)}
                  rows={4}
                  className={`w-full mt-1 p-2.5 rounded-xl text-xs font-mono border ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-purple-300' : 'bg-slate-50 border-slate-300 text-purple-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Outputs with Discrepancies</label>
                <textarea
                  value={repairOutputs}
                  onChange={(e) => setRepairOutputs(e.target.value)}
                  rows={4}
                  className={`w-full mt-1 p-2.5 rounded-xl text-xs font-mono border ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-red-300' : 'bg-slate-50 border-slate-300 text-red-900'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={handleRepair}
                disabled={isRepairLoading}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider shadow transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isRepairLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                <span>Execute Auto-Repair Engine</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}>
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#1ed760]">Repair Execution Results</h3>

              {repairResult ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#121212] border border-purple-500/30 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-purple-400">Repair Status:</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold font-mono">
                        {repairResult.status || 'success'}
                      </span>
                    </div>
                    {repairResult.repair_result && (
                      <p className="text-xs text-slate-300">
                        Total Repairs Applied: <span className="font-bold text-[#1ed760]">{repairResult.repair_result.repairs_applied ?? 0}</span>
                      </p>
                    )}
                  </div>

                  {repairResult.repaired_outputs && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Repaired Deliverables Output</span>
                      <div className="p-4 rounded-xl bg-[#121212] border border-white/10 font-mono text-xs max-h-60 overflow-y-auto text-emerald-400">
                        <pre className="whitespace-pre-wrap font-sans text-xs">{JSON.stringify(repairResult.repaired_outputs, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-24 text-slate-400 space-y-2">
                  <Wrench className="w-10 h-10 mx-auto opacity-40" />
                  <p className="text-xs">Submit outputs with discrepancies to view automatic repairs.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: UCKR Diff & Selective Regeneration ── */}
      {activeTab === 'diff_regen' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 space-y-6">
            <div className={`rounded-2xl border p-6 shadow-xl space-y-4 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}>
              <h3 className="font-bold text-xs uppercase tracking-wider text-amber-400 flex items-center space-x-2">
                <GitCompare className="w-4 h-4" />
                <span>UCKR Version Manager (POST /consistency/diff)</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>UCKR Version 1 (v1)</label>
                  <textarea
                    value={uckrV1}
                    onChange={(e) => setUckrV1(e.target.value)}
                    rows={5}
                    className={`w-full mt-1 p-2 rounded-xl text-[11px] font-mono border ${
                      isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>UCKR Version 2 (v2)</label>
                  <textarea
                    value={uckrV2}
                    onChange={(e) => setUckrV2(e.target.value)}
                    rows={5}
                    className={`w-full mt-1 p-2 rounded-xl text-[11px] font-mono border ${
                      isDarkMode ? 'bg-[#121212] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleDiff}
                disabled={isDiffLoading}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider shadow transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isDiffLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
                <span>Calculate UCKR Version Diff</span>
              </button>
            </div>

            {/* Selective Regeneration Section */}
            <div className={`rounded-2xl border p-6 shadow-xl space-y-4 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}>
              <h3 className="font-bold text-xs uppercase tracking-wider text-rose-400 flex items-center space-x-2">
                <RefreshCw className="w-4 h-4" />
                <span>Selective Regeneration (POST /consistency/regenerate-affected)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Regenerates only deliverables affected by changed/added facts without modifying unaffected channels.
              </p>

              <button
                type="button"
                onClick={handleRegenerateAffected}
                disabled={isRegenLoading || !diffResult}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider shadow transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isRegenLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Regenerate Affected Channels Only</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-6">
            <div className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}>
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#1ed760]">Version Diff & Selective Regeneration Results</h3>

              {diffResult && (
                <div className="p-4 rounded-xl bg-[#121212] border border-amber-500/30 space-y-3 text-xs">
                  <span className="font-bold text-amber-400 block">UCKR Version Diff Output</span>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Added Facts:</span>
                    <span className="font-bold text-emerald-400">{diffResult.added_facts?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Changed Facts:</span>
                    <span className="font-bold text-amber-400">{diffResult.changed_facts?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Affected Channels:</span>
                    <span className="font-bold text-rose-400">{(diffResult.affected_channels || []).join(', ') || 'None'}</span>
                  </div>
                </div>
              )}

              {regenResult && (
                <div className="p-4 rounded-xl bg-[#121212] border border-rose-500/30 space-y-3 text-xs">
                  <span className="font-bold text-rose-400 block">Selective Regeneration Result</span>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Regenerated Channels:</span>
                    <span className="font-bold text-rose-400">{(regenResult.regenerated_channels || []).join(', ') || 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Preserved Channels:</span>
                    <span className="font-bold text-emerald-400">{(regenResult.preserved_channels || []).join(', ') || 'None'}</span>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Final Updated Deliverables</span>
                    <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto">
                      {JSON.stringify(regenResult.final_outputs || regenResult, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {!diffResult && !regenResult && (
                <div className="text-center py-24 text-slate-400 space-y-2">
                  <GitCompare className="w-10 h-10 mx-auto opacity-40" />
                  <p className="text-xs">Compute a UCKR version diff to view added/changed facts and selective regeneration.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: Evidence Traceability ── */}
      {activeTab === 'evidence' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <div className={`rounded-2xl border p-6 shadow-xl space-y-4 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}>
              <h3 className="font-bold text-xs uppercase tracking-wider text-teal-400 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Statement-Level Evidence Trace (POST /consistency/evidence)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Traces every generated statement back to Fact IDs, verbatim source text, pages, and verification status.
              </p>

              <button
                type="button"
                onClick={handleUsePipelineResultForEvidence}
                disabled={!pipelineResult?.uckr}
                className="w-full py-2.5 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/40 text-teal-300 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Use Latest Pipeline Result (UCKR + Outputs)</span>
              </button>

              <div>
                <label className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>UCKR JSON</label>
                <textarea
                  value={evidenceUckr}
                  onChange={(e) => setEvidenceUckr(e.target.value)}
                  rows={5}
                  placeholder='{"document": {"id": "SRC-…", "title": "…"}, "facts": [{"id": "F001", "statement": "…"}]}'
                  className={`w-full mt-1 p-2.5 rounded-xl text-xs font-mono border ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-teal-200' : 'bg-slate-50 border-slate-300 text-teal-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Generated Outputs JSON</label>
                <textarea
                  value={evidenceOutputs}
                  onChange={(e) => setEvidenceOutputs(e.target.value)}
                  rows={5}
                  placeholder='{"summary": {"text": "…", "source_facts": ["F001"]}, "linkedin": {…}}'
                  className={`w-full mt-1 p-2.5 rounded-xl text-xs font-mono border ${
                    isDarkMode ? 'bg-[#121212] border-white/10 text-teal-200' : 'bg-slate-50 border-slate-300 text-teal-900'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={handleEvidence}
                disabled={isEvidenceLoading}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider shadow transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isEvidenceLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>Trace Evidence</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className={`rounded-2xl border p-6 shadow-xl space-y-6 ${
              isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
            }`}>
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#1ed760]">Evidence Trace Report</h3>

              {evidenceResult ? (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Statements', val: evidenceResult.total_statements ?? 0 },
                      { label: 'Verified', val: evidenceResult.verified_statements ?? 0 },
                      { label: 'Likely', val: evidenceResult.likely_statements ?? 0 },
                      { label: 'Unmatched', val: evidenceResult.unmatched_statements ?? 0 },
                    ].map((m, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border text-center ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="text-lg font-extrabold text-teal-400">{m.val}</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Verification rate:</span>
                    <span className="font-bold text-[#1ed760] font-mono">{evidenceResult.verification_rate ?? 0}%</span>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {Object.entries(evidenceResult.channels || {}).map(([channel, items]: [string, any]) => (
                      <div key={channel} className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="font-bold uppercase tracking-wider text-[11px] text-teal-300 mb-2">{channel} ({(items || []).length})</div>
                        <div className="space-y-2">
                          {(items || []).slice(0, 12).map((ev: any, i: number) => (
                            <div key={i} className="border-t border-white/5 pt-2 first:border-0 first:pt-0">
                              <p className={`${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{ev.statement_text}</p>
                              <div className="mt-1 flex flex-wrap gap-1.5 items-center text-[10px] font-mono">
                                <span className={`px-1.5 py-0.5 rounded font-bold ${
                                  ev.verification === 'verified' ? 'bg-emerald-500/20 text-emerald-400'
                                  : ev.verification === 'likely' ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-red-500/20 text-red-400'
                                }`}>{ev.verification || 'unmatched'}</span>
                                {(ev.source_facts || []).map((fid: string) => (
                                  <span key={fid} className="px-1.5 py-0.5 rounded bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30">{fid}</span>
                                ))}
                                {(ev.source_pages || []).length > 0 && (
                                  <span className="text-slate-400">p.{(ev.source_pages || []).join(', p.')}</span>
                                )}
                                {typeof ev.confidence === 'number' && (
                                  <span className="text-slate-400">{Math.round(ev.confidence * 100)}%</span>
                                )}
                              </div>
                              {(ev.source_statements || []).length > 0 && (
                                <p className="mt-1 text-[11px] italic text-slate-400">“{(ev.source_statements || [])[0]}”</p>
                              )}
                            </div>
                          ))}
                          {(items || []).length > 12 && (
                            <p className="text-[10px] text-slate-500">+{(items || []).length - 12} more statements…</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-24 text-slate-400 space-y-2">
                  <ShieldCheck className="w-10 h-10 mx-auto opacity-40" />
                  <p className="text-xs">Trace any UCKR + outputs pair to audit every statement's source evidence.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
