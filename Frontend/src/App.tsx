import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TransformationForm } from './components/TransformationForm';
import { ProcessingView } from './components/ProcessingView';
import { ResultsWorkspace } from './components/ResultsWorkspace';
import { ContentIntelligence } from './components/ContentIntelligence';
import { HistoryWorkspace } from './components/HistoryWorkspace';
import { GeneralChatbot } from './components/GeneralChatbot';
import { ApiExplorer } from './components/ApiExplorer';
import { GoogleKeepWorkspace } from './components/GoogleKeepWorkspace';
import { GoogleDriveWorkspace } from './components/GoogleDriveWorkspace';
import { MultimodalPdfStudio } from './components/MultimodalPdfStudio';
import { VisualAiStudio } from './components/VisualAiStudio';
import { ImageStudio } from './components/ImageStudio';
import { SceneGenerator } from './components/SceneGenerator';
import { VideoPlanner } from './components/VideoPlanner';
import { VideoStudio } from './components/VideoStudio';
import { AudioStudio } from './components/AudioStudio';
import { PresentationStudio } from './components/PresentationStudio';
import { TranslationStudio } from './components/TranslationStudio';
import { FactRegistry } from './components/FactRegistry';
import { ConsistencyPipeline } from './components/ConsistencyPipeline';
import { QualityScoreDashboard } from './components/QualityScoreDashboard';
import { AudienceReframer } from './components/AudienceReframer';
import { BrandVoiceStudio } from './components/BrandVoiceStudio';
import { BottomNavbar } from './components/BottomNavbar';
import { OpenApiModal } from './components/OpenApiModal';
import { HomePage } from './components/HomePage';
import { LoginPage } from './components/LoginPage';
import { doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from './lib/firebase';
import { useTheme } from './context/ThemeContext';
import { transformApi, normalizeOutputTypes } from './api/transform';

export default function App() {
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<string>('transform');
  const [currentView, setCurrentView] = useState<'home' | 'app' | 'login'>('home');
  const [user, setUser] = useState<any>(null);
  const [transformationResult, setTransformationResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [loadedSession, setLoadedSession] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [keepInitialText, setKeepInitialText] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentView === 'login') {
        setCurrentView('app');
      }
    });
    return () => unsubscribe();
  }, [currentView]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setCurrentView('home');
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const handleRunTransform = async (payload: any, isFile: boolean) => {
    setIsLoading(true);
    setTransformError(null);
    try {
      let data;
      if (isFile) {
        const formData = new FormData();
        formData.append('file', payload.file);
        formData.append('audience', payload.audience);
        formData.append('tone', payload.tone);
        formData.append('language', payload.language);
        formData.append('detail_level', payload.detail_level);
        formData.append('objective', payload.objective);
        if (payload.output_types) {
          // Normalize display names (e.g. "Twitter/X Post") to backend canonical
          // types (e.g. "twitter") — same mapping as the text path.
          const normalized = normalizeOutputTypes(payload.output_types) ?? payload.output_types;
          formData.append('output_types', normalized.join(','));
        }
        data = await transformApi.transformFile(formData);
      } else {
        data = await transformApi.transformText(payload);
      }
      // Carry the requested MP3 add-ons on the result so ResultsWorkspace can
      // offer on-demand neural narration (POST /generate-audio) for them.
      if (payload.mp3_addons?.length && data && typeof data === 'object') {
        data = { ...data, mp3_addons: payload.mp3_addons };
      }
      setTransformationResult(data);

      // Save to localStorage history
      const historyItem = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        sourceText: isFile
          ? `[File Upload]: ${payload.file?.name}`
          : payload.url
            ? `[URL]: ${payload.url}`
            : payload.text,
        config: {
          audience: payload.audience,
          tone: payload.tone,
          language: payload.language,
          detail_level: payload.detail_level,
          objective: payload.objective,
          output_types: payload.output_types
        },
        result: data
      };

      const existingHistory = JSON.parse(localStorage.getItem('contentforge_transformation_history') || localStorage.getItem('synthetix_transformation_history') || '[]');
      const updatedHistory = [historyItem, ...existingHistory];
      localStorage.setItem('contentforge_transformation_history', JSON.stringify(updatedHistory));

      try {
        await setDoc(doc(db, 'history', historyItem.id), historyItem);
      } catch (err) {
        console.error("Failed to save history to Firestore:", err);
      }

      setActiveTab('processing');
    } catch (error) {
      console.error("Transformation error:", error);
      setTransformError(error instanceof Error ? error.message : 'Transformation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSession = (session: any) => {
    setTransformationResult(session.result);
    setActiveTab('results');
  };

  const handleSendToTransformFromKeep = (text: string) => {
    // Prefill the Transform tab — TransformationForm only reads initialSourceText on mount,
    // so store it and remount via key below.
    if (text) setKeepInitialText(text);
    setActiveTab('transform');
  };

  return (
    <div className={`h-screen ${isDarkMode ? 'dark bg-[#121212] text-[#b3b3b3]' : 'bg-slate-50 text-slate-800'} flex flex-col font-sans selection:bg-[#1ed760] selection:text-black relative overflow-hidden transition-colors duration-300`}>
      {/* 1. AI Background: Subtle Animated Gradient & Dot Grid & Floating Moving/Stable Bubbles */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Stable gradient glows */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#1ed760]/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[150px] animate-pulse-glow" style={{ animationDelay: '3s' }} />
        <div className="absolute -bottom-40 left-1/3 w-[450px] h-[450px] bg-green-400/10 rounded-full blur-[130px] animate-pulse-glow" style={{ animationDelay: '5s' }} />
        <div className="absolute inset-0 bg-dot-pattern opacity-40" />
        
        {/* Moving floating bubbles (glass spheres) */}
        <div className="absolute top-[15%] left-[10%] w-24 h-24 rounded-full bg-gradient-to-br from-[#1ed760]/20 to-emerald-500/5 backdrop-blur-md border border-[#1ed760]/20 animate-float-slow shadow-lg" />
        <div className="absolute top-[65%] left-[80%] w-32 h-32 rounded-full bg-gradient-to-br from-emerald-400/15 to-[#1ed760]/5 backdrop-blur-md border border-emerald-400/20 animate-float-delayed shadow-lg" style={{ animationDuration: '12s' }} />
        <div className="absolute top-[40%] left-[85%] w-16 h-16 rounded-full bg-gradient-to-br from-[#1ed760]/25 to-teal-500/10 backdrop-blur-sm border border-[#1ed760]/30 animate-float-slow" style={{ animationDuration: '7s' }} />
        <div className="absolute top-[75%] left-[15%] w-20 h-20 rounded-full bg-gradient-to-br from-green-500/15 to-[#1ed760]/10 backdrop-blur-sm border border-green-500/20 animate-float-delayed" style={{ animationDuration: '10s' }} />

        {/* Stable small particle dots */}
        <div className="absolute top-1/4 left-1/5 w-2 h-2 rounded-full bg-[#1ed760]/40 animate-pulse" />
        <div className="absolute top-2/3 right-1/4 w-3 h-3 rounded-full bg-emerald-400/30 animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-1/2 left-3/4 w-1.5 h-1.5 rounded-full bg-[#1ed760]/50" />

        {/* Top-to-Bottom Flowing Bubbles / Streams */}
        <div className="absolute left-[20%] w-3 h-3 rounded-full bg-[#1ed760]/40 animate-flow-down" style={{ animationDelay: '0s', animationDuration: '7s' }} />
        <div className="absolute left-[45%] w-4 h-4 rounded-full bg-emerald-400/35 animate-flow-down" style={{ animationDelay: '2.5s', animationDuration: '9s' }} />
        <div className="absolute left-[70%] w-2.5 h-2.5 rounded-full bg-[#1ed760]/50 animate-flow-down" style={{ animationDelay: '1s', animationDuration: '6s' }} />
        <div className="absolute left-[88%] w-3.5 h-3.5 rounded-full bg-green-500/30 animate-flow-down" style={{ animationDelay: '4s', animationDuration: '11s' }} />
        <div className="absolute left-[10%] w-3 h-3 rounded-full bg-emerald-500/40 animate-flow-down" style={{ animationDelay: '3s', animationDuration: '8s' }} />
      </div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenDocs={() => setIsDocsOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          user={user}
          onSignOut={handleSignOut}
          onGoHome={() => setCurrentView('home')}
          onGoLogin={() => setCurrentView('login')}
        />

        {currentView === 'login' && !user ? (
          <LoginPage
            onLoginSuccess={(loggedInUser) => {
              setUser(loggedInUser);
              setCurrentView('app');
            }}
          />
        ) : currentView === 'home' && !user ? (
          <HomePage
            onStart={() => {
              if (user) {
                setCurrentView('app');
              } else {
                setCurrentView('login');
              }
            }}
          />
        ) : (
          <div className="app-layout flex-1 flex min-h-0 overflow-hidden w-full h-full">
            <Sidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              user={user}
              onSignOut={handleSignOut}
              onGoLogin={() => setCurrentView('login')}
            />

            <main className="main-content flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden">
              {transformError && (
                <div className="mx-auto mt-4 max-w-6xl rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {transformError} Please reduce the number of selected outputs and try again.
                </div>
              )}

              {activeTab === 'transform' && (
                <TransformationForm
                  key={keepInitialText || 'default'}
                  onRunTransform={handleRunTransform}
                  isLoading={isLoading}
                  onCancel={() => setIsLoading(false)}
                  initialSourceText={keepInitialText || undefined}
                />
              )}

              {activeTab === 'processing' && (
                <ProcessingView
                  onComplete={() => setActiveTab('results')}
                  onCancel={() => {
                    setIsLoading(false);
                    setActiveTab('transform');
                  }}
                />
              )}

              {activeTab === 'results' && (
                <ResultsWorkspace
                  transformationResult={transformationResult}
                  onNavigateToIntelligence={() => setActiveTab('intelligence')}
                />
              )}

              {activeTab === 'intelligence' && (
                <ContentIntelligence
                  transformationResult={transformationResult}
                />
              )}

              {activeTab === 'multimodal' && (
                <MultimodalPdfStudio
                  onCompleteResult={(res) => {
                    setTransformationResult(res);
                    setActiveTab('results');
                  }}
                />
              )}

              {activeTab === 'visual' && (
                <VisualAiStudio />
              )}

              {activeTab === 'image' && (
                <ImageStudio />
              )}

              {activeTab === 'scene' && (
                <SceneGenerator />
              )}

              {activeTab === 'video_plan' && (
                <VideoPlanner />
              )}

              {activeTab === 'video' && (
                <VideoStudio />
              )}

              {activeTab === 'audio' && (
                <AudioStudio />
              )}

              {activeTab === 'presentation' && (
                <PresentationStudio />
              )}

              {activeTab === 'translation' && (
                <TranslationStudio />
              )}

              {activeTab === 'audience' && (
                <AudienceReframer />
              )}

              {activeTab === 'brand_voice' && (
                <BrandVoiceStudio />
              )}

              {activeTab === 'registry' && (
                <FactRegistry />
              )}

              {activeTab === 'pipeline' && (
                <ConsistencyPipeline />
              )}

              {activeTab === 'quality' && (
                <QualityScoreDashboard />
              )}

              {activeTab === 'keep' && (
                <GoogleKeepWorkspace
                  onSendToTransform={handleSendToTransformFromKeep}
                />
              )}

              {activeTab === 'gdrive' && (
                <GoogleDriveWorkspace
                  onSendToTransform={handleSendToTransformFromKeep}
                />
              )}

              {activeTab === 'chatbot' && (
                <GeneralChatbot />
              )}

              {activeTab === 'history' && (
                <HistoryWorkspace
                  onLoadSession={handleLoadSession}
                />
              )}

              {activeTab === 'api' && (
                <ApiExplorer />
              )}
            </main>

            <BottomNavbar activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        )}
      </div>

      <OpenApiModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />
    </div>
  );
}
