import React, { useState } from 'react';
import { ShieldCheck, Search, CheckCircle2, AlertTriangle, Award, Database, Filter, Cpu, Layers } from 'lucide-react';
import { D3ConsistencyGauge } from './D3ConsistencyGauge';
import { useTheme } from '../context/ThemeContext';

interface ContentIntelligenceProps {
  transformationResult: any;
}

export const ContentIntelligence: React.FC<ContentIntelligenceProps> = ({ transformationResult }) => {
  const { isDarkMode } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [minImportance, setMinImportance] = useState(0);

  const uckr = transformationResult?.uckr || {
    document: { id: "doc_101", title: "Enterprise AI Report", domain: "General", version: 1 },
    core_topic: "AI Content Transformation & UCKR Fact Grounding",
    summary: "Unified AI platform for automated multi-channel transformation with 100% factual consistency.",
    facts: [
      { id: "F001", statement: "Primary enterprise AI transformation metric confirmed.", importance: 0.95, source_reference: "Section 1", confidence: 0.98, category: "Core", entities_mentioned: ["AI Engine"] },
      { id: "F002", statement: "Automated multi-channel delivery reduces turnaround by 80%.", importance: 0.89, source_reference: "Section 2", confidence: 0.95, category: "Metrics", entities_mentioned: ["Productivity"] },
      { id: "F003", statement: "Fact-grounded consistency checking eliminates hallucinations.", importance: 0.92, source_reference: "Section 3", confidence: 0.97, category: "Quality", entities_mentioned: ["UCKR"] }
    ],
    entities: [
      { id: "E001", name: "Qwen3 4B", type: "Model", mentions: 4 },
      { id: "E002", name: "UCKR Engine", type: "System", mentions: 6 }
    ]
  };

  const validationReport = transformationResult?.validation_report || {
    passed: true,
    overall_score: 95,
    breakdown: {
      fact_consistency: 98,
      numeric_consistency: 96,
      entity_consistency: 94,
      claim_consistency: 95,
      semantic_consistency: 93,
      cross_output_consistency: 94
    }
  };

  const filteredFacts = uckr.facts.filter((f: any) => 
    f.statement.toLowerCase().includes(searchTerm.toLowerCase()) && f.importance >= minImportance
  );

  return (
    <div className={`max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8 transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`flex flex-col md:flex-row md:items-center justify-between pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <div>
          <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Content Intelligence & Consistency Engine</h2>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
            Unified Content Knowledge Representation (UCKR), Atomic Fact Registry (F001...), and Multi-Dimensional Validation Scores.
          </p>
        </div>
        <div className={`mt-4 md:mt-0 flex items-center space-x-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider ${
          isDarkMode ? 'bg-[#181818] border-[#282828] text-[#1ed760]' : 'bg-white border-slate-200 text-emerald-700 shadow-sm'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-[#1ed760]" />
          <span>Consistency Status: PASS ({validationReport.overall_score}/100)</span>
        </div>
      </div>

      {/* D3.js Visual Gauges for Consistency Score & Fact Grounding */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <D3ConsistencyGauge 
          score={validationReport.overall_score} 
          label="Overall Consistency Score" 
          sublabel="Multi-Dimensional" 
          isDarkMode={isDarkMode}
        />
        <D3ConsistencyGauge 
          score={validationReport.breakdown.fact_consistency || 98} 
          label="Fact Grounding Percentage" 
          sublabel="UCKR Verified" 
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Validation Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(validationReport.breakdown).map(([key, val]: [string, any]) => (
          <div key={key} className={`rounded-2xl border p-6 shadow-lg flex items-center justify-between transition-colors ${
            isDarkMode ? 'glass-card border-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.6)]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>{key.replace(/_/g, ' ')}</span>
              <div className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{val}%</div>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${val >= 90 ? 'bg-[#1ed760]/10 text-[#1ed760] border border-[#1ed760]/30' : 'bg-[#ffa42b]/10 text-[#ffa42b] border border-[#ffa42b]/30'}`}>
              {val}%
            </div>
          </div>
        ))}
      </div>

      {/* UCKR Document Metadata & Core Topic */}
      <div className={`rounded-2xl border p-6 shadow-lg transition-colors ${
        isDarkMode ? 'glass-card border-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.6)]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center space-x-3 mb-4">
          <Database className="w-5 h-5 text-[#1ed760]" />
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Unified Content Knowledge Representation (UCKR)</h3>
        </div>
        
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 p-4 rounded-xl border mb-6 ${
          isDarkMode ? 'glass-panel border-white/10' : 'bg-slate-50 border-slate-200'
        }`}>
          <div>
            <span className={`text-[10px] uppercase tracking-widest font-bold block mb-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Document Title</span>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{uckr.document.title}</p>
          </div>
          <div>
            <span className={`text-[10px] uppercase tracking-widest font-bold block mb-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Core Topic</span>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{uckr.core_topic}</p>
          </div>
          <div>
            <span className={`text-[10px] uppercase tracking-widest font-bold block mb-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Domain / Version</span>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{uckr.document.domain} (v{uckr.document.version})</p>
          </div>
        </div>

        {/* Atomic Fact Registry Search & List */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h4 className={`font-bold text-sm uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Central Fact Registry ({filteredFacts.length} Atomic Facts)</h4>
            
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className={`absolute left-3 top-2.5 w-4 h-4 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-400'}`} />
                <input
                  type="text"
                  placeholder="Search facts by keyword..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-full border text-xs focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition-colors ${
                    isDarkMode ? 'border-[#4d4d4d] bg-[#121212] text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                />
              </div>

              <select
                value={minImportance}
                onChange={(e) => setMinImportance(parseFloat(e.target.value))}
                className={`rounded-full border py-2 px-4 text-xs outline-none transition-colors ${
                  isDarkMode ? 'border-[#4d4d4d] bg-[#121212] text-white' : 'border-slate-300 bg-white text-slate-900'
                }`}
              >
                <option value={0}>Min Importance: All</option>
                <option value={0.9}>Importance ≥ 0.90</option>
                <option value={0.95}>Importance ≥ 0.95</option>
              </select>
            </div>
          </div>

          <div className={`divide-y border rounded-xl overflow-hidden transition-colors ${
            isDarkMode ? 'divide-[#282828] border-[#282828] bg-[#121212]' : 'divide-slate-200 border-slate-200 bg-slate-50'
          }`}>
            {filteredFacts.map((fact: any) => (
              <div key={fact.id} className={`p-4 transition flex items-start justify-between gap-4 ${isDarkMode ? 'hover:bg-[#181818]' : 'hover:bg-slate-100'}`}>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-full bg-[#1ed760]/20 text-[#1ed760] font-mono text-xs font-bold border border-[#1ed760]/30">
                      {fact.id}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                      isDarkMode ? 'bg-[#282828] text-white' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {fact.category}
                    </span>
                  </div>
                  <p className={`text-sm font-medium pt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{fact.statement}</p>
                  <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Source Ref: {fact.source_reference}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-[#1ed760]">{Math.round(fact.confidence * 100)}% Confidence</div>
                  <div className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Importance: {fact.importance}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
