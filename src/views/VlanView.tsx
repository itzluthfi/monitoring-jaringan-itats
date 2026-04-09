import React, { useEffect, useState, useCallback } from 'react';
import { Activity, Network, TrendingUp, TrendingDown } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function VlanView() {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>(['all']);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['all']);
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [vlans, setVlans] = useState<any[]>([]);
  const [vlanTrafficHistory, setVlanTrafficHistory] = useState<Record<string, any[]>>({});

  useEffect(() => {
    authFetch('/api/mikrotiks')
      .then(r => r.json())
      .then(data => {
         if (Array.isArray(data)) setDevices(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    let isSubscribed = true;
    
    const fetchVlans = async () => {
      try {
        // Fetch ALL traffic data to allow local multi-filtering
        const res = await authFetch(`/api/mikrotiks/all/vlan-traffic`);
        const data = await res.json();
        if (!isSubscribed || !Array.isArray(data)) return;
        
        setVlans(data);
        
        setVlanTrafficHistory(prev => {
          const next = { ...prev };
          const nowMs = Date.now();
          const nowStr = new Date(nowMs).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
          
          data.forEach((v: any) => {
            if (!next[v.name]) next[v.name] = [];
            
            let rxRateBps = Number(v['rx-rate'] || 0);
            let txRateBps = Number(v['tx-rate'] || 0);
            const currentRxByte = Number(v['rx-byte'] || 0);
            const currentTxByte = Number(v['tx-byte'] || 0);
            
            if (rxRateBps === 0 && txRateBps === 0 && next[v.name].length > 0) {
              const lastPoint = next[v.name][next[v.name].length - 1];
              if (lastPoint.timestamp) {
                const timeDiffSeconds = (nowMs - lastPoint.timestamp) / 1000;
                if (timeDiffSeconds > 0) {
                  const rxDiff = currentRxByte - lastPoint.rawRxByte;
                  const txDiff = currentTxByte - lastPoint.rawTxByte;
                  if (rxDiff > 0) rxRateBps = (rxDiff * 8) / timeDiffSeconds;
                  if (txDiff > 0) txRateBps = (txDiff * 8) / timeDiffSeconds;
                }
              }
            }

            next[v.name] = [...next[v.name], {
              time: nowStr,
              timestamp: nowMs,
              rx: Math.round(rxRateBps / 1024), // kbps for chart
              tx: Math.round(txRateBps / 1024), // kbps for chart
              rawRxByte: currentRxByte, 
              rawTxByte: currentTxByte
            }];
            if (next[v.name].length > 40) next[v.name].shift();
          });
          return next;
        });
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchVlans();
    const interval = setInterval(fetchVlans, 10000); // 10s live traffic poll
    
    return () => {
       isSubscribed = false;
       clearInterval(interval);
    };
  }, []);

  const uniqueVlansSet = new Set<string>();
  vlans.forEach(v => uniqueVlansSet.add(v.name));
  const activeVlanNames = Array.from(uniqueVlansSet);

  // Transform vlan data for charts if needed
  const formatBytes = (bytes: string | number) => {
    const b = Number(bytes);
    if (!b) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getVlanHistory = useCallback((vlanName: string) => {
    return vlanTrafficHistory[vlanName] || [];
  }, [vlanTrafficHistory]);

  const toggleFilter = (type: 'device' | 'type', val: string) => {
    const list = type === 'device' ? selectedDevices : selectedTypes;
    const setter = type === 'device' ? setSelectedDevices : setSelectedTypes;
    
    if (val === 'all') {
      setter(['all']);
      return;
    }
    
    let next = list.filter(x => x !== 'all');
    if (next.includes(val)) next = next.filter(x => x !== val);
    else next.push(val);
    
    if (next.length === 0) next = ['all'];
    setter(next);
  };

  const filteredIfaces = vlans.filter(v => {
    // 1. Device Filter Match (v.name includes [DeviceName])
    let matchesDevice = selectedDevices.includes('all');
    if (!matchesDevice) {
      // Find which device ID corresponds to which name
      const allowedNames = devices.filter(d => selectedDevices.includes(String(d.id))).map(d => d.name);
      matchesDevice = allowedNames.some(dname => v.name.includes(`[${dname}]`));
    }

    // 2. Type Filter Match
    const matchesType = selectedTypes.includes('all') || selectedTypes.includes(v.type);

    return matchesDevice && matchesType;
  });

  return (
    <div className="p-6 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Traffic Monitoring</h2>
          <p className="text-zinc-400 mt-1">Live traffic analysis across network interfaces & segments.</p>
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Device Source</span>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => toggleFilter('device', 'all')}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedDevices.includes('all') ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                All Routers
              </button>
              {devices.map(d => (
                <button 
                  key={d.id}
                  onClick={() => toggleFilter('device', String(d.id))}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedDevices.includes(String(d.id)) ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Interface Type</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => toggleFilter('type', 'all')} className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedTypes.includes('all') ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>All Types</button>
              <button onClick={() => toggleFilter('type', 'ether')} className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedTypes.includes('ether') ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>Ethernet</button>
              <button onClick={() => toggleFilter('type', 'vlan')} className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedTypes.includes('vlan') ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>VLAN</button>
              <button onClick={() => toggleFilter('type', 'bridge')} className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedTypes.includes('bridge') ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>Bridge</button>
              <button onClick={() => toggleFilter('type', 'wlan')} className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedTypes.includes('wlan') ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>Wireless</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredIfaces.length === 0 && (
          <div className="col-span-1 lg:col-span-2 xl:col-span-3 py-12 text-center text-zinc-500 bg-zinc-900/20 border border-white/5 rounded-2xl">
            <Network className="w-12 h-12 text-zinc-600 mx-auto mb-4 opacity-50" />
            <p>No interfaces found matching criteria</p>
          </div>
        )}
        {filteredIfaces.map((vlan, i) => (
          <div key={i} className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Network className="w-24 h-24 text-indigo-400" />
             </div>
             
             <div className="flex justify-between items-start mb-4 relative z-10">
               <div>
                 <h3 className="text-lg font-bold text-white break-words pr-2">{vlan.name}</h3>
                 <div className="flex flex-wrap items-center gap-2 mt-2">
                   <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block ${
                     vlan.disabled === 'true' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                   }`}>
                     {vlan.disabled === 'true' ? 'Disabled' : 'Running'}
                   </span>
                   {vlan.type === 'vlan' && vlan.interface && (
                     <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">
                       via {vlan.interface}
                     </span>
                   )}
                   <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block bg-zinc-800 text-zinc-300 uppercase tracking-wider">
                     {vlan.type || 'unknown'}
                   </span>
                 </div>
               </div>
               <div className="p-2 bg-indigo-500/20 rounded-lg">
                 <Activity className="w-5 h-5 text-indigo-400" />
               </div>
             </div>

             <div className="space-y-4 mt-6 relative z-10">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                    <p className="text-xs text-zinc-500 font-medium mb-1 uppercase tracking-wider">RX Traffic</p>
                    <p className="text-sm font-bold text-emerald-400">{formatBytes(vlan['rx-byte'])}</p>
                    <p className="text-xs text-zinc-500 mt-1">{formatBytes(vlan['rx-rate'])}/s</p>
                  </div>
                  <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                    <p className="text-xs text-zinc-500 font-medium mb-1 uppercase tracking-wider">TX Traffic</p>
                    <p className="text-sm font-bold text-rose-400">{formatBytes(vlan['tx-byte'])}</p>
                    <p className="text-xs text-zinc-500 mt-1">{formatBytes(vlan['tx-rate'])}/s</p>
                  </div>
                </div>
                
                 <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500">RX Packets</p>
                    <p className="text-sm text-zinc-300 font-medium">{Number(vlan['rx-packet']).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">TX Packets</p>
                    <p className="text-sm text-zinc-300 font-medium">{Number(vlan['tx-packet']).toLocaleString()}</p>
                  </div>
                </div>
                 {/* Graph */}
                 <div className="pt-4 mt-4 border-t border-zinc-800/50">
                   <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wider font-bold">Traffic History</p>
                   <div className="h-32 w-full">
                     {(() => {
                       const chartPoints = getVlanHistory(vlan.name);
                       const hasData = chartPoints.some(p => p.rx > 0 || p.tx > 0);
                       if (!hasData) return (
                         <div className="h-full flex items-center justify-center text-zinc-600 text-xs">No history data</div>
                       );
                       return (
                         <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={chartPoints} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                             <defs>
                               <linearGradient id={`gRX${i}`} x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#34d399" stopOpacity={0.8}/>
                                 <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                               </linearGradient>
                               <linearGradient id={`gTX${i}`} x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#fb7185" stopOpacity={0.8}/>
                                 <stop offset="95%" stopColor="#fb7185" stopOpacity={0}/>
                               </linearGradient>
                             </defs>
                             <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                             <XAxis dataKey="time" tick={{fill: '#52525b', fontSize: 9}} minTickGap={40} axisLine={false} tickLine={false} />
                             <Tooltip
                               contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '11px' }}
                               labelStyle={{ color: '#a1a1aa' }}
                               formatter={(value: any, name: string) => [`${value} kbps`, name === 'rx' ? '↓ Received' : '↑ Sent']}
                             />
                             <Area type="monotone" dataKey="rx" stroke="#34d399" strokeWidth={1.5} fillOpacity={1} fill={`url(#gRX${i})`} dot={false} />
                             <Area type="monotone" dataKey="tx" stroke="#fb7185" strokeWidth={1.5} fillOpacity={1} fill={`url(#gTX${i})`} dot={false} />
                           </AreaChart>
                         </ResponsiveContainer>
                       );
                     })()}
                   </div>
                   <div className="flex items-center gap-4 mt-2">
                     <span className="flex items-center gap-1 text-[10px] text-zinc-500"><span className="w-2 h-0.5 bg-emerald-400 inline-block rounded"></span>RX</span>
                     <span className="flex items-center gap-1 text-[10px] text-zinc-500"><span className="w-2 h-0.5 bg-rose-400 inline-block rounded"></span>TX</span>
                   </div>
                 </div>
             </div>
          </div>
        ))}

        {vlans.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
            <Network className="w-12 h-12 mb-4 opacity-50" />
            <p>No VLAN interfaces found for the selected view.</p>
          </div>
        )}
      </div>
    </div>
  );
}
