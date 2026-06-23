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
  Square,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Sparkles,
  Send,
  Bot,
  User,
  HelpCircle
} from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { Loader } from '../components/common/Loader';
import { ViewType } from '../navigation';
import { useTranslation } from 'react-i18next';

export function LogsView() {
  const { t } = useTranslation();
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
  
  // Log Report State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportRange, setReportRange] = useState<'7' | '30' | 'custom'>('7');
  const [reportDevice, setReportDevice] = useState('');
  const [reportTopic, setReportTopic] = useState('');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportGrouped, setReportGrouped] = useState(false);
  const [reportIsGrouped, setReportIsGrouped] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [settingsTab, setSettingsTab] = useState<'sources' | 'cleanup'>('sources');
  const [retentionDays, setRetentionDays] = useState('30');
  const [manualCleanupRange, setManualCleanupRange] = useState({ 
    start: '', 
    end: '', 
    deviceIds: [] as (number | string)[] 
  });
  const [isCleaning, setIsCleaning] = useState(false);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(0);

  // AI Chat States
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'ai'; text: string; queryRun?: any; logsFoundCount?: number }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');

  const sendChatMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    
    // Add User Message
    const userMsg = { sender: 'user' as const, text: textToSend };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setAiChatLoading(true);
    
    // AI Status progression
    setAiStatusMessage('Menerjemahkan pertanyaan Anda ke filter...');
    
    const statusIntervals = [
      setTimeout(() => setAiStatusMessage('Mengquery database log sistem...'), 1500),
      setTimeout(() => setAiStatusMessage('Menganalisis log yang ditemukan...'), 3500)
    ];

    try {
      const res = await authFetch('/api/logs-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      });
      
      statusIntervals.forEach(clearTimeout);

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, {
          sender: 'ai',
          text: data.response,
          queryRun: data.queryRun,
          logsFoundCount: data.logsFoundCount
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          sender: 'ai',
          text: 'Maaf, saya gagal terhubung ke server AI.'
        }]);
      }
    } catch (e) {
      statusIntervals.forEach(clearTimeout);
      console.error(e);
      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: 'Terjadi kesalahan jaringan saat memanggil AI.'
      }]);
    } finally {
      setAiChatLoading(false);
      setAiStatusMessage('');
    }
  };

  const askAiAboutSpecificLog = (message: string, topics: string, deviceName: string) => {
    setIsAiChatOpen(true);
    const query = `Jelaskan mengapa ada log ini dan apa solusi troubleshootingnya: [Router: ${deviceName}] [Topik: ${topics}] "${message}"`;
    sendChatMessage(query);
  };

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
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ value: retentionDays })
      });
      alert('Retention policy updated successfully');
    } catch (e) { alert('Failed to update policy'); }
  };

  const toggleDeviceLogs = async (id: number, enabled: boolean) => {
    // Optimistic UI Update: immediately change the status in the UI for instant feedback
    setDevices(prevDevices => 
      prevDevices.map(d => d.id === id ? { ...d, logs_enabled: enabled ? 1 : 0 } : d)
    );
    try {
      await authFetch(`/api/mikrotiks/${id}/toggle-logs`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ enabled })
      });
      fetchDevices(); // Sync with server database state
    } catch (e) { 
      console.error(e);
      // Revert optimistic update on failure
      setDevices(prevDevices => 
        prevDevices.map(d => d.id === id ? { ...d, logs_enabled: enabled ? 0 : 1 } : d)
      );
    }
  };

  const runManualCleanup = async () => {
    if (!window.confirm('Are you sure you want to PERMANENTLY delete logs in this range?')) return;
    setIsCleaning(true);
    try {
      const res = await authFetch('/api/logs/manual-cleanup', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
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

  const generateReport = async () => {
    setGeneratingReport(true);
    setReportData(null);
    try {
      const params = new URLSearchParams();
      if (reportRange === 'custom') {
        if (reportStartDate) params.append('startDate', reportStartDate);
        if (reportEndDate) params.append('endDate', reportEndDate);
      } else {
        params.append('preset', reportRange);
      }
      if (reportDevice) params.append('device_id', reportDevice);
      if (reportTopic) params.append('topics', reportTopic);
      params.append('grouped', String(reportGrouped));

      const res = await authFetch(`/api/logs/export-report?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Gagal menyusun laporan dari server.');
      }
      const data = await res.json();
      if (data && data.error) {
        throw new Error(data.error);
      }
      setReportData(data);
      setReportIsGrouped(reportGrouped);
    } catch (e) {
      alert('Gagal menyusun laporan log. Silakan pastikan server backend Anda telah direstart agar perubahan route terbaru aktif.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const exportToCSV = () => {
    if (!reportData || !reportData.logs) return;

    let csvContent = '\uFEFF'; // Add BOM for Excel UTF-8 support
    
    // Metadata Header
    csvContent += `"LAPORAN AKTIVITAS LOG JARINGAN"\n`;
    csvContent += `"Sistem Monitoring & Rekapitulasi Log Router MikroTik"\n`;
    csvContent += `"Periode:","${new Date(reportData.startDate).toLocaleString('id-ID')} s.d ${new Date(reportData.endDate).toLocaleString('id-ID')}"\n`;
    csvContent += `"Total Log Dianalisis:","${reportData.totalLogs}"\n`;
    csvContent += `"Dibuat Pada:","${new Date().toLocaleString('id-ID')}"\n`;
    csvContent += `"Status Pengelompokan:","${reportIsGrouped ? 'Smart Grouping (Terkelompok)' : 'Detail (Semua Log)'}"\n\n`;

    // Table Headers & Rows
    if (reportIsGrouped) {
      csvContent += `"No","Router","Topik","Pesan Aktivitas","Frekuensi (Occurrences)","Pertama Terlihat","Terakhir Terlihat"\n`;
      reportData.logs.forEach((l: any, idx: number) => {
        csvContent += `${idx + 1},${escapeCSV(l.device_name || 'System')},${escapeCSV(l.topics)},${escapeCSV(l.message)},${l.occurrences},${escapeCSV(new Date(l.first_seen).toLocaleString('id-ID'))},${escapeCSV(new Date(l.last_seen).toLocaleString('id-ID'))}\n`;
      });
    } else {
      csvContent += `"No","Waktu","Router","Topik","Pesan Aktivitas"\n`;
      reportData.logs.forEach((l: any, idx: number) => {
        csvContent += `${idx + 1},${escapeCSV(new Date(l.created_at).toLocaleString('id-ID'))},${escapeCSV(l.device_name || 'System')},${escapeCSV(l.topics)},${escapeCSV(l.message)}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `Laporan_Log_${reportIsGrouped ? 'Grouped' : 'Detail'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        setTotalPages(data.totalPages || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [deviceId, topicFilter, page, limit, isGrouped, sortOrder, startDate, endDate]);

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
    <div className="p-6 md:p-8 animate-in fade-in duration-500 min-h-full flex flex-col lg:flex-row gap-6 relative">
      <div className="flex-1 flex flex-col min-w-0">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8 shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-400" /> {t('logs.title')}
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
               onClick={() => {
                 setReportRange('7');
                 setReportDevice(deviceId);
                 setReportTopic(topicFilter);
                 setReportStartDate(startDate);
                 setReportEndDate(endDate);
                 setReportGrouped(isGrouped);
                 setReportData(null);
                 setIsReportModalOpen(true);
               }}
               className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 border border-violet-500/20"
            >
               <Download className="w-4 h-4" /> Laporan & Ekspor
            </button>

           <button 
              onClick={() => setIsFilterModalOpen(true)}
              className={`p-2.5 border rounded-xl transition-all shadow-lg flex items-center gap-2 ${
                deviceId || topicFilter || startDate || endDate 
                ? 'bg-indigo-600 border-indigo-500 text-white-fixed shadow-indigo-500/20' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white-fixed'
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
                onClick={() => setIsAiChatOpen(!isAiChatOpen)}
                className={`p-2.5 border rounded-xl transition-all shadow-lg flex items-center gap-2 ${
                  isAiChatOpen 
                  ? 'bg-purple-600 border-purple-500 text-white-fixed shadow-purple-500/20' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white-fixed'
                }`}
                title="Asisten AI Chat"
             >
               <Sparkles className="w-5 h-5" />
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
             className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${sortOrder === 'desc' ? 'bg-indigo-600 text-white-fixed' : 'bg-zinc-800 text-zinc-400'}`}
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
                      {isGrouped ? new Date(log.last_seen).toLocaleString() : new Date(log.created_at).toLocaleString()}
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
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {isGrouped && (
                            <span className="flex-shrink-0 px-2 py-0.5 bg-indigo-500 text-white-fixed text-[10px] font-black rounded-md shadow-lg shadow-indigo-500/20">
                              {log.occurrences}x
                            </span>
                          )}
                          <p className={`text-sm leading-relaxed ${log.topics.toLowerCase().includes('error') || log.topics.toLowerCase().includes('critical') ? 'text-red-300/80' : 'text-zinc-300'}`}>
                            {log.message}
                          </p>
                        </div>
                        <button
                          onClick={() => askAiAboutSpecificLog(log.message, log.topics, log.device_name || 'System')}
                          className="opacity-0 group-hover:opacity-100 transition-all px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 rounded border border-purple-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ml-2"
                          title="Tanyakan AI tentang log ini"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Tanya AI
                        </button>
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
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">Show per page</span>
               <select 
                 value={limit}
                 onChange={(e) => {
                   setLimit(parseInt(e.target.value));
                   setPage(1);
                 }}
                 className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer"
               >
                 <option value={10}>10</option>
                 <option value={25}>25</option>
                 <option value={50}>50</option>
                 <option value={100}>100</option>
                 <option value={250}>250</option>
               </select>
             </div>
             <p className="text-xs text-zinc-500">
               Showing <span className="text-white font-bold">{logs.length}</span> of <span className="text-white font-bold">{total}</span> persistent logs
             </p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button 
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1 mx-2">
               <span className="text-xs font-bold text-indigo-400 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md">
                 {page}
               </span>
               <span className="text-xs text-zinc-600 font-bold">/</span>
               <span className="text-xs text-zinc-500 font-bold">
                 {totalPages || 1}
               </span>
            </div>

            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* AI Assistant Chat Drawer */}
      {isAiChatOpen && (
        <div className="w-full lg:w-[400px] shrink-0 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col h-[600px] lg:h-auto shadow-2xl relative overflow-hidden animate-in slide-in-from-right duration-300">
           {/* Panel Header */}
           <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/80 shrink-0">
              <div className="flex items-center gap-2">
                 <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                 <h3 className="font-bold text-white text-sm">Asisten AI Log Jaringan</h3>
              </div>
              <button 
                onClick={() => setIsAiChatOpen(false)} 
                className="p-1 hover:bg-zinc-850 rounded text-zinc-500 hover:text-white transition-colors"
              >
                 <X className="w-4 h-4" />
              </button>
           </div>

           {/* Chat Message History */}
           <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar flex flex-col bg-zinc-900/30">
              {chatMessages.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500 my-auto">
                    <Bot className="w-10 h-10 text-purple-500/40 mb-3 animate-bounce" />
                    <p className="text-xs font-bold text-zinc-400 mb-1">Tanya Asisten AI Log</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xs mb-6">
                       Tanyakan masalah log, mintalah penjelasan error, atau kueri waktu spesifik log. AI akan mencari dan menganalisis database secara cerdas.
                    </p>
                    
                    {/* Predefined chips */}
                    <div className="w-full space-y-2">
                       <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-650 mb-2">Pertanyaan Populer</p>
                       {[
                         "Ada error apa saja 3 jam terakhir?",
                         "Mengapa ada warning system reboot?",
                         "Apakah ada deauth wireless kemarin?",
                         "Cari error pada router core hari ini"
                       ].map((q, i) => (
                          <button 
                            key={i}
                            type="button"
                            onClick={() => sendChatMessage(q)}
                            className="w-full text-left p-2.5 bg-zinc-950/50 hover:bg-indigo-600/10 border border-zinc-800 hover:border-indigo-500/30 rounded-xl text-[11px] text-zinc-400 hover:text-indigo-300 font-medium transition-all cursor-pointer"
                          >
                             {q}
                          </button>
                       ))}
                    </div>
                 </div>
              ) : (
                 chatMessages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                    >
                       <div className="flex items-center gap-1.5 mb-1">
                          {msg.sender === 'user' ? (
                             <>
                               <span className="text-[9px] font-bold text-zinc-500 uppercase">Anda</span>
                               <User className="w-3 h-3 text-zinc-500" />
                             </>
                          ) : (
                             <>
                               <Bot className="w-3 h-3 text-purple-400" />
                               <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider font-mono">Nexus AI</span>
                             </>
                          )}
                       </div>
                       
                       <div className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line text-left ${
                          msg.sender === 'user' 
                          ? 'bg-purple-600 text-white rounded-tr-none shadow-md shadow-purple-600/10' 
                          : 'bg-zinc-850 border border-zinc-800 text-zinc-200 rounded-tl-none'
                       }`}>
                          {msg.text}
                       </div>
                       
                       {/* Query Run Info for transparency */}
                       {msg.sender === 'ai' && msg.queryRun && (
                          <div className="mt-1.5 p-2.5 bg-zinc-950/60 border border-zinc-850 rounded-xl text-[9px] text-zinc-500 w-full font-mono flex flex-col gap-0.5 text-left">
                             <p className="font-bold text-zinc-400 uppercase text-[8px] tracking-wider mb-1">⚙️ Kueri Log Dijalankan:</p>
                             <p>• Rentang: {msg.queryRun.startDate} s/d {msg.queryRun.endDate}</p>
                             {msg.queryRun.deviceName && <p>• Router: {msg.queryRun.deviceName}</p>}
                             {msg.queryRun.topics && <p>• Topik: {msg.queryRun.topics}</p>}
                             {msg.queryRun.search && <p>• Kata Kunci: "{msg.queryRun.search}"</p>}
                             <p className="text-[8px] font-bold mt-1 text-indigo-400 uppercase">🔍 Log Ditemukan: {msg.logsFoundCount} baris</p>
                          </div>
                       )}
                    </div>
                 ))
              )}

              {/* Loader */}
              {aiChatLoading && (
                 <div className="self-start flex flex-col items-start max-w-[85%]">
                    <div className="flex items-center gap-1.5 mb-1">
                       <Bot className="w-3 h-3 text-purple-400 animate-spin" />
                       <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider font-mono animate-pulse">Nexus AI</span>
                    </div>
                    <div className="p-3 bg-zinc-850 border border-zinc-800 text-zinc-400 rounded-2xl rounded-tl-none flex flex-col gap-2 w-full text-left">
                       <div className="flex items-center gap-2">
                          <div className="w-3 h-3 border border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
                          <span className="text-[11px] font-semibold">{aiStatusMessage}</span>
                       </div>
                       <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-100" />
                          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-200" />
                       </div>
                    </div>
                 </div>
              )}
           </div>

           {/* Input bar */}
           <form 
             onSubmit={(e) => { e.preventDefault(); sendChatMessage(chatInput); }}
             className="p-3 border-t border-zinc-800 bg-zinc-950 flex gap-2 shrink-0"
           >
              <input 
                type="text"
                placeholder="Tanyakan error, kueri logs..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={aiChatLoading}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 placeholder:text-zinc-650"
              />
              <button 
                type="submit"
                disabled={aiChatLoading || !chatInput.trim()}
                className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                 <Send className="w-3.5 h-3.5" />
              </button>
           </form>
        </div>
      )}

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
                     <option value="">{t('logs.allDevices')}</option>
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
                     <option value="">{t('logs.all')}</option>
                     <option value="info">{t('logs.info')}</option>
                     <option value="warning">{t('logs.warning')}</option>
                     <option value="error">{t('logs.error')}</option>
                     <option value="critical">{t('logs.critical')}</option>
                     <option value="account">Accounts</option>
                     <option value="wireless">Wireless</option>
                   </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Start</label>
                      <input 
                        type="datetime-local" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                        onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white" 
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">End</label>
                      <input 
                        type="datetime-local" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                        onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white" 
                      />
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
                                 type="button"
                                 onClick={() => toggleDeviceLogs(device.id, device.logs_enabled !== 1)}
                                 className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all ${device.logs_enabled === 1 ? 'bg-emerald-600' : 'bg-zinc-700'}`}
                              >
                                 <span className={`h-4 w-4 transform rounded-full bg-white transition-transform ${device.logs_enabled === 1 ? 'translate-x-7' : 'translate-x-1'}`} />
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
                             <input 
                               type="datetime-local" 
                               value={manualCleanupRange.start} 
                               onChange={(e) => setManualCleanupRange({...manualCleanupRange, start: e.target.value})} 
                               onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                               className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm" 
                             />
                             <input 
                               type="datetime-local" 
                               value={manualCleanupRange.end} 
                               onChange={(e) => setManualCleanupRange({...manualCleanupRange, end: e.target.value})} 
                               onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                               className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm" 
                             />
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

      {/* Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
             <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50 print-hide">
                <div className="flex items-center gap-3">
                   <FileText className="w-5 h-5 text-indigo-400" />
                   <h3 className="text-lg font-bold text-white tracking-tight">Ekspor & Cetak Laporan Log</h3>
                </div>
                <button onClick={() => setIsReportModalOpen(false)} className="p-2 hover:bg-rose-500/10 rounded-lg text-rose-500 hover:text-rose-400 transition-colors">
                   <X className="w-5 h-5" />
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Print Styles Injection */}
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    #printable-report-area, #printable-report-area * {
                      visibility: visible;
                    }
                    #printable-report-area {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                      background: white !important;
                      color: black !important;
                      padding: 20px 30px;
                    }
                    .print-hide {
                      display: none !important;
                    }
                    .bg-zinc-950, .bg-zinc-900, .bg-zinc-800, .bg-zinc-900\\/50, .bg-zinc-900\\/40 {
                      background-color: #f8fafc !important;
                      color: #0f172a !important;
                      border-color: #cbd5e1 !important;
                    }
                    .text-white, .text-zinc-100, .text-zinc-200, .text-zinc-300 {
                      color: #0f172a !important;
                    }
                    .text-zinc-400, .text-zinc-500 {
                      color: #475569 !important;
                    }
                    /* Formal Print Styles for PDF */
                    table {
                      border-collapse: collapse;
                      width: 100%;
                      margin-top: 15px;
                    }
                    th, td {
                      border: 1px solid #cbd5e1 !important;
                      color: #0f172a !important;
                      padding: 8px 10px !important;
                      font-size: 11px !important;
                    }
                    th {
                      background-color: #f1f5f9 !important;
                      font-weight: bold !important;
                    }
                    .print-section-title {
                      border-left: 3px solid #3b82f6 !important;
                      padding-left: 8px !important;
                      color: #0f172a !important;
                      font-weight: bold !important;
                    }
                  }
                `}</style>

                {/* Filter / Settings Section in Modal */}
                <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-2xl p-5 space-y-4 print-hide">
                   <h4 className="text-sm font-bold text-zinc-300">Konfigurasi Laporan</h4>
                   
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                         <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Rentang Waktu</label>
                         <select 
                           value={reportRange}
                           onChange={(e) => setReportRange(e.target.value as any)}
                           className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                         >
                            <option value="7">7 Hari Terakhir</option>
                            <option value="30">30 Hari Terakhir</option>
                            <option value="custom">Rentang Kustom</option>
                         </select>
                      </div>

                      <div>
                         <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Target Router</label>
                         <select 
                           value={reportDevice}
                           onChange={(e) => setReportDevice(e.target.value)}
                           className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                         >
                            <option value="">Semua Perangkat</option>
                            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                         </select>
                      </div>

                      <div>
                         <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Topik Log</label>
                         <select 
                           value={reportTopic}
                           onChange={(e) => setReportTopic(e.target.value)}
                           className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                         >
                            <option value="">Semua Topik</option>
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="error">Error</option>
                            <option value="critical">Critical</option>
                            <option value="account">Accounts</option>
                            <option value="wireless">Wireless</option>
                         </select>
                      </div>

                      <div>
                         <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Smart Grouping</label>
                         <div className="flex items-center h-8">
                            <button 
                              onClick={() => setReportGrouped(!reportGrouped)}
                              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${reportGrouped ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                            >
                              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${reportGrouped ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                            <span className="text-xs text-zinc-400 ml-2 font-medium">Aktifkan</span>
                         </div>
                      </div>
                   </div>

                   {reportRange === 'custom' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/50">
                         <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Mulai Tanggal</label>
                            <input 
                              type="datetime-local" 
                              value={reportStartDate} 
                              onChange={(e) => setReportStartDate(e.target.value)} 
                              onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white" 
                            />
                         </div>
                         <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Sampai Tanggal</label>
                            <input 
                              type="datetime-local" 
                              value={reportEndDate} 
                              onChange={(e) => setReportEndDate(e.target.value)} 
                              onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white" 
                            />
                         </div>
                      </div>
                   )}

                   <div className="flex justify-end pt-2">
                      <button 
                        onClick={generateReport}
                        disabled={generatingReport}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-white font-bold rounded-xl text-xs transition-all shadow-lg flex items-center gap-2"
                      >
                         {generatingReport ? (
                            <>
                               <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menyusun Laporan...
                            </>
                         ) : (
                            <>
                               <Settings className="w-3.5 h-3.5" /> Susun Laporan Log
                            </>
                         )}
                      </button>
                   </div>
                </div>

                {/* Report Content Display */}
                {generatingReport && (
                   <div className="py-20 flex flex-col items-center justify-center gap-4">
                      <Loader message="Sedang memindai database log dan menyusun laporan..." />
                   </div>
                )}

                {!generatingReport && !reportData && (
                   <div className="py-20 border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-zinc-500 text-sm">
                      <FileText className="w-12 h-12 opacity-20" />
                      <p>Silakan klik tombol "Susun Laporan Log" untuk menghasilkan analisis log dan data ekspor.</p>
                   </div>
                )}

                {!generatingReport && reportData && (
                   <div id="printable-report-area" className="bg-zinc-950/20 border border-zinc-800/80 rounded-2xl p-6 md:p-8 space-y-8 text-zinc-300">
                      {/* Report Header */}
                      <div className="border-b border-zinc-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 font-sans">
                         <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">LAPORAN AKTIVITAS LOG JARINGAN</h2>
                            <p className="text-xs text-zinc-500 mt-1">Sistem Monitoring & Rekapitulasi Log Router MikroTik</p>
                         </div>
                         <div className="text-left md:text-right text-xs space-y-1">
                            <p className="font-mono text-zinc-400"><strong>Periode:</strong> {new Date(reportData.startDate).toLocaleString('id-ID')} s.d {new Date(reportData.endDate).toLocaleString('id-ID')}</p>
                            <p className="text-zinc-500"><strong>Total Log:</strong> {reportData.totalLogs} Log</p>
                            <p className="text-zinc-500"><strong>Dibuat Pada:</strong> {new Date().toLocaleString('id-ID')}</p>
                            <p className="text-zinc-400"><strong>Status Pengelompokan:</strong> {reportIsGrouped ? 'Smart Grouping Aktif' : 'Detail Aktivitas'}</p>
                         </div>
                      </div>

                      {/* Section 1: Ringkasan Metrics */}
                      <div className="space-y-4 font-sans">
                         <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 border-l-2 border-indigo-500 pl-3 print-section-title">I. Ringkasan Parameter & Volume</h3>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-zinc-900/40 p-4 border border-zinc-800/60 rounded-xl">
                               <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Target Perangkat</p>
                               <p className="text-lg font-bold text-white">
                                  {reportDevice ? (devices.find(d => String(d.id) === String(reportDevice))?.name || `ID: ${reportDevice}`) : 'Semua Router'}
                               </p>
                            </div>
                            <div className="bg-zinc-900/40 p-4 border border-zinc-800/60 rounded-xl">
                               <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Kategori Topik</p>
                               <p className="text-lg font-bold text-white capitalize">{reportTopic || 'Semua Topik'}</p>
                            </div>
                            <div className="bg-zinc-900/40 p-4 border border-zinc-800/60 rounded-xl">
                               <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Entri Data</p>
                               <p className="text-lg font-bold text-white">{reportData.totalLogs} Baris Log</p>
                            </div>
                         </div>
                      </div>

                      {/* Section 2: Topic Statistics */}
                      <div className="space-y-4 font-sans">
                         <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400 border-l-2 border-sky-500 pl-3 print-section-title">II. Distribusi & Statistik Kategori Log</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                               <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Persentase Topik Log</p>
                               <div className="space-y-2 bg-zinc-900/40 p-4 border border-zinc-800/60 rounded-xl">
                                  {reportData.topicStats.length === 0 ? (
                                     <p className="text-xs text-zinc-600">Tidak ada data statistik topik.</p>
                                  ) : (
                                     reportData.topicStats.map((t: any, idx: number) => {
                                        const percent = reportData.totalLogs > 0 ? (t.count / reportData.totalLogs) * 100 : 0;
                                        return (
                                           <div key={idx} className="space-y-1">
                                              <div className="flex justify-between text-xs font-mono">
                                                 <span className="capitalize">{t.topics}</span>
                                                 <span>{t.count} ({percent.toFixed(1)}%)</span>
                                              </div>
                                              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                                 <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${percent}%` }}></div>
                                              </div>
                                           </div>
                                        );
                                     })
                                  )}
                               </div>
                            </div>

                            <div className="space-y-2">
                               <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Frekuensi Log Kritis/Error Terbanyak</p>
                               <div className="bg-zinc-900/40 p-4 border border-zinc-800/60 rounded-xl max-h-[170px] overflow-y-auto space-y-2">
                                  {reportData.topErrors.length === 0 ? (
                                     <p className="text-xs text-zinc-600">Tidak ada data error yang berulang.</p>
                                  ) : (
                                     reportData.topErrors.map((e: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center gap-4 text-xs font-mono border-b border-zinc-800/40 pb-1.5 last:border-b-0 last:pb-0">
                                           <span className="truncate text-zinc-400" title={e.message}>{e.message}</span>
                                           <span className="font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">{e.count}x</span>
                                        </div>
                                     ))
                                  )}
                               </div>
                            </div>
                         </div>
                      </div>

                      {/* Section 3: Log Table */}
                      <div className="space-y-3 font-sans">
                         <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-l-2 border-zinc-500 pl-3 print-section-title">
                            III. Rincian Baris Log ({reportData.logs.slice(0, 100).length} Aktivitas Pertama)
                         </h3>
                         <div className="overflow-x-auto border border-zinc-800/80 rounded-xl bg-zinc-900/20">
                            {reportIsGrouped ? (
                               <table className="w-full text-xs text-left whitespace-nowrap">
                                  <thead className="bg-zinc-950/80 text-zinc-500 font-bold uppercase tracking-widest">
                                     <tr>
                                        <th className="px-4 py-2.5 w-12 text-center">No</th>
                                        <th className="px-4 py-2.5">Router</th>
                                        <th className="px-4 py-2.5">Topik</th>
                                        <th className="px-4 py-2.5">Pesan Aktivitas</th>
                                        <th className="px-4 py-2.5 text-center">Frekuensi</th>
                                        <th className="px-4 py-2.5">Pertama Kali</th>
                                        <th className="px-4 py-2.5">Terakhir Kali</th>
                                     </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-800/30">
                                     {reportData.logs.slice(0, 100).map((l: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-zinc-800/20">
                                           <td className="px-4 py-2 text-zinc-500 text-center font-mono">{idx + 1}</td>
                                           <td className="px-4 py-2 text-zinc-400 font-bold">{l.device_name || 'System'}</td>
                                           <td className="px-4 py-2">
                                              <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-mono tracking-tight text-[10px]">{l.topics}</span>
                                           </td>
                                           <td className="px-4 py-2 text-zinc-300 font-mono truncate max-w-xs" title={l.message}>{l.message}</td>
                                           <td className="px-4 py-2 text-center">
                                              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold font-mono">{l.occurrences}x</span>
                                           </td>
                                           <td className="px-4 py-2 font-mono text-zinc-500">{new Date(l.first_seen).toLocaleString('id-ID')}</td>
                                           <td className="px-4 py-2 font-mono text-zinc-400">{new Date(l.last_seen).toLocaleString('id-ID')}</td>
                                        </tr>
                                     ))}
                                     {reportData.logs.length === 0 && (
                                        <tr>
                                           <td colSpan={7} className="px-4 py-8 text-center text-zinc-600">Tidak ada log terdeteksi.</td>
                                        </tr>
                                     )}
                                  </tbody>
                               </table>
                            ) : (
                               <table className="w-full text-xs text-left whitespace-nowrap">
                                  <thead className="bg-zinc-950/80 text-zinc-500 font-bold uppercase tracking-widest">
                                     <tr>
                                        <th className="px-4 py-2.5 w-12 text-center">No</th>
                                        <th className="px-4 py-2.5">Waktu</th>
                                        <th className="px-4 py-2.5">Router</th>
                                        <th className="px-4 py-2.5">Topik</th>
                                        <th className="px-4 py-2.5">Pesan Aktivitas</th>
                                     </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-800/30">
                                     {reportData.logs.slice(0, 100).map((l: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-zinc-800/20">
                                           <td className="px-4 py-2 text-zinc-500 text-center font-mono">{idx + 1}</td>
                                           <td className="px-4 py-2 font-mono text-zinc-500">{new Date(l.created_at).toLocaleString('id-ID')}</td>
                                           <td className="px-4 py-2 text-zinc-400 font-bold">{l.device_name || 'System'}</td>
                                           <td className="px-4 py-2">
                                              <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-mono tracking-tight text-[10px]">{l.topics}</span>
                                           </td>
                                           <td className="px-4 py-2 text-zinc-300 font-mono truncate max-w-xs" title={l.message}>{l.message}</td>
                                        </tr>
                                     ))}
                                     {reportData.logs.length === 0 && (
                                        <tr>
                                           <td colSpan={5} className="px-4 py-8 text-center text-zinc-600">Tidak ada log terdeteksi.</td>
                                        </tr>
                                     )}
                                  </tbody>
                               </table>
                            )}
                         </div>
                         <p className="text-[10px] text-zinc-500 italic">
                            * Laporan PDF hanya menampilkan sampai 100 baris log pertama untuk keterbacaan cetak. Gunakan ekspor Excel (CSV) untuk mengunduh seluruh {reportData.totalLogs} baris log.
                         </p>
                      </div>
                   </div>
                )}
             </div>
             
             <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-between items-center gap-3 print-hide">
                <button onClick={() => setIsReportModalOpen(false)} className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold transition-all text-xs">Tutup</button>
                {reportData && (
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={exportToCSV}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg flex items-center gap-2"
                      >
                         <Download className="w-4 h-4" /> Ekspor Excel (CSV)
                      </button>
                      <button 
                        onClick={() => window.print()}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg flex items-center gap-2"
                      >
                         <Download className="w-4 h-4" /> Cetak PDF
                      </button>
                   </div>
                )}
             </div>
          </div>
        </div>
      )}
     </div>
   );
 }
