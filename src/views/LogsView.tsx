import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Calendar, 
  RefreshCw, 
  HardDrive, 
  Info,
  AlertTriangle,
  XCircle,
  Hash
} from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { ViewType } from '../navigation';

export function LogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [deviceId, setDeviceId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [isGrouped, setIsGrouped] = useState(false); // Default mode normal
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchDevices = () => {
    authFetch('/api/mikrotiks')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDevices(data);
      });
  };

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      device_id: deviceId,
      search: searchTerm,
      topics: topicFilter,
      grouped: String(isGrouped)
    });
    
    authFetch(`/api/logs?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setLogs(data.data || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [deviceId, topicFilter, page, isGrouped]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getTopicColor = (topics: string) => {
    const t = topics.toLowerCase();
    if (t.includes('critical') || t.includes('error')) return 'text-red-400 bg-red-400/10 border-red-400/20';
    if (t.includes('warning')) return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    if (t.includes('account') || t.includes('info')) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
  };

  return (
    <div className="p-6 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-400" /> Persistent System Logs
          </h2>
          <p className="text-zinc-400 mt-1">Archive of router activities, archived in database for long-term retention.</p>
        </div>
        
        <div className="flex items-center gap-4">
           {/* Seed Data Button (For testing) */}
           <button 
              onClick={() => {
                if (confirm('Isi database dengan 20 data log demo untuk simulasi?')) {
                  authFetch('/api/logs/seed', { method: 'POST' }).then(() => fetchLogs());
                }
              }}
              className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-[10px] font-bold uppercase hover:bg-amber-500/20 transition-all"
           >
             Seed Demo Data
           </button>

           {/* Smart Grouping Toggle */}
           <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Smart Grouping</span>
              <button 
                onClick={() => { setIsGrouped(!isGrouped); setPage(1); }}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${isGrouped ? 'bg-indigo-600' : 'bg-zinc-700'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isGrouped ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
           </div>

           <button 
              onClick={() => fetchLogs()}
              className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all shadow-lg"
              title="Refresh Logs"
           >
             <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="relative">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <select 
            value={deviceId} 
            onChange={(e) => { setDeviceId(e.target.value); setPage(1); }}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          >
            <option value="">All Routers</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <select 
            value={topicFilter} 
            onChange={(e) => { setTopicFilter(e.target.value); setPage(1); }}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          >
            <option value="">All Topics</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
            <option value="account">Accounts</option>
            <option value="wireless">Wireless</option>
          </select>
        </div>

        <form onSubmit={handleSearch} className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search Keyword (e.g. login failure, authenticated...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <button type="submit" className="hidden">Search</button>
        </form>
      </div>

      {/* Logs Table */}
      <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-zinc-900/80 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-40">
                  {isGrouped ? 'Last Seen' : 'Time (Router)'}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-32">Topic</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-40">Device</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {loading ? (
                <tr>
                   <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-zinc-500">
                        <RefreshCw className="w-8 h-8 animate-spin opacity-20" />
                        <p className="text-sm font-medium animate-pulse">Fetching archived logs...</p>
                      </div>
                   </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                   <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-zinc-500">
                        <FileText className="w-12 h-12 opacity-10" />
                        <p>No log entries found match your filter.</p>
                      </div>
                   </td>
                </tr>
              ) : logs.map((log, idx) => (
                <tr key={isGrouped ? `grp-${idx}` : log.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4 text-xs font-mono text-zinc-400 group-hover:text-zinc-300">
                    {isGrouped ? new Date(log.last_seen).toLocaleString() : log.time}
                  </td>
                  <td className="px-6 py-4">
                     <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getTopicColor(log.topics)}`}>
                       {log.topics}
                     </span>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                        <Info className="w-3.5 h-3.5 text-indigo-500/50" />
                        {log.device_name}
                     </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      {isGrouped && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-black rounded-md shadow-lg shadow-indigo-500/20">
                          {log.occurrences}x
                        </span>
                      )}
                      <p className={`text-sm leading-relaxed ${log.topics.toLowerCase().includes('error') || log.topics.toLowerCase().includes('critical') ? 'text-red-300/80' : 'text-zinc-300'}`}>
                        {log.message}
                      </p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination bar remains same */}
        <div className="px-6 py-4 bg-zinc-900/50 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-zinc-500">
            Showing <span className="text-white font-bold">{logs.length}</span> of <span className="text-white font-bold">{total}</span> persistent logs
          </p>
          <div className="flex items-center gap-2">
            <button 
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <span className="text-xs font-mono text-zinc-500 mx-2">Page {page} of {Math.ceil(total/limit) || 1}</span>
            <button 
              disabled={page >= Math.ceil(total/limit)}
              onClick={() => setPage(page + 1)}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

