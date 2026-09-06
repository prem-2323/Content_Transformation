import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Trash2, Loader2, MessageSquare, Plus, Mic, MicOff, Volume2, Square, Paperclip } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../context/ThemeContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const GeneralChatbot: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your Synthetix AI Assistant. How can I help you with your content transformation, fact-checking, or strategy today?' }
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSend = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText !== undefined ? customText : input;
    if (!textToSend.trim() || isSending) return;

    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    setIsSending(true);

    try {
      const res = await fetch('http://localhost:8000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });
      const data = await res.json();
      const reply = data.reply || "I am here to assist with your content transformation tasks.";
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages([...newMessages, { role: 'assistant', content: "Could not reach the AI backend. Make sure Ollama is running and FastAPI is started on port 8000." }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileContent = event.target?.result as string;
      const snippet = fileContent ? fileContent.slice(0, 1000) : '';
      const promptText = `[Uploaded File: ${file.name}]\nContent snippet:\n${snippet}\n\nPlease analyze and summarize this file.`;
      handleSend(undefined, promptText);
    };

    if (file.type.startsWith('image/')) {
      handleSend(undefined, `[Uploaded Image: ${file.name}] Please analyze this image.`);
    } else {
      reader.readAsText(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleToggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${speechToText}` : speechToText));
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleToggleSpeech = (index: number, text: string) => {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in your browser.");
      return;
    }

    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  const handleClearChat = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeakingIndex(null);
    setMessages([
      { role: 'assistant', content: 'Chat history cleared. How can I assist you further?' }
    ]);
  };

  return (
    <div className={`max-w-5xl mx-auto py-8 px-4 sm:px-6 h-[calc(100vh-120px)] flex flex-col ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`flex items-center justify-between pb-4 mb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'}`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-[#1ed760]/20 text-[#1ed760] flex items-center justify-center border border-[#1ed760]/30 shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Synthetix AI Assistant</h2>
            <p className={`text-xs ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>Local AI powered by Ollama &middot; Qwen3 4B</p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition border ${
            isDarkMode 
              ? 'bg-[#181818] hover:bg-[#282828] text-[#b3b3b3] hover:text-white border-[#4d4d4d]' 
              : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-300 shadow-sm'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Chat</span>
        </button>
      </div>

      {/* Chat Messages Container */}
      <div className={`flex-1 rounded-2xl border shadow-lg p-6 overflow-y-auto space-y-4 mb-4 transition-colors duration-300 ${
        isDarkMode ? 'glass-card border-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.6)]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        {messages.map((msg, index) => {
          const isAssistant = msg.role === 'assistant';
          return (
            <div
              key={index}
              className={`flex items-start space-x-3 ${isAssistant ? '' : 'flex-row-reverse space-x-reverse'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isAssistant 
                  ? 'bg-[#1ed760]/20 text-[#1ed760] border border-[#1ed760]/30' 
                  : isDarkMode ? 'bg-[#282828] text-white border border-[#4d4d4d]' : 'bg-slate-200 text-slate-800 border border-slate-300'
              }`}>
                {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div className={`max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed relative group ${
                isAssistant
                  ? isDarkMode 
                    ? 'glass-panel text-white border-white/10 rounded-tl-none' 
                    : 'bg-slate-100 text-slate-900 border border-slate-200 rounded-tl-none'
                  : 'bg-[#1ed760] text-black font-medium rounded-tr-none shadow-md'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {isAssistant && (
                  <div className={`mt-2 pt-2 border-t flex items-center justify-end ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                    <button
                      onClick={() => handleToggleSpeech(index, msg.content)}
                      className={`p-1 rounded transition flex items-center space-x-1 text-xs ${
                        isDarkMode ? 'hover:bg-[#282828] text-[#b3b3b3] hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                      title={speakingIndex === index ? "Stop Narration" : "Play Narration"}
                    >
                      {speakingIndex === index ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                          <span className="text-red-400 font-semibold">Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-[#1ed760]" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#1ed760]/20 text-[#1ed760] flex items-center justify-center border border-[#1ed760]/30">
              <Bot className="w-4 h-4" />
            </div>
            <div className={`border px-4 py-3 rounded-2xl rounded-tl-none flex items-center space-x-2 ${
              isDarkMode ? 'bg-[#121212] border-[#282828] text-[#b3b3b3]' : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}>
              <Loader2 className="w-4 h-4 animate-spin text-[#1ed760]" />
              <span className="text-xs">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box with Media (+) and Mic buttons */}
      <form onSubmit={(e) => handleSend(e)} className={`rounded-2xl border p-3 shadow-lg flex items-center space-x-3 transition-colors duration-300 ${
        isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200 shadow-md'
      }`}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*,.txt,.pdf,.doc,.docx,.csv,.json"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`p-3 rounded-xl border transition flex items-center justify-center ${
            isDarkMode ? 'bg-[#121212] hover:bg-[#282828] border-[#4d4d4d] text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
          }`}
          title="Upload media or document (+)"
        >
          <Plus className="w-4 h-4 text-[#1ed760]" />
        </button>

        <div className="relative flex items-center">
          {isRecording && (
            <motion.div
              className="absolute -inset-2 rounded-2xl bg-red-500/20 border border-red-500/40 pointer-events-none"
              animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            />
          )}
          <button
            type="button"
            onClick={handleToggleMic}
            className={`p-3 rounded-xl border transition flex items-center justify-center relative z-10 ${
              isRecording 
                ? 'bg-red-500/30 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                : isDarkMode ? 'bg-[#121212] hover:bg-[#282828] border-[#4d4d4d] text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
            }`}
            title={isRecording ? "Listening... Click to stop" : "Voice input (microphone)"}
          >
            {isRecording ? <MicOff className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4 text-[#1ed760]" />}
          </button>
        </div>

        {/* Recording waveform indicator if active */}
        {isRecording && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded-lg">
            <motion.div className="w-1 bg-red-500 rounded-full" animate={{ height: [6, 18, 6] }} transition={{ repeat: Infinity, duration: 0.5 }} />
            <motion.div className="w-1 bg-red-500 rounded-full" animate={{ height: [12, 4, 16] }} transition={{ repeat: Infinity, duration: 0.4 }} />
            <motion.div className="w-1 bg-red-500 rounded-full" animate={{ height: [8, 20, 10] }} transition={{ repeat: Infinity, duration: 0.6 }} />
            <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider ml-1">Recording...</span>
          </div>
        )}

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isRecording ? "Listening to your voice..." : "Ask anything about your content, strategy, or facts..."}
          className={`flex-1 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1ed760] transition-colors ${
            isDarkMode 
              ? 'bg-[#121212] border-[#4d4d4d] text-white placeholder-[#b3b3b3]' 
              : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
          }`}
        />

        <button
          type="submit"
          disabled={!input.trim() || isSending}
          className="px-6 py-3 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition disabled:opacity-50 shadow-[0_4px_12px_rgba(30,215,96,0.3)] shrink-0"
        >
          <span>Send</span>
          <Send className="w-4 h-4 fill-black" />
        </button>
      </form>
    </div>
  );
};

