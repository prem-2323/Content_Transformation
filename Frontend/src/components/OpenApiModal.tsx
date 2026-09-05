import React from 'react';
import { X, BookOpen, Terminal, CheckCircle2 } from 'lucide-react';

interface OpenApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OpenApiModal: React.FC<OpenApiModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#121212]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-[0_16px_48px_rgba(0,0,0,0.7)] overflow-hidden border border-white/10">
        <div className="px-6 py-4 glass-panel text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-[#1ed760]" />
            <h3 className="font-bold text-base font-serif">OpenAPI 3.1 Specification - Synthetix AI v1.2.0</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-[#b3b3b3] hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-[#b3b3b3]">
          <div>
            <h4 className="font-bold text-white mb-2 uppercase tracking-wider text-xs">Overview</h4>
            <p className="text-[#b3b3b3]">
              Unified AI platform integrating Qwen3 4B for text transformation, Gemma 3 4B for visual analysis, Multimodal pipeline for PDF extraction, Video generation pipeline, and full Content Consistency Engine (UCKR + Atomic Fact IDs + Registry + Grounded Generators).
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-white uppercase tracking-wider text-xs">Core Endpoints</h4>
            <div className="space-y-3 font-mono text-xs">
              <div className="p-4 rounded-xl glass-panel border border-white/10">
                <span className="text-[#ffa42b] font-bold mr-2 uppercase">POST</span>
                <span className="font-semibold text-white">/transform</span>
                <p className="font-sans text-[#b3b3b3] mt-1">Transform direct text input into selected output formats using Qwen3 4B.</p>
              </div>

              <div className="p-4 rounded-xl glass-panel border border-white/10">
                <span className="text-[#ffa42b] font-bold mr-2 uppercase">POST</span>
                <span className="font-semibold text-white">/transform-file</span>
                <p className="font-sans text-[#b3b3b3] mt-1">Extract document content (TXT, PDF, DOCX) and transform into selected output format(s).</p>
              </div>

              <div className="p-4 rounded-xl glass-panel border border-white/10">
                <span className="text-[#ffa42b] font-bold mr-2 uppercase">POST</span>
                <span className="font-semibold text-white">/consistency/pipeline</span>
                <p className="font-sans text-[#b3b3b3] mt-1">Full 7-step Content Consistency Pipeline (Ingestion &rarr; UCKR &rarr; Fact ID Attribution &rarr; Multi-Channel Generation).</p>
              </div>

              <div className="p-4 rounded-xl glass-panel border border-white/10">
                <span className="text-[#ffa42b] font-bold mr-2 uppercase">POST</span>
                <span className="font-semibold text-white">/consistency/quality-score</span>
                <p className="font-sans text-[#b3b3b3] mt-1">Evaluates text or multi-channel deliverables across 6 quantitative dimensions (Readability, Engagement, Information Density, Tone, Coherence, Fact Grounding).</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 glass-panel border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-[1.5px] transition shadow-[0_8px_24px_rgba(30,215,96,0.3)]"
          >
            Close Specification
          </button>
        </div>
      </div>
    </div>
  );
};
