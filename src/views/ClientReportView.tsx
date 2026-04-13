import React, { useEffect, useState } from 'react';
import { Search, Wifi, Signal, ArrowUpRight, ArrowDownLeft, Shield, Clock, Smartphone, Info, Download, Filter, RefreshCw, MoreVertical, WifiOff } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { Loader } from '../components/common/Loader';
import { clsx } from 'clsx';

function cn(...inputs: any[]) {
  return clsx(inputs);
}

export function ClientReportView() {
  const [clients, setClients] = useState<any[]>([]);
  const [scanErrors, setScanErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'Excellent' | 'Good' | 'Poor'>('all');
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());

  const fetchClients = () => {
    setLoading(true);
    authFetch('/api/topology/clients/all')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.clients)) {
          setClients(data.clients);
          setScanErrors(data.errors || []);
          setLastUpdated(new Date().toLocaleTimeString());
        } else if (Array.isArray(data)) {
          setClients(data);
          setScanErrors([]);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };


  useEffect(() => {
    fetchClients();
    const interval = setInterval(fetchClients, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  const filteredClients = clients.filter(c => {
    const matchesSearch = 
      c.hostname.toLowerCase().includes(search.toLowerCase()) || 
      c.mac.toLowerCase().includes(search.toLowerCase()) || 
      c.ip.toLowerCase().includes(search.toLowerCase());
    
    const matchesFilter = filter === 'all' || c.experience === filter;
    
    return matchesSearch && matchesFilter;
  });

  // Remove the full-screen loader to allow the UI to show even if scanning is in progress
  // or if there are 0 clients found.


  return (
    <div className="p-6 md:p-8 animate-in fade-in duration-500 flex flex-col h-full max-h-screen overflow-hidden">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-3xl font-black text-white tracking-tight">Network Clients</h2>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold border border-indigo-500/20 uppercase tracking-widest">Live</span>
          </div>
          <p className="text-zinc-400 text-sm">Real-time performance monitoring across all access points.</p>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
              {(['all', 'Excellent', 'Good', 'Poor'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    filter === f ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
           </div>
           
           <button 
             onClick={fetchClients} 
             className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all"
             title="Force Refresh"
           >
             <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
           </button>
        </div>
      </div>

      {/* Error Banner for failed routers */}
      {scanErrors.length > 0 && (
        <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-4 animate-in slide-in-from-top-4 duration-500">
           <div className="p-2 bg-rose-500/20 rounded-xl text-rose-400">
              <AlertTriangle className="w-5 h-5" />
           </div>
           <div className="flex-1">
              <p className="text-sm font-bold text-rose-400">Beberapa router gagal dipindai ({scanErrors.length})</p>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                 {scanErrors.map((err, i) => (
                   <div key={i} className="text-[10px] text-rose-300/70 bg-rose-500/5 p-2 rounded-lg flex items-center justify-between">
                      <span><strong>{err.router}</strong> ({err.host}): {err.error}</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-rose-500/20 rounded font-bold uppercase tracking-tighter">Offline</span>
                   </div>
                 ))}
              </div>
              <p className="mt-3 text-[10px] text-rose-300/50 italic flex items-center gap-1.5 font-medium">
                <Info className="w-3 h-3" />
                Tips: Pastikan service API MikroTik (Port 8728) aktif dan Firewall tidak memblokir koneksi dari server.
              </p>
           </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

         {[
           { label: 'Total Clients', value: clients.length, icon: Smartphone, color: 'text-indigo-400' },
           { label: 'Excellen Health', value: clients.filter(c => c.experience === 'Excellent').length, icon: Signal, color: 'text-emerald-400' },
           { label: 'WiFi 6 / 5', value: clients.filter(c => c.standard?.includes('6') || c.standard?.includes('5')).length, icon: Wifi, color: 'text-sky-400' },
           { label: 'Poor Connection', value: clients.filter(c => c.experience === 'Poor').length, icon: AlertTriangle, color: 'text-rose-400' },
         ].map((s, i) => (
           <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 p-4 rounded-2xl flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800", s.color)}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{s.label}</p>
                <p className="text-xl font-black text-white">{s.value}</p>
              </div>
           </div>
         ))}
      </div>

      {/* Main Table section */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl overflow-hidden">
        {/* Search & Toolbar */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search clients by name, MAC, or IP..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-600"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-600">Updated: {lastUpdated}</span>
            <button className="p-2 text-zinc-500 hover:text-white transition-colors">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table container with fixed header logic */}
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-950/80 sticky top-0 z-20">
              <tr>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Experience</th>
                <th className="px-6 py-4">AP / Router</th>
                <th className="px-6 py-4">Standard</th>
                <th className="px-6 py-4">Phy Rates</th>
                <th className="px-6 py-4 text-center">Signal</th>
                <th className="px-6 py-4">Uptime</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredClients.map((client, idx) => {
                const isExcellent = client.experience === 'Excellent';
                const isPoor = client.experience === 'Poor';
                const signalNum = parseInt(client.signalNum);
                
                return (
                  <tr key={idx} className="hover:bg-zinc-800/30 transition-all group border-l-2 border-transparent hover:border-indigo-500">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center text-zinc-500 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-colors border border-zinc-800">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white font-bold leading-none mb-1.5">{client.hostname !== '-' ? client.hostname : client.mac}</p>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-mono text-zinc-500">{client.ip}</span>
                             <span className="w-1 h-1 rounded-full bg-zinc-700" />
                             <span className="text-[10px] font-mono text-zinc-600 uppercase">{client.mac}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         <span className={cn(
                           "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border",
                           client.source_label?.toLowerCase().includes('mikrotik') 
                             ? "bg-zinc-800 text-zinc-400 border-zinc-700" 
                             : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                         )}>
                           {client.source_label || 'Router'}
                         </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                        isExcellent ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        isPoor ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                        "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      )}>
                        {client.experience}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="text-zinc-200 font-medium text-xs">{client.ap}</span>
                           <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{client.interface}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          <Wifi className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="text-xs font-bold text-zinc-300">{client.standard}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-[10px]">
                            <ArrowUpRight className="w-3 h-3 text-sky-400" />
                            <span className="text-zinc-300 font-mono">{client.txRate}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <ArrowDownLeft className="w-3 h-3 text-indigo-400" />
                            <span className="text-zinc-300 font-mono">{client.rxRate}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex flex-col items-center">
                          {client.signal.includes('N/A') ? (
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter bg-zinc-800 px-1.5 py-0.5 rounded">
                              {client.signal}
                            </span>
                          ) : (
                            <>
                              <span className={cn(
                                "font-mono font-bold text-xs",
                                signalNum > -60 ? "text-emerald-400" :
                                signalNum < -80 ? "text-rose-400" : "text-amber-400"
                              )}>
                                {client.signal}
                              </span>
                              <div className="flex gap-0.5 mt-1.5 h-1.5 w-12 bg-zinc-800 rounded-full overflow-hidden">
                                 <div className={cn(
                                   "h-full rounded-full transition-all duration-1000",
                                   signalNum > -60 ? "bg-emerald-500 w-[90%]" :
                                   signalNum > -70 ? "bg-emerald-400 w-[70%]" :
                                   signalNum > -80 ? "bg-amber-500 w-[40%]" : "bg-rose-500 w-[15%]"
                                 )} />
                              </div>
                            </>
                          )}
                       </div>
                    </td>

                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2 text-zinc-400 text-xs">
                         <Clock className="w-3.5 h-3.5" />
                         <span>{client.uptime}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button className="p-2 text-zinc-600 hover:text-white transition-colors">
                         <MoreVertical className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                );
              })}

              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 text-zinc-600">
                      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                        <Smartphone className="w-12 h-12 opacity-20" />
                      </div>
                      <div className="max-w-xs mx-auto">
                        <p className="text-white font-bold">No clients found</p>
                        <p className="text-xs mt-1">Try adjusting your search or filters to see more results.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const AlertTriangle = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
);
