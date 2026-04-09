import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  RefreshCw, 
  HardDrive, 
  Info,
  AlertTriangle,
  XCircle,
  SortDesc,
  Clock,
  X,
  Settings,
  Trash2,
  Database,
  ArrowRight,
  Hash,
  SortAsc,
  CheckSquare,
  Square
} from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { Loader } from '../components/common/Loader';
import { ViewType } from '../navigation';

export function LogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [deviceId, setDeviceId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [isGrouped, setIsGrouped] = useState(false); 
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'sources' | 'cleanup'>('sources');
  const [retentionDays, setRetentionDays] = useState('30');
  const [manualCleanupRange, setManualCleanupRange] = useState({ 
    start: '', 
    end: '', 
    deviceIds: [] as (number | string)[] 
  });
  const [isCleaning, setIsCleaning] = useState(false);
  const limit = 50;

  const fetchRetention = async () => {
    try {
      const res = await authFetch('/api/settings/log_retention_days');
      const data = await res.json();
      if (data.value) setRetentionDays(data.value);
    } catch (e) { console.error(e); }
  };

  const saveRetentionPolicy = async () => {
    try {
      await authFetch('/api/settings/log_retention_days', {
         method: 'POST',
         body: JSON.stringify({ value: retentionDays })
      });
      alert('Retention policy updated successfully');
    } catch (e) { alert('Failed to update policy'); }
  };

  const toggleDeviceLogs = async (id: number, enabled: boolean) => {
    try {
      await authFetch(`/api/mikrotiks/${id}/toggle-logs`, {
         method: 'POST', body: JSON.stringify({ enabled })
      });
      fetchDevices();
    } catch (e) { console.error(e); }
  };

  const runManualCleanup = async () => {
    if (!window.confirm('Are you sure you want to PERMANENTLY delete logs in this range?')) return;
    setIsCleaning(true);
    try {
      const res = await authFetch('/api/logs/manual-cleanup', {
         method: 'POST',
         body: JSON.stringify({
            startDate: manualCleanupRange.start,
            endDate: manualCleanupRange.end,
            deviceIds: manualCleanupRange.deviceIds.length > 0 ? manualCleanupRange.deviceIds : null
         })
      });
      const data = await res.json();
      alert(data.message || 'Cleanup finished');
      fetchLogs();
    } catch (e) { alert('Cleanup failed'); }
    finally { setIsCleaning(false); }
  };

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
      grouped: String(isGrouped),
      sort: sortOrder,
      startDate: startDate,
      endDate: endDate
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
  }, [deviceId, topicFilter, page, isGrouped, sortOrder, startDate, endDate]);

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
    <div className="p-6 md:p-8 animate-in fade-in duration-500 min-h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8 shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-400" /> Persistent System Logs
          </h2>
          <p className="text-zinc-400 mt-1">Archive of router activities for long-term retention.</p>
        </div>
        
        <div className="flex items-center gap-4">
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
              onClick={() => setIsFilterModalOpen(true)}
              className={`p-2.5 border rounded-xl transition-all shadow-lg flex items-center gap-2 ${
                deviceId || topicFilter || startDate || endDate 
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/20' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
           >
             <Filter className="w-5 h-5" />
           </button>

            <button 
               onClick={() => {
                  setIsSettingsModalOpen(true);
                  fetchRetention();
               }}
               className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all shadow-lg"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button 
               onClick={() => fetchLogs()}
               className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all shadow-lg"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      {/* Simplified Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 shrink-0">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search message content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-xl"
          />
        </form>
        
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1">
           <button 
             onClick={() => { setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); setPage(1); }}
             className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${sortOrder === 'desc' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
           >
              {sortOrder === 'desc' ? <SortDesc size={14} /> : <SortAsc size={14} />}
              <span className="text-[10px] font-bold uppercase tracking-wider">{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
           </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative">
        <div className="flex-1 overflow-x-auto overflow-y-auto no-scrollbar">
          <div className="min-w-[800px] md:min-w-0">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-zinc-900/80 border-b border-zinc-800 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-40">Time</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-32">Topic</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-40">Device</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-20">
                        <Loader message="Synchronizing persistent logs..." />
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
                    <td className="px-6 py-4 text-xs font-mono text-zinc-400">
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
        </div>

        {/* Pagination bar */}
        <div className="px-6 py-4 bg-zinc-900/50 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
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

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                <div className="flex items-center gap-3">
                   <Filter className="w-5 h-5 text-indigo-400" />
                   <h3 className="text-lg font-bold text-white tracking-tight">Advanced Filters</h3>
                </div>
                <button onClick={() => setIsFilterModalOpen(false)} className="p-2 hover:bg-rose-500/10 rounded-lg text-rose-500 hover:text-rose-400 transition-colors">
                   <X className="w-5 h-5" />
                </button>
             </div>
             
             <div className="p-6 space-y-6">
                <div>
                   <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Target Router</label>
                   <select 
                     value={deviceId} 
                     onChange={(e) => { setDeviceId(e.target.value); setPage(1); }}
                     className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                   >
                     <option value="">All Routers</option>
                     {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                   </select>
                </div>

                <div>
                   <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Log Topic</label>
                   <select 
                     value={topicFilter} 
                     onChange={(e) => { setTopicFilter(e.target.value); setPage(1); }}
                     className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Start</label>
                      <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white" />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">End</label>
                      <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white" />
                   </div>
                </div>
             </div>
             <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 flex gap-3">
                <button onClick={() => setIsFilterModalOpen(false)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg">Apply</button>
                <button onClick={() => { setDeviceId(''); setTopicFilter(''); setStartDate(''); setEndDate(''); }} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold transition-all">Reset</button>
             </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600/20 rounded-2xl text-indigo-400">
                       <Settings className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="text-xl font-bold text-white tracking-tight">Log Settings</h3>
                    </div>
                 </div>
                 <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 hover:bg-rose-500/10 rounded-xl text-rose-500 hover:text-rose-400 transition-all">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="flex p-2 bg-zinc-950/30 border-b border-zinc-800">
                 <button onClick={() => setSettingsTab('sources')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${settingsTab === 'sources' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'}`}>Sources</button>
                 <button onClick={() => setSettingsTab('cleanup')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${settingsTab === 'cleanup' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'}`}>Cleanup</button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                 {settingsTab === 'sources' ? (
                    <div className="space-y-4">
                       {devices.map(device => (
                          <div key={device.id} className="flex items-center justify-between p-4 bg-zinc-950/40 border border-zinc-800/50 rounded-2xl">
                             <div>
                                <p className="font-bold text-zinc-200">{device.name}</p>
                                <p className="text-[10px] text-zinc-500 font-mono">{device.host}</p>
                             </div>
                             <button 
                                onClick={() => toggleDeviceLogs(device.id, !device.logs_enabled)}
                                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all ${device.logs_enabled ? 'bg-emerald-600' : 'bg-zinc-700'}`}
                             >
                                <span className={`h-4 w-4 transform rounded-full bg-white transition-transform ${device.logs_enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                             </button>
                          </div>
                       ))}
                    </div>
                 ) : (
                    <div className="space-y-10">
                       <section>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Keep logs for (days)</label>
                          <div className="flex gap-4">
                             <input type="number" value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white font-bold" />
                             <button onClick={saveRetentionPolicy} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-8 font-bold transition-all">Save</button>
                          </div>
                       </section>
                       <section>
                          <h4 className="font-bold text-white uppercase text-xs tracking-widest mb-6">Manual Deletion</h4>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                             <input type="datetime-local" value={manualCleanupRange.start} onChange={(e) => setManualCleanupRange({...manualCleanupRange, start: e.target.value})} className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm" />
                             <input type="datetime-local" value={manualCleanupRange.end} onChange={(e) => setManualCleanupRange({...manualCleanupRange, end: e.target.value})} className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm" />
                          </div>
                          <button 
                             onClick={runManualCleanup} 
                             disabled={isCleaning || !manualCleanupRange.start || !manualCleanupRange.end}
                             className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 ${isCleaning ? 'bg-zinc-800' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}
                          >
                             {isCleaning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                             {isCleaning ? 'Processing...' : 'Delete Window Now'}
                          </button>
                       </section>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
