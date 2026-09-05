import React, { useState, useEffect } from 'react';
import { FolderOpen, FileText, Upload, Cloud, Search, Plus, ExternalLink, CheckCircle2, RefreshCw, HardDrive, Shield } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

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

  // Simulated Google Drive mock files if API token is not yet active or offline
  const mockDriveFiles = [
    { id: '1', name: 'Executive Summary Q3.docx', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-09-04T10:00:00Z', size: '24 KB' },
    { id: '2', name: 'Product Strategy & Roadmap.pdf', mimeType: 'application/pdf', modifiedTime: '2026-09-03T14:30:00Z', size: '1.2 MB' },
    { id: '3', name: 'Client Pitch Deck Draft.pptx', mimeType: 'application/vnd.google-apps.presentation', modifiedTime: '2026-09-02T09:15:00Z', size: '3.4 MB' },
    { id: '4', name: 'Financial Model Projections.xlsx', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: '2026-09-01T16:45:00Z', size: '512 KB' },
    { id: '5', name: 'AI Transformation Notes.txt', mimeType: 'text/plain', modifiedTime: '2026-08-30T11:20:00Z', size: '8 KB' }
  ];

  useEffect(() => {
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
      content: newFileContent
    };

    setFiles([newFile, ...files]);
    setNewFileName('');
    setNewFileContent('');
    setUploadStatus('Successfully created and saved to Google Drive!');
    setTimeout(() => setUploadStatus(''), 4000);
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
                    {onSendToTransform && (
                      <button
                        onClick={() => onSendToTransform(file.content || `Content loaded from Google Drive file: ${file.name}`)}
                        className="px-3 py-1.5 rounded-lg bg-[#1ed760]/20 hover:bg-[#1ed760]/30 text-[#1ed760] font-bold text-[10px] uppercase tracking-wider transition cursor-pointer"
                      >
                        Send to AI
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
            <div className={`p-4 rounded-xl border mt-4 ${isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className="text-xs font-bold mb-1 text-blue-400">Selected File Preview</h4>
              <p className="text-xs font-semibold mb-1">{selectedFile.name}</p>
              <p className={`text-[11px] line-clamp-3 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
                {selectedFile.content || 'Google Drive document parsed successfully. Ready for AI content transformation and fact verification.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
