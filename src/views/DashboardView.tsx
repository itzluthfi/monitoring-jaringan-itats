import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Activity, Users, Router as RouterIcon, Wifi, BrainCircuit } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { MikroTikDevice } from '../types';
import { Loader } from '../components/common/Loader';

export function DashboardView() {
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0 });
  const [currentOnline, setCurrentOnline] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [aiPrediction, setAiPrediction] = useState<string>('');
  const [rawanHours, setRawanHours] = useState<any[]>([]);
  const [devices, setDevices] = useState<MikroTikDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, curRes, histRes, aiRes, devRes] = await Promise.all([
        authFetch('/api/mikrotiks/stats'),
        authFetch(`/api/current-status?device=${selectedDevice}`),
        authFetch(`/api/history?device=${selectedDevice}`),
        authFetch(`/api/prediction?device=${selectedDevice}`),
        authFetch('/api/mikrotiks')
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (curRes.ok) setCurrentOnline((await curRes.json()).count);
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
        setDevices(await devRes.json());
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      if (loading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [selectedDevice]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader message="Initializing secure administrator portal..." />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-16 h-16 text-indigo-400" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl">
               <Users className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-zinc-300">Active Wi-Fi Clients</h3>
          </div>
          <div className="text-4xl font-bold text-white tracking-tight">{currentOnline}</div>
          <p className="text-sm text-indigo-400 mt-2 font-medium">Across all campus zones</p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <RouterIcon className="w-16 h-16 text-emerald-400" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
               <RouterIcon className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-zinc-300">Online Devices</h3>
          </div>
          <div className="text-4xl font-bold text-white tracking-tight">{stats.online} <span className="text-xl text-zinc-500 font-medium">/ {stats.total}</span></div>
          <p className="text-sm text-emerald-400 mt-2 font-medium">Core routers actively monitored</p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity className="w-16 h-16 text-rose-400" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl animate-pulse">
               <Activity className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-zinc-300">Offline Devices</h3>
          </div>
          <div className="text-4xl font-bold text-white tracking-tight">{stats.offline}</div>
          <p className="text-sm text-rose-400 mt-2 font-medium">Requires immediate attention</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 shadow-xl relative overflow-hidden group border border-white/10">
          <div className="absolute -right-6 -top-6 p-4 opacity-20 group-hover:scale-110 transition-transform duration-500">
            <BrainCircuit className="w-32 h-32 text-white" />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="p-3 bg-white/20 text-white rounded-xl backdrop-blur-sm">
               <BrainCircuit className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-white">Gemini Nexus AI</h3>
          </div>
          <div className="relative z-10">
            <p className="text-sm text-indigo-100 font-medium leading-relaxed line-clamp-3">
              {aiPrediction || "Analyzing density patterns..."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Campus Density Flow</h3>
            <div className="flex items-center gap-2 text-xs font-medium bg-zinc-800/50 px-3 py-1.5 rounded-full border border-zinc-700">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Live Feed
            </div>
          </div>
          <div className="h-[300px] w-full">
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

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-purple-400" />
            AI Congestion Predictor
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {rawanHours && rawanHours.length > 0 ? (
              rawanHours.map((rh: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50 hover:bg-zinc-800/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-zinc-950/50">
                      <span className="text-zinc-300 font-mono text-sm">{rh.hour}</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    rh.expectedDensity === 'High' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                    rh.expectedDensity === 'Low' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {rh.expectedDensity} Density
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <p className="text-sm">Accumulating data points...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
