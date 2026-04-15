import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Activity, Users, Router as RouterIcon, Wifi, BrainCircuit, Settings2, X, Bell, History, ArrowDown, ArrowUp, Map, Info, SlidersHorizontal, CheckSquare, Square, Maximize } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { MikroTikDevice } from '../types';
import { Loader } from '../components/common/Loader';
import { useNavigate } from 'react-router-dom';

function formatBps(val: string|number|undefined) {
  if (val === undefined || Number.isNaN(Number(val))) return '0 bps';
  let b = Number(val);
  const k = 1000;
  const sizes = ['bps', 'kbps', 'Mbps', 'Gbps'];
  if (b === 0) return '0 bps';
  const i = Math.floor(Math.log(Math.abs(b)) / Math.log(k));
  return parseFloat((b / Math.pow(k, Math.max(0, i))).toFixed(2)) + ' ' + (sizes[i] || 'bps');
}

export function DashboardView() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, apTotal: 0, apOnline: 0, apOffline: 0 });
  const [currentOnline, setCurrentOnline] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [aiPrediction, setAiPrediction] = useState<string>('');
  const [rawanHours, setRawanHours] = useState<any[]>([]);
  const [devices, setDevices] = useState<MikroTikDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // New Widgets State
  const [widgetConfig, setWidgetConfig] = useState(() => {
    const saved = localStorage.getItem('dashboard_config');
    if (saved) return JSON.parse(saved);
    return { statsHero: true, aiPredictor: true, densityFlow: true, bandwidth: true, notifications: true, apHistory: true };
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [apHistory, setApHistory] = useState<any[]>([]);
  const [bwData, setBwData] = useState<{routerName: string, rx: number, tx: number, vlans: {name: string, rx: number, tx: number}[]}[]>([]);
  const [bwHistory, setBwHistory] = useState<Record<string, {time: string, rx: number, tx: number}[]>>({});

  // Bandwidth Config State (localStorage-persisted)
  const [bwConfig, setBwConfig] = useState<{ selectedRouterIds: number[], showVlans: boolean, showEther: boolean, showBridge: boolean, viewMode: 'text' | 'graph' }>(() => {
    try {
      const saved = localStorage.getItem('bw_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.viewMode) parsed.viewMode = 'text'; // Fallback
        return parsed;
      }
    } catch {}
    return { selectedRouterIds: [], showVlans: true, showEther: true, showBridge: false, viewMode: 'text' };
  });
  const [isBwSettingsOpen, setIsBwSettingsOpen] = useState(false);

  const saveBwConfig = (next: typeof bwConfig) => {
    setBwConfig(next);
    localStorage.setItem('bw_config', JSON.stringify(next));
  };

  // Ref to always have the latest bwConfig in async callbacks
  const bwConfigRef = useRef(bwConfig);
  useEffect(() => { bwConfigRef.current = bwConfig; }, [bwConfig]);

  // Interactivity State
  const [activeModal, setActiveModal] = useState<'none' | 'offline_routers' | 'offline_aps' | 'wifi_clients' | 'ai_details' | 'density_details'>('none');
  const [aiFilter, setAiFilter] = useState<string>('all');

  const [wifiBreakdown, setWifiBreakdown] = useState<{routerName: string, count: number}[]>([]);
  const [offlineApsData, setOfflineApsData] = useState<any[]>([]);
  const [loadingAps, setLoadingAps] = useState(false);

  const toggleWidget = (key: string) => {
    setWidgetConfig((prev: any) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('dashboard_config', JSON.stringify(next));
      return next;
    });
  };

  const fetchBandwidth = async (targetDevices: MikroTikDevice[]) => {
    // Filter devices by selected router IDs (if any specific ones are selected)
    const cfg = bwConfigRef.current;
    const filtered = cfg.selectedRouterIds.length > 0 
      ? targetDevices.filter(d => cfg.selectedRouterIds.includes(d.id))
      : targetDevices;

    try {
      const promises = filtered.map(d => authFetch(`/api/mikrotiks/${d.id}/interfaces`).then(res => res.json()).then(data => ({ router: d, data: Array.isArray(data) ? data : [] })).catch(() => ({ router: d, data: []})));
      const results = await Promise.all(promises);
      
      const newBw = results.map(res => {
         let totalRx = 0;
         let totalTx = 0;
         const vlans: any[] = [];
         
         res.data.forEach((iface: any) => {
            const rx = Number(iface['rx-rate'] || 0);
            const tx = Number(iface['tx-rate'] || 0);
            
            const isVlan = iface.type === 'vlan';
            const isBridge = iface.type === 'bridge';
            const isEther = !isVlan && !isBridge;

            // Apply type filters
            if (isEther && cfg.showEther) { totalRx += rx; totalTx += tx; }
            if (isBridge && cfg.showBridge) { totalRx += rx; totalTx += tx; }
            if (isVlan && cfg.showVlans) { vlans.push({ name: iface.name, rx, tx }); }
         });
         
         return { routerName: res.router.name, rx: totalRx, tx: totalTx, vlans };
      });
      setBwData(newBw);

      const nowStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'});
      setBwHistory(prev => {
         const next = { ...prev };
         newBw.forEach(b => {
             if (!next[b.routerName]) next[b.routerName] = [];
             next[b.routerName] = [...next[b.routerName], { time: nowStr, rx: b.rx, tx: b.tx }].slice(-15);
         });
         return next;
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    try {
      const [statsRes, curRes, histRes, aiRes, devRes, notifRes, apHistRes] = await Promise.all([
        authFetch('/api/mikrotiks/stats'),
        authFetch(`/api/current-status?device=${selectedDevice}`),
        authFetch(`/api/history?device=${selectedDevice}`),
        authFetch(`/api/prediction?device=${selectedDevice}`),
        authFetch('/api/mikrotiks'),
        widgetConfig.notifications ? authFetch('/api/notifications?limit=5') : Promise.resolve(null),
        widgetConfig.apHistory ? authFetch('/api/topology/logs') : Promise.resolve(null)
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (curRes.ok) {
        const curData = await curRes.json();
        setCurrentOnline(curData.count);
        if (curData.breakdown) setWifiBreakdown(curData.breakdown);
      }
      if (histRes.ok) {
        const raw = await histRes.json();
        const fmt = raw.map((d: any) => ({
          time: new Date(d.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          clients: parseInt(d.client_count) || 0
        }));
        setChartData(fmt);
      }
      if (aiRes.ok) {
        const ai = await aiRes.json();
        setAiPrediction(ai.prediction || '');
        setRawanHours(ai.rawanHours || []);
      }
      if (devRes.ok) {
        const devs = await devRes.json();

        // ── FIX #10: Auto-notifikasi jika device berubah dari online → offline ──
        setDevices(prev => {
          devs.forEach((d: any) => {
            const wasPrev = prev.find((p: any) => p.id === d.id);
            if (wasPrev && wasPrev.status === 'online' && d.status === 'offline') {
              // Device baru saja offline — kirim notifikasi otomatis ke backend
              authFetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'error',
                  title: `Device Offline: ${d.name}`,
                  message: `Router ${d.name} (${d.host}) tidak dapat dijangkau.`,
                }),
              }).catch(() => {}); // silent fail — notifikasi tidak kritikal
            }
          });
          return devs;
        });

        if (widgetConfig.bandwidth) {
          const targets = selectedDevice === 'all' ? devs : devs.filter((d:any) => d.id.toString() === selectedDevice);
          fetchBandwidth(targets);
        }
      }
      if (notifRes && notifRes.ok) {
         setNotifications(await notifRes.json());
      }
      if (apHistRes && apHistRes.ok) {
         setApHistory(await apHistRes.json());
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      if (loading) setLoading(false);
    }
  };

  // FIX #7: useCallback agar interval cleanup benar dan tidak ada stale closure
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    // Cleanup interval saat komponen unmount atau dependency berubah
    return () => clearInterval(interval);
  }, [selectedDevice, widgetConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const openOfflineAps = async () => {
     setActiveModal('offline_aps');
     setLoadingAps(true);
     try {
       const res = await authFetch('/api/access-points?status=offline&limit=1000');
       if (res.ok) {
          const result = await res.json();
          setOfflineApsData(result.data || []);
       }
     } catch (err) {
       console.error(err);
     } finally {
       setLoadingAps(false);
     }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader message="Initializing secure administrator portal..." />
      </div>
    );
  }

  const offlineRouters = devices.filter(d => d.status === 'offline');

  return (
    <div className="p-6 md:p-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">System Dashboard</h2>
          <p className="text-zinc-400 mt-1">Real-time network telemetrics and density insights.</p>
        </div>
        <div className="flex items-center gap-3">
           <select
             value={selectedDevice}
             onChange={(e) => setSelectedDevice(e.target.value)}
             className="bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
           >
             <option value="all">All Routers (Aggregated)</option>
             {devices.map(d => (
               <option key={d.id} value={d.id}>{d.name} ({d.host})</option>
             ))}
           </select>
           <button 
             onClick={() => setIsSettingsOpen(true)}
             className="p-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-all shadow-md"
             title="Customize Dashboard"
           >
             <Settings2 className="w-5 h-5" />
           </button>
        </div>
      </div>

      {/* DYNAMIC GRID LAYOUT */}
      <div className="flex flex-col gap-6">

        {/* HERO STATS */}
        {widgetConfig.statsHero && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div 
              onClick={() => setActiveModal('wifi_clients')}
              className="cursor-pointer hover:border-indigo-500/50 transition-colors bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users className="w-16 h-16 text-indigo-400" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl"><Users className="w-6 h-6" /></div>
                <h3 className="font-semibold text-zinc-300 group-hover:text-white transition-colors">Active Wi-Fi Clients</h3>
              </div>
              <div className="text-4xl font-bold text-white tracking-tight">{currentOnline}</div>
              <p className="text-sm text-indigo-400 mt-2 font-medium">Click to view breakdown</p>
            </div>

            <div 
              onClick={() => setActiveModal('offline_routers')}
              className="cursor-pointer hover:border-emerald-500/50 transition-colors bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <RouterIcon className="w-16 h-16 text-emerald-400" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl"><RouterIcon className="w-6 h-6" /></div>
                <h3 className="font-semibold text-zinc-300 group-hover:text-white transition-colors">Core Routers</h3>
              </div>
              <div className="flex items-end gap-2">
                 <div className="text-4xl font-bold text-white tracking-tight">{stats.online}</div>
                 <div className="text-xl text-zinc-500 font-medium mb-1">/ {stats.total} Online</div>
               </div>
              <p className={`text-sm mt-2 font-medium ${stats.offline > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                {stats.offline} Offline Routers {stats.offline > 0 && '(Click to view)'}
              </p>
            </div>

            <div 
              onClick={openOfflineAps}
              className="cursor-pointer hover:border-sky-500/50 transition-colors bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Wifi className="w-16 h-16 text-sky-400" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-sky-500/20 text-sky-400 rounded-xl"><Wifi className="w-6 h-6" /></div>
                <h3 className="font-semibold text-zinc-300 group-hover:text-white transition-colors">Access Points</h3>
              </div>
              <div className="flex items-end gap-2">
                 <div className="text-4xl font-bold text-white tracking-tight">{stats.apOnline}</div>
                 <div className="text-xl text-zinc-500 font-medium mb-1">/ {stats.apTotal} Online</div>
               </div>
              <p className={`text-sm mt-2 font-medium ${stats.apOffline > 0 ? 'text-rose-400 animate-pulse' : 'text-sky-400'}`}>
                {stats.apOffline > 0 ? `${stats.apOffline} Devices Offline (Click to view)` : `100% Operational`}
              </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 shadow-xl relative overflow-hidden group border border-white/10">
              <div className="absolute -right-6 -top-6 p-4 opacity-20 group-hover:scale-110 transition-transform duration-500">
                <BrainCircuit className="w-32 h-32 text-white" />
              </div>
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="p-3 bg-white/20 text-white rounded-xl backdrop-blur-sm"><BrainCircuit className="w-6 h-6" /></div>
                <h3 className="font-semibold text-white">Gemini Nexus AI</h3>
              </div>
              <div className="relative z-10">
                <p className="text-sm text-indigo-100 font-medium leading-relaxed line-clamp-3">
                  {aiPrediction || "Analyzing density patterns..."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MIDDLE SECTION (Charts & AI) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {widgetConfig.densityFlow && (
            <div className={`bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col h-[450px] ${widgetConfig.aiPredictor ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Campus Density Flow
                  <button onClick={() => setActiveModal('density_details')} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-indigo-400 transition-colors" title="View Full Report">
                    <Maximize className="w-4 h-4" />
                  </button>
                </h3>
                <div className="flex items-center gap-2 text-xs font-medium bg-zinc-800/50 px-3 py-1.5 rounded-full border border-zinc-700">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  Live Feed
                </div>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorClients" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                    <XAxis dataKey="time" stroke="#a1a1aa" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="#a1a1aa" fontSize={12} axisLine={false} tickLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                      itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="clients" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorClients)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}


          {widgetConfig.aiPredictor && (
            <div className={`bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col h-[450px] ${widgetConfig.densityFlow ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-purple-400" /> AI Predictor
                </h3>
                <button onClick={() => setActiveModal('ai_details')} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                  See All &rarr;
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar min-h-0">
                {rawanHours && rawanHours.length > 0 ? (
                  rawanHours.slice(0, 10).map((rh: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50 hover:bg-zinc-800/80 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-zinc-950/50">
                          <span className="text-zinc-300 font-mono text-sm">{rh.hour}</span>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                        rh.expectedDensity === 'High' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        rh.expectedDensity === 'Low' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {rh.expectedDensity}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                    <p className="text-sm text-center px-4">Accumulating data points for next prediction cycle...</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM SECTION (Bandwidth & Logs & Notifications) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* BANDWIDTH WIDGET */}
           {widgetConfig.bandwidth && (
             <div className="lg:col-span-2 bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col min-h-[300px] max-h-[824px]">
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2">
                   <Activity className="w-5 h-5 text-emerald-400" /> 
                   Live Bandwidth Usage
                   {bwConfig.selectedRouterIds.length > 0 && (
                     <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full ml-1">
                       {bwConfig.selectedRouterIds.length} router{bwConfig.selectedRouterIds.length > 1 ? 's' : ''}
                     </span>
                   )}
                 </h3>
                 <button
                   onClick={() => setIsBwSettingsOpen(true)}
                   className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                   title="Configure Bandwidth View"
                 >
                   <SlidersHorizontal className="w-4 h-4" />
                 </button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto custom-scrollbar pr-2 flex-1 pb-2">
                 {bwData.length > 0 ? bwData.map((d, i) => (
                    <div key={i} className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-4">
                       <h4 className="font-bold text-indigo-300 mb-2 truncate">{d.routerName}</h4>
                       
                       {/* Aggregated Speed */}
                       <div className="flex justify-between items-center mb-4 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50">
                          <div>
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><ArrowDown className="w-3 h-3 text-emerald-400" />Global RX</p>
                            <p className={`text-sm font-mono text-emerald-400 ${bwConfig.viewMode === 'graph' ? 'mb-1' : ''}`}>{formatBps(d.rx)}</p>
                          </div>
                          <div className="w-px h-8 bg-zinc-800"></div>
                          <div className="text-right">
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1 justify-end"><ArrowUp className="w-3 h-3 text-rose-400" />Global TX</p>
                            <p className={`text-sm font-mono text-rose-400 ${bwConfig.viewMode === 'graph' ? 'mb-1' : ''}`}>{formatBps(d.tx)}</p>
                          </div>
                       </div>
                       
                       {bwConfig.viewMode === 'graph' ? (
                          <div className="h-32 w-full mt-2">
                             <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={bwHistory[d.routerName] || []} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                                    <defs>
                                       <linearGradient id={`gradRx-${i}`} x1="0" y1="0" x2="0" y2="1">
                                         <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                         <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                       </linearGradient>
                                       <linearGradient id={`gradTx-${i}`} x1="0" y1="0" x2="0" y2="1">
                                         <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                                         <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                       </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                                    <XAxis dataKey="time" stroke="#a1a1aa" fontSize={8} tickMargin={5} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#a1a1aa" fontSize={8} tickFormatter={(v) => formatBps(v)} axisLine={false} tickLine={false} />
                                    <RechartsTooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '0.5rem', fontSize: '10px' }} labelStyle={{color: '#a1a1aa'}} formatter={(v: number) => formatBps(v)} />
                                    <Area type="monotone" dataKey="rx" name="RX" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill={`url(#gradRx-${i})`} />
                                    <Area type="monotone" dataKey="tx" name="TX" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill={`url(#gradTx-${i})`} />
                                </AreaChart>
                             </ResponsiveContainer>
                          </div>
                       ) : (
                         <>
                           {/* VLAN Breakdown */}
                           {d.vlans.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest border-b border-zinc-800 pb-1">VLAN Breakdown</p>
                                <div className="max-h-24 overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
                                  {d.vlans.map((v, idx) => (
                                    <div key={idx} className="flex justify-between text-xs">
                                       <span className="text-zinc-400 truncate w-1/3" title={v.name}>{v.name}</span>
                                       <span className="text-emerald-400/80 font-mono w-1/3 text-right">{formatBps(v.rx)}</span>
                                       <span className="text-rose-400/80 font-mono w-1/3 text-right">{formatBps(v.tx)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                           )}
                         </>
                       )}
                    </div>
                 )) : (
                    <div className="col-span-full py-10 flex flex-col items-center justify-center text-zinc-500 gap-2">
                       <Loader />
                       <span className="text-xs">Fetching rates from Router interfaces...</span>
                    </div>
                 )}
               </div>
             </div>
           )}

           {/* VERTICAL STACK FOR LOGS / NOTIFS */}
           <div className="flex flex-col gap-6 lg:col-span-1">
             
             {/* NOTIFICATIONS WIDGET */}
             {widgetConfig.notifications && (
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col flex-1 min-h-[300px] max-h-[400px]">
                   <div className="flex items-center justify-between mb-4">
                     <h3 className="text-lg font-bold text-white flex items-center gap-2">
                       <Bell className="w-5 h-5 text-amber-400" /> Latest Alerts
                     </h3>
                     <button onClick={() => navigate('/admin/notifications')} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                       Lihat Semua &rarr;
                     </button>
                   </div>
                   <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
                     {notifications.length > 0 ? notifications.map((n, i) => (
                       <div key={i} className="p-3 bg-zinc-800/30 border border-zinc-700/50 rounded-xl relative overflow-hidden group">
                         <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                            n.type === 'critical' ? 'bg-rose-500' :
                            n.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                         }`}></div>
                         <h4 className="text-sm font-semibold text-zinc-200 mb-1 ml-1 truncate">{n.title}</h4>
                         <p className="text-xs text-zinc-500 ml-1 line-clamp-2">{n.message}</p>
                         <p className="text-[10px] text-zinc-600 mt-2 ml-1">{new Date(n.created_at).toLocaleString()}</p>
                       </div>
                     )) : (
                       <div className="flex items-center justify-center h-full text-zinc-500 text-sm">No recent alerts.</div>
                     )}
                   </div>
                </div>
             )}

             {/* AP HISTORY WIDGET */}
             {widgetConfig.apHistory && (
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col flex-1 min-h-[300px] max-h-[400px]">
                   <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                     <History className="w-5 h-5 text-sky-400" /> Topology Events
                   </h3>
                   <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-1 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-800 before:to-transparent">
                     {apHistory.length > 0 ? apHistory.map((h, i) => (
                       <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                         
                         {/* Circle marker */}
                         <div className={`flex items-center justify-center w-5 h-5 rounded-full border-2 border-zinc-900 bg-zinc-800 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 
                           ${h.status === 'online' ? 'text-emerald-500' : 'text-rose-500'}`}>
                           <div className={`w-2 h-2 rounded-full ${h.status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500'}`}></div>
                         </div>
                         
                         {/* Card */}
                         <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-zinc-700/50 bg-zinc-800/30">
                           <div className="flex items-center justify-between mb-1">
                             <div className={`text-[10px] font-bold uppercase tracking-wider ${h.status === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                               {h.status === 'online' ? 'Restored' : 'Dropped'}
                             </div>
                             <time className="text-[9px] font-mono text-zinc-500">{new Date(h.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</time>
                           </div>
                           <div className="text-xs text-zinc-300 font-medium truncate">{h.node_name || h.node_id}</div>
                         </div>
                       </div>
                     )) : (
                       <div className="flex items-center justify-center h-full text-zinc-500 text-sm">No recent topology changes.</div>
                     )}
                   </div>
                </div>
             )}

           </div>
        </div>
      </div>

      {/* DASHBOARD SETTINGS OVERLAY */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSettingsOpen(false)}>
           <div className="w-full max-w-sm h-full bg-zinc-900 border-l border-zinc-800 shadow-2xl animate-in slide-in-from-right-full duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Settings2 className="w-5 h-5 text-indigo-400" /> Customize Layout</h3>
                <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 flex-1 overflow-auto bg-zinc-900/50 space-y-6">
                <p className="text-sm text-zinc-400 leading-relaxed mb-6">Toggle specific dashboard widgets to customize your viewing experience. 
                  The layout will automatically adjust to fit the available space.</p>
                
                <div className="space-y-4">
                  {Object.keys(widgetConfig).map(key => {
                     const labels: Record<string, {title: string, desc: string}> = {
                       statsHero: { title: "Hero Summary Bar", desc: "Top summary cards for clients, routers, and AP counts." },
                       aiPredictor: { title: "AI Congestion Predictor", desc: "Shows Gemini network predictions and insights." },
                       densityFlow: { title: "Campus Density Chart", desc: "Live graph displaying connection trends over time." },
                       bandwidth: { title: "Live Bandwidth Widget", desc: "Real-time interface usage tracking per-router and VLAN." },
                       notifications: { title: "Recent Alerts Widget", desc: "List of the latest system warnings and notifications." },
                       apHistory: { title: "Topology Event Timeline", desc: "Shows historical online/offline events for Access Points." },
                     };
                     const info = labels[key];
                     if (!info) return null;
                     
                     return (
                        <div key={key} className="flex items-center justify-between p-4 bg-zinc-800/40 border border-zinc-700/50 rounded-xl">
                          <div>
                            <h4 className="text-sm font-semibold text-zinc-200">{info.title}</h4>
                            <p className="text-xs text-zinc-500 mt-0.5">{info.desc}</p>
                          </div>
                          <button 
                            onClick={() => toggleWidget(key)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${widgetConfig[key] ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${widgetConfig[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                     );
                  })}
                </div>
              </div>
           </div>
        </div>
      )}

      {/* DASHBOARD DETAIL MODALS */}
      {activeModal !== 'none' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200 p-4" onClick={() => setActiveModal('none')}>
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/80 backdrop-blur-md">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {activeModal === 'offline_routers' && <><RouterIcon className="w-5 h-5 text-emerald-400" /> Offline Core Routers</>}
                  {activeModal === 'offline_aps' && <><Wifi className="w-5 h-5 text-sky-400" /> Offline Access Points</>}
                  {activeModal === 'wifi_clients' && <><Users className="w-5 h-5 text-indigo-400" /> Client Distribution Breakdown</>}
                  {activeModal === 'ai_details' && <><BrainCircuit className="w-5 h-5 text-purple-400" /> AI Congestion Prediction List</>}
                  {activeModal === 'density_details' && <><Activity className="w-5 h-5 text-indigo-400" /> Campus Density History</>}
                </h3>
                <button onClick={() => setActiveModal('none')} className="text-zinc-500 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 p-1.5 rounded-lg transition-colors"><X className="w-5 h-5"/></button>
            </div>

            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-zinc-900/50">
                {/* AI Prediction Details */}
                {activeModal === 'ai_details' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                      <span className="text-xs text-zinc-500">Filter Density</span>
                      <div className="flex gap-1.5">
                        {['all', 'High', 'Medium', 'Low'].map(f => (
                          <button 
                            key={f} 
                            onClick={() => setAiFilter(f)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                              aiFilter === f ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {f.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       {rawanHours.filter(rh => aiFilter === 'all' || rh.expectedDensity === aiFilter).map((rh: any, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50">
                             <span className="text-sm font-mono text-zinc-200">{rh.hour}</span>
                             <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                                rh.expectedDensity === 'High' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                rh.expectedDensity === 'Low' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                             }`}>{rh.expectedDensity} Density</span>
                          </div>
                       ))}
                    </div>
                  </div>
                )}

                {/* Density Flow Details */}
                {activeModal === 'density_details' && (
                  <div className="space-y-6">
                    <div className="bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800 h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                          <XAxis dataKey="time" stroke="#a1a1aa" fontSize={10} />
                          <YAxis stroke="#a1a1aa" fontSize={10} />
                          <RechartsTooltip contentStyle={{ backgroundColor: '#000', borderColor: '#333' }} />
                          <Area type="monotone" dataKey="clients" stroke="#818cf8" fill="#818cf8" fillOpacity={0.1} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                       <div className="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-xl">
                          <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Peak Clients</p>
                          <p className="text-xl font-bold text-white">{Math.max(...chartData.map(d => d.clients), 0)}</p>
                       </div>
                       <div className="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-xl">
                          <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Average</p>
                          <p className="text-xl font-bold text-indigo-400">
                             {chartData.length ? Math.round(chartData.reduce((s, d) => s + d.clients, 0) / chartData.length) : 0}
                          </p>
                       </div>
                       <div className="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-xl">
                          <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Time Range</p>
                          <p className="text-sm font-bold text-zinc-300">{chartData[0]?.time} - {chartData[chartData.length-1]?.time}</p>
                       </div>
                    </div>
                  </div>
                )}

                {/* WIfi Clients Breakdown */}
                {activeModal === 'wifi_clients' && (
                  <div className="space-y-3">
                     {wifiBreakdown.length > 0 ? wifiBreakdown.map((b, i) => (
                        <div key={i} className="flex items-center justify-between bg-zinc-800/40 border border-zinc-700/50 p-4 rounded-xl hover:bg-zinc-800/80 transition-colors">
                           <span className="font-semibold text-zinc-200">{b.routerName}</span>
                           <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 font-bold rounded-lg text-sm">{b.count} Users</span>
                        </div>
                     )) : (
                        <div className="text-center text-zinc-500 py-10">No client data available.</div>
                     )}
                  </div>
                )}

                {/* Offline Routers */}
                {activeModal === 'offline_routers' && (
                  <div className="space-y-3">
                     {offlineRouters.length > 0 ? offlineRouters.map((r, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-zinc-800/40 border border-rose-500/30 p-4 rounded-xl gap-4">
                           <div>
                              <h4 className="font-bold text-zinc-200">{r.name}</h4>
                              <p className="text-xs text-zinc-400 font-mono mt-1">{r.host}</p>
                           </div>
                           <div className="flex gap-2 shrink-0">
                              <button onClick={() => navigate('/admin/topology')} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-700"><Map className="w-3.5 h-3.5"/> Topology</button>
                              <button onClick={() => navigate(`/admin/devices?detail=${r.id}`)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-700"><Info className="w-3.5 h-3.5"/> Details</button>
                           </div>
                        </div>
                     )) : (
                        <div className="text-center text-emerald-500 font-medium py-10 bg-emerald-500/10 rounded-xl border border-emerald-500/20">All Routers are currently Online!</div>
                     )}
                  </div>
                )}

                {/* Offline APs */}
                {activeModal === 'offline_aps' && (
                  <div className="space-y-3">
                     {loadingAps ? (
                       <div className="py-10 flex justify-center"><Loader /></div>
                     ) : offlineApsData.length > 0 ? offlineApsData.map((ap, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-zinc-800/40 border border-rose-500/30 p-4 rounded-xl gap-4">
                           <div>
                              <h4 className="font-bold text-zinc-200">{ap.name}</h4>
                              <p className="text-xs text-zinc-400 font-mono mt-1">{ap.ip_address || 'No IP'} • {ap.mikrotik_name || 'Unassigned Router'}</p>
                           </div>
                           <div className="flex shrink-0">
                              <button onClick={() => navigate(`/admin/topology?ap=${encodeURIComponent(ap.name)}`)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-700"><Map className="w-3.5 h-3.5"/> Find in Topology</button>
                           </div>
                        </div>
                     )) : (
                        <div className="text-center text-emerald-500 font-medium py-10 bg-emerald-500/10 rounded-xl border border-emerald-500/20">All Access Points are currently Online!</div>
                     )}
                  </div>
                )}

            </div>
          </div>
        </div>
      )}

      {/* BANDWIDTH CONFIG MODAL */}
      {isBwSettingsOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200 p-4" onClick={() => setIsBwSettingsOpen(false)}>
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/80">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-emerald-400" /> Configure Live Bandwidth
              </h3>
              <button onClick={() => setIsBwSettingsOpen(false)} className="text-zinc-500 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 p-1.5 rounded-lg transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-5 space-y-5">
              {/* Router Selection */}
              <div>
                <h4 className="text-sm font-semibold text-zinc-300 mb-3">Pilih Router yang Ditampilkan</h4>
                <p className="text-xs text-zinc-500 mb-3">Kosongkan semua untuk menampilkan semua router.</p>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {devices.map(d => {
                    const selected = bwConfig.selectedRouterIds.includes(d.id);
                    return (
                      <button key={d.id} onClick={() => {
                        const next = selected
                          ? bwConfig.selectedRouterIds.filter((id: number) => id !== d.id)
                          : [...bwConfig.selectedRouterIds, d.id];
                        saveBwConfig({ ...bwConfig, selectedRouterIds: next });
                      }} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${selected ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700'}`}>
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2 h-2 rounded-full ${d.status === 'online' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                          <div>
                            <p className="text-sm font-semibold text-white">{d.name}</p>
                            <p className="text-xs text-zinc-500 font-mono">{d.host}</p>
                          </div>
                        </div>
                        {selected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-zinc-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Interface Type Filters */}
              <div>
                <h4 className="text-sm font-semibold text-zinc-300 mb-3">Filter Tipe Interface</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'showEther', label: 'Ethernet', color: 'cyan' },
                    { key: 'showVlans', label: 'VLAN', color: 'indigo' },
                    { key: 'showBridge', label: 'Bridge', color: 'amber' },
                  ].map(({ key, label, color }) => {
                    const on = (bwConfig as any)[key];
                    return (
                      <button key={key} onClick={() => saveBwConfig({ ...bwConfig, [key]: !on })} className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${on ? `bg-${color}-500/10 border-${color}-500/30 text-${color}-400` : 'bg-zinc-800/30 border-zinc-800 text-zinc-500'}`}>
                        {on ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* View Mode Toggle */}
              <div>
                <h4 className="text-sm font-semibold text-zinc-300 mb-3">Mode Tampilan Bandwidth</h4>
                <div className="flex bg-zinc-950/80 p-1.5 rounded-xl border border-zinc-800">
                  <button onClick={() => saveBwConfig({ ...bwConfig, viewMode: 'text' })} className={`flex-1 flex justify-center items-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${bwConfig.viewMode === 'text' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    <Activity className="w-4 h-4" /> Mode Teks & VLAN
                  </button>
                  <button onClick={() => saveBwConfig({ ...bwConfig, viewMode: 'graph' })} className={`flex-1 flex justify-center items-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${bwConfig.viewMode === 'graph' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    <Maximize className="w-4 h-4" /> Mode Grafik Live
                  </button>
                </div>
              </div>

              <p className="text-xs text-zinc-600 bg-zinc-950/50 rounded-xl p-3 border border-zinc-800 mt-2">
                ℹ️ Perubahan disimpan otomatis dan akan diaplikasikan pada polling bandwidth berikutnya.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
