import React, { useState, useEffect } from 'react';
import { FolderOpen, FileText, Upload, Cloud, Search, Plus, ExternalLink, CheckCircle2, RefreshCw, HardDrive, Shield } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { transformApi } from '../api/transform';
import { checkApiHealth } from '../api/client';

interface GoogleDriveWorkspaceProps {
  onSendToTransform?: (text: string) => void;
}

export const GoogleDriveWorkspace: React.FC<GoogleDriveWorkspaceProps> = ({ onSendToTransform }) => {
  const { isDarkMode } = useTheme();
  const [isConnected, setIsConnected] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Demo content so mock Drive files produce meaningful backend transforms.
  // Real Google Drive file bodies require OAuth + Drive API (not wired — see test notes).
  const sampleContentByFile: Record<string, string> = {
    '1': 'Executive Summary Q3: Company revenue reached $50M in Q3 with 20% quarter-over-quarter growth. Enterprise AI adoption drove productivity gains across sales, support and operations. Key priorities for Q4 are APAC expansion, cost optimization and hiring across engineering.',
    '2': 'Product Strategy and Roadmap: Our AI platform roadmap focuses on multimodal document understanding, visual intelligence with Gemma, and automated video generation. Milestones include beta launch, enterprise pilots, and integrations with Drive and Keep.',
    '3': 'Client Pitch Deck Draft: Problem — enterprises drown in documents. Solution — Gen AI content transformation into summaries, LinkedIn posts, advisories, infographics, presentations and videos. Traction — pilots in healthcare and finance. Ask — partnership for scale.',
    '4': 'Financial Model Projections: Revenue forecast grows from $50M to $80M over four quarters. Gross margin holds near 72%. Assumptions include enterprise seat expansion and API usage growth. Risks include slower procurement cycles.',
    '5': 'AI Transformation Notes: Artificial intelligence and machine learning are revolutionizing industries worldwide, enabling automation, enhanced data analytics, and smarter decision making across healthcare, finance, and software engineering.',
  };

  const getFileContent = (file: any): string =>
    file.content || sampleContentByFile[file.id] || `Content loaded from Google Drive file: ${file.name}`;

  // Simulated Google Drive mock files if API token is not yet active or offline
  const mockDriveFiles = [
    { id: '1', name: 'Executive Summary Q3.docx', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-09-04T10:00:00Z', size: '24 KB' },
    { id: '2', name: 'Product Strategy & Roadmap.pdf', mimeType: 'application/pdf', modifiedTime: '2026-09-03T14:30:00Z', size: '1.2 MB' },
    { id: '3', name: 'Client Pitch Deck Draft.pptx', mimeType: 'application/vnd.google-apps.presentation', modifiedTime: '2026-09-02T09:15:00Z', size: '3.4 MB' },
    { id: '4', name: 'Financial Model Projections.xlsx', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: '2026-09-01T16:45:00Z', size: '512 KB' },
    { id: '5', name: 'AI Transformation Notes.txt', mimeType: 'text/plain', modifiedTime: '2026-08-30T11:20:00Z', size: '8 KB' }
  ];

  useEffect(() => {
    // Backend health for the FastAPI connection badge
    checkApiHealth().then((h) => setBackendStatus(h.ok ? 'online' : 'offline'));
    // Check if token exists in session storage
    const token = sessionStorage.getItem('gdrive_token');
    if (token) {
      setAccessToken(token);
      setIsConnected(true);
      fetchDriveFiles(token);
    } else {
      setFiles(mockDriveFiles);
    }
  }, []);

  const handleConnect = () => {
    // Simulate Google OAuth flow for Drive
    const mockToken = 'ya29.a0AcM61234_mock_google_drive_token_' + Date.now();
    sessionStorage.setItem('gdrive_token', mockToken);
    setAccessToken(mockToken);
    setIsConnected(true);
    setLoading(true);
    setTimeout(() => {
      setFiles(mockDriveFiles);
      setLoading(false);
    }, 600);
  };

  const handleDisconnect = () => {
    sessionStorage.removeItem('gdrive_token');
    setAccessToken('');
    setIsConnected(false);
    setFiles(mockDriveFiles);
  };

  const fetchDriveFiles = async (token: string) => {
    setLoading(true);
    try {
      // In real scenario, call Google Drive API: https://www.googleapis.com/drive/v3/files
      // Fallback to mock files combined with any custom created files
      setTimeout(() => {
        setFiles(mockDriveFiles);
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error(err);
      setFiles(mockDriveFiles);
      setLoading(false);
    }
  };

  const handleUploadNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const newFile = {
      id: Date.now().toString(),
      name: newFileName.endsWith('.txt') ? newFileName : newFileName + '.txt',
      mimeType: 'text/plain',
      modifiedTime: new Date().toISOString(),
      size: `${Math.round(newFileContent.length / 1024) || 1} KB`,
      content: newFileContent,
      blobUrl: URL.createObjectURL(new Blob([newFileContent], { type: 'text/plain;charset=utf-8' })),
      isOriginalUpload: true,
    };

    setFiles([newFile, ...files]);
    setSelectedFile(newFile);
    setNewFileName('');
    setNewFileContent('');
    setUploadStatus('Successfully created and saved to Google Drive!');
    setTimeout(() => setUploadStatus(''), 4000);
  };

  // Connect Drive content → FastAPI: prefill Transform tab + instant /transform preview
  const handleSendToAI = async (file: any) => {
    const text = getFileContent(file);
    onSendToTransform?.(text); // prefills TransformationForm via App keepInitialText
    setAiResult(null);
    setAiError(null);
    setAiLoading(true);
    try {
      const res = await transformApi.transformText({ text, output_types: ['summary'] });
      const out = res.generated_content ?? res.outputs?.summary ?? JSON.stringify(res);
      setAiResult(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Local file → FastAPI POST /transform-file (real backend, needs TXT/PDF/DOCX)
  // Keeps the ORIGINAL file on this page: added to the explorer list with
  // a blob URL so it can be previewed + downloaded below.
  const handleLocalFileTransform = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAiResult(null);
    setAiError(null);
    setAiLoading(true);
    try {
      const blobUrl = URL.createObjectURL(f);
      let textContent = '';
      if (f.name.toLowerCase().endsWith('.txt')) {
        textContent = await f.text();
      }
      const originalEntry = {
        id: `local-${Date.now()}`,
        name: f.name,
        mimeType: f.type || 'application/octet-stream',
        modifiedTime: new Date().toISOString(),
        size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
        content: textContent || undefined,
        blobUrl,
        isOriginalUpload: true,
      };
      setFiles((prev) => [originalEntry, ...prev]);
      setSelectedFile(originalEntry);

      const formData = new FormData();
      formData.append('file', f);
      formData.append('output_types', 'summary');
      const res = await transformApi.transformFile(formData);
      const out = res.generated_content ?? res.outputs?.summary ?? JSON.stringify(res);
      setAiResult(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
      e.target.value = '';
    }
  };

  // Download the ORIGINAL file content for any listed file.
  // Local uploads / created files use their blob URL (byte-identical);
  // mock Drive files download their demo text content as .txt.
  const handleDownloadOriginal = (file: any) => {
    if (file.blobUrl) {
      const a = document.createElement('a');
      a.href = file.blobUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    const blob = new Blob([getFileContent(file)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.toLowerCase().endsWith('.txt') ? file.name : `${file.name}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className={`p-6 max-w-7xl mx-auto space-y-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDarkMode ? 'glass-card border-white/10' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Google Drive Workspace Integration</h1>
            <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
              Browse, search, and manage Google Drive documents, sync transformed outputs, and load documents directly into the AI Engine.
            </p>
            <p className={`text-[11px] mt-1 font-semibold ${backendStatus === 'online' ? 'text-emerald-400' : backendStatus === 'offline' ? 'text-red-400' : 'text-slate-400'}`}>
              FastAPI: {backendStatus === 'checking' ? 'checking…' : backendStatus === 'online' ? 'Connected (localhost:8000)' : 'Offline — start uvicorn'} • Drive API: demo mock (no OAuth wired)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isConnected ? (
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Google Drive Connected</span>
              </span>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow transition flex items-center space-x-2 cursor-pointer"
            >
              <Cloud className="w-4 h-4" />
              <span>Connect Google Drive</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* File Explorer (2 cols) */}
        <div className={`lg:col-span-2 rounded-2xl border p-6 flex flex-col space-y-4 ${
          isDarkMode ? 'glass-card border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Google Drive files..."
                className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode ? 'bg-[#181818] border-[#282828] text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
            <button
              onClick={() => fetchDriveFiles(accessToken)}
              className={`p-2 rounded-xl border flex items-center justify-center transition ${
                isDarkMode ? 'bg-[#181818] border-[#282828] hover:bg-[#282828]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}
              title="Refresh Files"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {filteredFiles.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">No files found in Google Drive matching your query.</div>
            ) : (
              filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => setSelectedFile(file)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    selectedFile?.id === file.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : isDarkMode ? 'border-[#282828] bg-[#181818]/60 hover:border-white/20' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <h4 className="font-semibold text-xs truncate">{file.name}</h4>
                      <p className={`text-[10px] ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                        Modified: {new Date(file.modifiedTime).toLocaleDateString()} • {file.size}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDownloadOriginal(file)}
                      title="Download original file"
                      className={`px-3 py-1.5 rounded-lg border font-bold text-[10px] uppercase tracking-wider transition cursor-pointer ${isDarkMode ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'}`}
                    >
                      Original
                    </button>
                    {onSendToTransform && (
                      <button
                        onClick={() => handleSendToAI(file)}
                        disabled={aiLoading}
                        className="px-3 py-1.5 rounded-lg bg-[#1ed760]/20 hover:bg-[#1ed760]/30 text-[#1ed760] font-bold text-[10px] uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
                      >
                        {aiLoading ? 'Running…' : 'Send to AI'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upload & Create File Panel (1 col) */}
        <div className={`rounded-2xl border p-6 flex flex-col space-y-4 ${
          isDarkMode ? 'glass-card border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <Plus className="w-4 h-4 text-blue-400" />
            <span>Create & Sync to Drive</span>
          </h3>

          {uploadStatus && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
              {uploadStatus}
            </div>
          )}

          <form onSubmit={handleUploadNewFile} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold mb-1 text-slate-400 uppercase tracking-wider">File Name</label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="e.g. Q4_Strategy_Report.txt"
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode ? 'bg-[#181818] border-[#282828] text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1 text-slate-400 uppercase tracking-wider">Document Content</label>
              <textarea
                rows={6}
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                placeholder="Type or paste document text to save directly to Google Drive..."
                className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                  isDarkMode ? 'bg-[#181818] border-[#282828] text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Save File to Google Drive</span>
            </button>
          </form>

          {selectedFile && (
            <div className={`p-4 rounded-xl border mt-4 space-y-2 ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className="text-xs font-bold mb-1 text-blue-400">Original File — available on this page</h4>
              <p className="text-xs font-semibold mb-1">{selectedFile.name}</p>
              <p className={`text-[10px] ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>
                {selectedFile.mimeType} • {selectedFile.size} • Modified {new Date(selectedFile.modifiedTime).toLocaleString()}
                {selectedFile.isOriginalUpload ? ' • Original upload kept locally' : ' • Drive demo copy'}
              </p>
              <p className={`text-[11px] max-h-40 overflow-y-auto whitespace-pre-wrap ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                {getFileContent(selectedFile)}
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadOriginal(selectedFile)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider transition cursor-pointer"
                >
                  Download Original
                </button>
                {selectedFile.blobUrl && (
                  <a
                    href={selectedFile.blobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`px-3 py-1.5 rounded-lg border font-bold text-[10px] uppercase tracking-wider transition ${isDarkMode ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-100'}`}
                  >
                    Open Original
                  </a>
                )}
              </div>
            </div>
          )}

          <div className={`p-4 rounded-xl border space-y-2 ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className="text-xs font-bold">FastAPI Transform Test</h4>
            <label className="block text-[11px] opacity-70">Upload local TXT/PDF/DOCX → POST /transform-file</label>
            <input type="file" accept=".txt,.pdf,.docx" onChange={handleLocalFileTransform} className="text-xs" />
            {aiLoading && <p className="text-xs text-blue-400">Running FastAPI transform…</p>}
            {aiError && <p className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">{aiError}</p>}
            {aiResult && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-1">Summary result (also sent to Transform tab)</p>
                <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{aiResult}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
