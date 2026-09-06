import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles, Square, X, Zap, Brain, ShieldCheck, Layers, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProcessingViewProps {
  onComplete: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({ onComplete, onCancel }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const steps = [
    { title: "Step 1: Source Ingestion & Normalization", desc: "Converting text/documents into NormalizedSource structure", icon: FileText },
    { title: "Step 2: Content Understanding & LLM Analysis", desc: "Extracting core topics, sections, and tables via Qwen3 4B", icon: Brain },
    { title: "Step 3: UCKR Knowledge Representation Construction", desc: "Building Unified Content Knowledge Representation graph", icon: Layers },
    { title: "Step 4: Atomic Fact ID Attribution System", desc: "Assigning unique atomic fact IDs (F001, F002...) to statements", icon: Zap },
    { title: "Step 5: Central Fact Registry Integration", desc: "Indexing facts for search, verification, and integrity checks", icon: ShieldCheck },
    { title: "Step 6: Fact-Grounded Multi-Channel Generation", desc: "Generating Summary, LinkedIn, Advisory, Infographic, Slides & Script", icon: Sparkles },
    { title: "Step 7: Multi-Dimensional Consistency Audit & Scoring", desc: "Evaluating fact, numeric, entity, and semantic consistency scores", icon: CheckCircle2 }
  ];

  // Smooth 0 to 100% Progress Animation over exactly 5 seconds
  useEffect(() => {
    // 0 to 100% counter timer (50ms per 1% = 5000ms = 5 seconds)
    const progressInterval = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev < 100) {
          return prev + 1;
        }
        return 100;
      });
    }, 48);

    // Step index timer (~700ms per step across 7 steps = 5 seconds)
    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(stepInterval);
          clearInterval(progressInterval);
          setProgressPercent(100);
          setIsFinished(true);
          setTimeout(onComplete, 600);
          return prev;
        }
      });
    }, 680);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, [onComplete, steps.length]);

  // Generate confetti particles for completion pop
  const confettiParticles = Array.from({ length: 36 }).map((_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 400,
    y: (Math.random() - 0.5) * 350,
    rotate: Math.random() * 720,
    scale: Math.random() * 0.7 + 0.5,
    color: i % 3 === 0 ? '#1ed760' : i % 3 === 1 ? '#10b981' : '#ffffff',
    delay: Math.random() * 0.2
  }));

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl overflow-y-auto animate-fade-in">
      {/* Background Ambient Glowing Bubbles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1ed760]/15 rounded-full blur-[140px] pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse-glow" style={{ animationDelay: '2s' }} />

      {/* Confetti Explosion on 100% Finish */}
      {isFinished && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-30">
          {confettiParticles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, x: 0, y: 0, scale: 0.2, rotate: 0 }}
              animate={{
                opacity: [1, 1, 0],
                x: p.x,
                y: p.y,
                scale: p.scale,
                rotate: p.rotate,
              }}
              transition={{ duration: 1.1, ease: "easeOut", delay: p.delay }}
              className="absolute w-3 h-3 rounded-full shadow-lg"
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>
      )}

      {/* Pop-Up Modal Container */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 320, damping: 25 }}
        className="w-full max-w-xl bg-[#141414] border border-[#282828] rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.9)] p-6 sm:p-8 relative z-20 text-center overflow-hidden"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-[#282828] pb-4 mb-6">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1ed760]/20 border border-[#1ed760]/40 flex items-center justify-center text-[#1ed760]">
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-white tracking-wide">UCKR Consistency Engine</h3>
              <p className="text-[11px] text-[#b3b3b3]">7-Step Grounded Transformation</p>
            </div>
          </div>

          {onCancel && !isFinished && (
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-full bg-[#282828] hover:bg-red-500/20 text-[#b3b3b3] hover:text-red-400 border border-[#3e3e3e] flex items-center justify-center transition cursor-pointer"
              title="Cancel Transformation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 0 to 100 Progress Ring & Number Display */}
        <div className="relative my-4 flex flex-col items-center justify-center">
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* Background SVG Circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r={radius}
                className="stroke-[#242424]"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r={radius}
                className="stroke-[#1ed760] transition-all duration-300 ease-out"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Inner Percentage Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                key={progressPercent}
                initial={{ scale: 0.9, opacity: 0.7 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl font-black text-white font-mono tracking-tighter"
              >
                {progressPercent}%
              </motion.span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#1ed760] mt-0.5">
                {isFinished ? "COMPLETED" : "EXECUTING"}
              </span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mt-4 font-serif">
            {isFinished ? "Transformation Complete!" : "Transforming Content..."}
          </h2>
          <p className="text-xs text-[#b3b3b3] mt-1">
            {isFinished
              ? "Successfully compiled UCKR facts and multi-channel deliverables."
              : `Executing step ${currentStepIndex + 1} of ${steps.length}: ${steps[currentStepIndex].title}`}
          </p>
        </div>

        {/* Dynamic Linear Progress Bar */}
        <div className="my-6">
          <div className="flex justify-between text-[11px] font-extrabold uppercase tracking-wider text-[#b3b3b3] mb-1.5">
            <span>Progress Status</span>
            <span className="text-[#1ed760]">{progressPercent}%</span>
          </div>
          <div className="w-full bg-[#1c1c1c] rounded-full h-2.5 overflow-hidden border border-[#2e2e2e]">
            <div
              className="bg-gradient-to-r from-[#1ed760] to-emerald-400 h-2.5 rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(30,215,96,0.7)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Pipeline Step List */}
        <div className="mt-4 space-y-2 text-left max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex || isFinished;
            const isCurrent = idx === currentStepIndex && !isFinished;
            const StepIcon = step.icon;

            return (
              <div
                key={idx}
                className={`flex items-center space-x-3 p-2.5 rounded-xl border transition-all ${
                  isCompleted
                    ? 'border-[#1ed760]/30 bg-[#1ed760]/10 text-white'
                    : isCurrent
                    ? 'border-[#1ed760] bg-[#1ed760]/20 text-white shadow-[0_0_15px_rgba(30,215,96,0.2)] scale-[1.01]'
                    : 'border-[#242424] bg-[#181818]/40 text-[#666666] opacity-50'
                }`}
              >
                <div className="flex-shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-[#1ed760]" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-[#1ed760] animate-spin" />
                  ) : (
                    <StepIcon className="w-4 h-4 text-[#444444]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold truncate text-white">{step.title}</h4>
                  <p className="text-[10px] text-[#b3b3b3] truncate">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        {!isFinished && onCancel && (
          <div className="mt-6 pt-4 border-t border-[#282828] flex justify-center">
            <button
              onClick={onCancel}
              className="px-5 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 hover:text-red-300 text-xs font-extrabold uppercase tracking-wider flex items-center space-x-2 transition cursor-pointer shadow-lg shadow-red-500/10"
            >
              <Square className="w-3.5 h-3.5 fill-red-400" />
              <span>Cancel Transformation</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
