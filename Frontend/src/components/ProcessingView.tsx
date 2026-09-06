import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles, Square, AlertOctagon } from 'lucide-react';
import { motion } from 'motion/react';

interface ProcessingViewProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({ onComplete, onCancel }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const steps = [
    { title: "Step 1: Source Ingestion & Normalization", desc: "Converting input into NormalizedSource structure" },
    { title: "Step 2: Content Understanding & LLM Analysis", desc: "Extracting core topics, sections, and tables via Qwen3 4B" },
    { title: "Step 3: UCKR Knowledge Representation Construction", desc: "Building Unified Content Knowledge Representation graph" },
    { title: "Step 4: Atomic Fact ID Attribution", desc: "Assigning unique atomic fact IDs (F001, F002...) to statements" },
    { title: "Step 5: Central Fact Registry Integration", desc: "Indexing facts for search, verification, and integrity checks" },
    { title: "Step 6: Fact-Grounded Multi-Channel Generation", desc: "Generating Executive Summary, LinkedIn, Advisory, Infographic, Slides, & Video" },
    { title: "Step 7: Multi-Dimensional Consistency Audit & Scoring", desc: "Evaluating fact, numeric, entity, and semantic consistency scores" }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(timer);
          setIsFinished(true);
          setTimeout(onComplete, 1200);
          return prev;
        }
      });
    }, 550);

    return () => clearInterval(timer);
  }, [onComplete]);

  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  // Generate subtle confetti particles
  const confettiParticles = Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100 - 50,
    y: Math.random() * -100 - 20,
    rotate: Math.random() * 360,
    scale: Math.random() * 0.6 + 0.4,
    color: i % 2 === 0 ? '#1ed760' : '#ffffff',
    delay: Math.random() * 0.3
  }));

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 relative flex items-center justify-center min-h-[80vh]">
      {/* Subtle Confetti Overlay upon completion */}
      {isFinished && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-20">
          {confettiParticles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, x: 0, y: 0, scale: 0, rotate: 0 }}
              animate={{
                opacity: [1, 1, 0],
                x: p.x * 6,
                y: p.y * 4 - 50,
                scale: p.scale * 1.5,
                rotate: p.rotate + 360,
              }}
              transition={{ duration: 1.2, ease: "easeOut", delay: p.delay }}
              className="absolute w-3 h-3 rounded-sm shadow-md"
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>
      )}

      <div className="w-full bg-[#181818] rounded-2xl border border-[#282828] shadow-[0_12px_40px_rgba(0,0,0,0.7)] p-8 text-center relative z-10 backdrop-blur-xl">
        <div className="w-16 h-16 rounded-full bg-[#1ed760]/20 text-[#1ed760] flex items-center justify-center mx-auto mb-6 border border-[#1ed760]/30 shadow-inner relative">
          {isFinished ? (
            <Sparkles className="w-8 h-8 text-[#1ed760] animate-bounce" />
          ) : (
            <Loader2 className="w-8 h-8 animate-spin text-[#1ed760]" />
          )}
        </div>

        <h2 className="text-2xl font-bold text-white font-serif">
          {isFinished ? "Transformation Complete!" : "Transforming Content..."}
        </h2>
        <p className="text-sm text-[#b3b3b3] mt-2">
          {isFinished ? "Successfully generated fact-grounded multi-channel deliverables." : `Executing 7-Step UCKR Consistency Pipeline (${progressPercent}%)`}
        </p>

        {/* Progress Bar */}
        <div className="mt-8">
          <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-[#b3b3b3] mb-2">
            <span>Pipeline Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-[#121212] rounded-full h-3 overflow-hidden border border-[#282828]">
            <div
              className="bg-[#1ed760] h-3 rounded-full transition-all duration-500 ease-out shadow-[0_0_16px_rgba(30,215,96,0.6)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="mt-8 space-y-3 text-left max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex || isFinished;
            const isCurrent = idx === currentStepIndex && !isFinished;
            const isPending = idx > currentStepIndex && !isFinished;

            return (
              <div
                key={idx}
                className={`flex items-start space-x-3 p-3 rounded-xl border transition-all ${
                  isCompleted
                    ? 'border-[#1ed760]/30 bg-[#1ed760]/10 shadow-sm'
                    : isCurrent
                    ? 'border-[#1ed760]/50 bg-[#1ed760]/15 shadow-sm'
                    : 'border-[#282828] bg-[#1f1f1f]/50 opacity-40'
                }`}
              >
                <div className="mt-0.5">
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-[#1ed760]" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 text-[#1ed760] animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-[#4d4d4d] bg-[#121212]" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{step.title}</h4>
                  <p className="text-xs text-[#b3b3b3]">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stop Transformation Button */}
        {!isFinished && onCancel && (
          <div className="mt-6 pt-4 border-t border-[#282828] flex justify-center">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 hover:text-red-300 text-xs font-extrabold uppercase tracking-wider flex items-center space-x-2 transition cursor-pointer shadow-lg shadow-red-500/10 group"
            >
              <Square className="w-4 h-4 fill-red-400 group-hover:fill-red-300 transition" />
              <span>Stop Transformation</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

