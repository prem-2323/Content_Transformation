import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { consistencyApi } from '../api/consistency';

export const FactRegistry: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [sourceId, setSourceId] = useState('source_demo_123');
  const [facts, setFacts] = useState<any[]>([
    { id: 'F001', claim: 'Enterprise revenue reached $50M in Q4.', type: 'Financial', value: '$50M', source: 'Q4 Report', status: 'Verified' },
    { id: 'F002', claim: 'User retention improved by 34% following AI rollout.', type: 'Metric', value: '34%', source: 'Analytics', status: 'Verified' },
    { id: 'F003', claim: 'Global deployment completed across 12 regions.', type: 'Operational', value: '12', source: 'DevOps Log', status: 'Warning' }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFacts = async () => {
    setIsLoading(true);
    try {
      const res = await consistencyApi.getRegistryFacts(sourceId);
      if (Array.isArray(res)) setFacts(res);
      else if (res.facts) setFacts(res.facts);
    } catch (e) {
      // Keep fallback mock data if backend not connected yet
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFacts();
  }, [sourceId]);

  return (
    <div className={`max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`pb-4 border-b ${isDarkMode ? 'border-[#282828]' : 'border-slate-200'} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <h2 className={`text-2xl font-bold tracking-tight font-serif ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Atomic Fact Registry</h2>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-600'}`}>
            Audit atomic fact IDs (<code className="text-[#1ed760]">F001</code>, <code className="text-[#1ed760]">F002</code>) and consistency statuses via <code className="text-[#1ed760]">GET /consistency/registry/{sourceId}/facts</code>.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <input
            type="text"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border w-48 ${isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
            placeholder="Source ID..."
          />
          <button
            onClick={fetchFacts}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-[#1ed760] hover:bg-[#1db954] text-black text-xs font-bold uppercase tracking-wider flex items-center space-x-2 shadow cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            <span>Refresh Facts</span>
          </button>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-xl overflow-hidden ${
        isDarkMode ? 'bg-[#181818] border-[#282828]' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b uppercase tracking-wider text-[10px] ${
              isDarkMode ? 'bg-[#121212] border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <tr>
                <th className="px-6 py-3 font-bold">Fact ID</th>
                <th className="px-6 py-3 font-bold">Claim / Assertion</th>
                <th className="px-6 py-3 font-bold">Type</th>
                <th className="px-6 py-3 font-bold">Value</th>
                <th className="px-6 py-3 font-bold">Source</th>
                <th className="px-6 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {facts.map((fact: any) => (
                <tr key={fact.id} className={`transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                  <td className="px-6 py-4 font-mono font-bold text-[#1ed760]">{fact.id}</td>
                  <td className="px-6 py-4 font-medium max-w-md">{fact.claim}</td>
                  <td className="px-6 py-4"><span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px]">{fact.type}</span></td>
                  <td className="px-6 py-4 font-mono font-bold">{fact.value}</td>
                  <td className="px-6 py-4 text-slate-400">{fact.source}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      fact.status === 'Verified' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {fact.status === 'Verified' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      <span>{fact.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
