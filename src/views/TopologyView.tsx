import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Network, Server, Monitor, Router as RouterIcon,
  Wifi, X, Signal, Users, Clock, Radio,
  CheckCircle, XCircle, AlertCircle, Maximize, Minimize, ChevronRight, HelpCircle, ChevronUp, ChevronDown, Filter
} from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { Loader } from '../components/common/Loader';
import { useLocation } from 'react-router-dom';

interface ClientDetail {
  mac: string;
  ip: string;
  hostname: string;
  signal: string;
  txRate: string;
  rxRate: string;
  uptime: string;
  interface: string;
  status?: string;
  isStatic?: boolean;
}

interface TopologyNode {
  id: string;
  name: string;
  type: 'cloud' | 'router' | 'switch' | 'ap' | 'client';
  status: 'online' | 'offline' | 'disabled';
  lastSeen?: string;
  clients?: number;
  clientDetails?: ClientDetail[];
  ssid?: string;
  band?: string;
  channel?: string;
  frequency?: string;
  host?: string;
  isPrimary?: boolean;
  wifiSource?: 'CAPsMAN' | 'WLAN' | 'Backbone' | 'none';
  children?: TopologyNode[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const getStatusColors = (status: string) => {
  if (status === 'online')   return { border: 'border-indigo-500/40', bg: 'bg-indigo-500/20', text: 'text-indigo-400',  badge: 'bg-emerald-500/20 text-emerald-400', glow: 'shadow-indigo-500/20' };
  if (status === 'disabled') return { border: 'border-amber-500/30',  bg: 'bg-amber-500/20',  text: 'text-amber-400',   badge: 'bg-amber-500/20 text-amber-400',   glow: 'shadow-amber-500/20'  };
  return                            { border: 'border-red-500',   bg: 'bg-red-500/20',   text: 'text-red-500',    badge: 'bg-red-500 text-white',     glow: 'shadow-red-500/40'   };
};
const getWifiSourceCls = (src?: string) => {
  if (src === 'CAPsMAN') return 'bg-violet-500/20 text-violet-300 border border-violet-500/30';
  if (src === 'WLAN')    return 'bg-cyan-500/20   text-cyan-300   border border-cyan-500/30';
  if (src === 'Backbone') return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
  return '';
};
const getIcon = (type: string) => {
  if (type === 'cloud')  return Network;
  if (type === 'router') return Server;
  if (type === 'switch') return RouterIcon;
  if (type === 'ap')     return Wifi;
  return Monitor;
};

const LEGEND_ITEMS = [
  { icon: Network,    label: 'Internet',  color: 'text-indigo-400' },
  { icon: Server,     label: 'Core Router', color: 'text-zinc-400' },
  { icon: RouterIcon, label: 'Switch',    color: 'text-zinc-400' },
  { icon: Wifi,       label: 'Access Pt', color: 'text-emerald-400' },
  { icon: Radio,      label: 'Backbone',  color: 'text-rose-400' },
];

// ── AP Card ──────────────────────────────────────────────────────────────────
function APCard({ node, selected, onClick }: { node: TopologyNode; selected: boolean; onClick: () => void }) {
  const c = getStatusColors(node.status);
  const isBackbone = node.wifiSource === 'Backbone';
  const Icon = isBackbone ? Radio : getIcon(node.type);
  const themeCls = isBackbone 
    ? (node.status === 'online' ? 'border-rose-500/50 bg-rose-950/20' : 'border-zinc-700 bg-zinc-900/50')
    : `${c.border} bg-zinc-900/90`;

  return (
    <button
      id={`node-${node.id}`}
      onClick={onClick}
      className={`flex flex-col items-center p-2.5 rounded-xl border backdrop-blur-xl transition-all duration-200 hover:scale-105 w-[108px]
        ${selected ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-zinc-950' : ''}
        ${themeCls} shadow-md`}
    >
      <div className={`p-1.5 rounded-lg mb-1 ${isBackbone ? 'bg-rose-500/20' : c.bg}`}>
        <Icon className={`w-4 h-4 ${isBackbone ? 'text-rose-400' : c.text} ${node.status === 'online' ? 'animate-pulse' : ''}`} />
      </div>
      <p className={`font-bold text-[10px] text-center truncate w-full px-0.5 leading-tight ${isBackbone ? 'text-rose-200' : 'text-zinc-100'}`}>{node.name}</p>
      {node.ssid && node.ssid !== '-' && (
        <p className={`text-[8px] mt-0.5 truncate w-full text-center ${isBackbone ? 'text-rose-300/70 italic' : 'text-indigo-300'}`}>{node.ssid}</p>
      )}
      <div className="flex flex-wrap justify-center gap-1 mt-1">
        <span className={`text-[8px] uppercase font-bold px-1 py-0.5 rounded-full ${c.badge}`}>{node.status}</span>
        {node.wifiSource && node.wifiSource !== 'none' && (
          <span className={`text-[7px] font-bold px-1 py-0.5 rounded-full ${getWifiSourceCls(node.wifiSource)}`}>{node.wifiSource}</span>
        )}
        {(node.clients ?? 0) > 0 && (
          <span className="text-[8px] text-zinc-400 flex items-center gap-0.5">
            <Users className="w-2 h-2" />{node.clients}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Router Column ─────────────────────────────────────────────────────────────
function RouterColumn({ router, selectedNode, onSelect }: {
  router: TopologyNode;
  selectedNode: TopologyNode | null;
  onSelect: (n: TopologyNode | null) => void;
}) {
  const c = getStatusColors(router.status);
  const Icon = getIcon(router.type);
  const isSelected = selectedNode?.id === router.id;
  const coreSwitch = router.children?.[0];
  const apNodes = coreSwitch?.children || [];
  const totalClients = apNodes.reduce((s, a) => s + (a.clients || 0), 0);
  const offlineAPs = apNodes.filter(a => a.status !== 'online').length;

  return (
    <div className="flex flex-col items-center">
      {/* ↓ line from horizontal bar to router */}
      <div className="w-px h-8 bg-indigo-500/30" />

      {/* Router node */}
      <button
        id={`node-${router.id}`}
        onClick={() => onSelect(isSelected ? null : router)}
        className={`flex flex-col items-center p-3 rounded-2xl border backdrop-blur-xl transition-all duration-200 hover:scale-105 w-[190px]
          ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-zinc-950' : ''}
          ${c.border} bg-zinc-900/90 shadow-xl`}
      >
        <div className={`p-2.5 rounded-xl mb-1.5 ${c.bg}`}>
          <Icon className={`w-6 h-6 ${c.text} ${router.status === 'online' ? 'animate-pulse' : ''}`} />
        </div>
        <p className="font-bold text-zinc-100 text-xs text-center truncate w-full px-1">{router.name}</p>
        {router.host && <p className="text-[9px] font-mono text-zinc-500 mt-0.5">{router.host}</p>}
        <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5">
          <span className={`text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-full ${c.badge}`}>{router.status}</span>
          {router.wifiSource && router.wifiSource !== 'none' && (
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${getWifiSourceCls(router.wifiSource)}`}>{router.wifiSource}</span>
          )}
        </div>
        {/* Mini stats */}
        <div className="flex items-center gap-3 mt-2 text-[9px] text-zinc-500 flex-wrap justify-center">
          <span className="flex items-center gap-0.5"><Wifi className="w-2.5 h-2.5 text-indigo-400" />{apNodes.length}</span>
          <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5 text-emerald-400" />{totalClients}</span>
          {offlineAPs > 0 && (
            <span className="flex items-center gap-0.5 text-rose-400"><XCircle className="w-2.5 h-2.5" />{offlineAPs}</span>
          )}
        </div>
      </button>

      {/* ↓ line to Core Switch */}
      {coreSwitch && <div className="w-px h-5 bg-indigo-500/20" />}

      {/* Core Switch (compact pill) */}
      {coreSwitch && (
        <>
          <button
            onClick={() => onSelect(selectedNode?.id === coreSwitch.id ? null : coreSwitch)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all hover:scale-105
              ${selectedNode?.id === coreSwitch.id ? 'ring-1 ring-indigo-400' : ''}
              ${getStatusColors(coreSwitch.status).border} bg-zinc-900/90`}
          >
            <RouterIcon className={`w-3.5 h-3.5 ${getStatusColors(coreSwitch.status).text}`} />
            <span className="text-[10px] font-bold text-zinc-300">Core Switch</span>
            <span className={`text-[7px] uppercase font-bold px-1 py-0.5 rounded-full ${getStatusColors(coreSwitch.status).badge}`}>
              {coreSwitch.status}
            </span>
          </button>
          {apNodes.length > 0 && <div className="w-px h-5 bg-zinc-700/40" />}
        </>
      )}

      {/* AP Grid — max 6 per row */}
      {apNodes.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 max-w-[700px]">
          {apNodes.map((ap, idx) => (
            <div key={`${router.id}-${ap.id}-${idx}`} className="flex flex-col items-center">
              <div className="w-px h-3 bg-zinc-700/40" />
              <APCard
                node={ap}
                selected={selectedNode?.id === ap.id}
                onClick={() => onSelect(selectedNode?.id === ap.id ? null : ap)}
              />
            </div>
          ))}
        </div>
      )}

      {/* No APs placeholder */}
      {apNodes.length === 0 && router.status === 'online' && (
        <div className="mt-3 text-center text-zinc-700 text-[10px]">
          <Wifi className="w-5 h-5 mx-auto mb-1 opacity-20" />No segments
        </div>
      )}
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ node, topology, onClose }: {
  node: TopologyNode;
  topology: TopologyNode | null;
  onClose: () => void;
}) {
  const c = getStatusColors(node.status);
  const Icon = getIcon(node.type);
  const isRouter = node.type === 'router';
  
  const [width, setWidth] = useState(384);
  const [activeTab, setActiveTab] = useState<'details'|'logs'>('details');
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'logs') {
      const fetchId = `${node.type === 'router' ? 'router' : 'ap'}-${node.id}`;
      authFetch(`/api/topology/logs?id=${fetchId}`)
        .then(r => r.json())
        .then(data => setLogs(data)).catch();
    }
  }, [activeTab, node.id]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.cursor = 'ew-resize';
    const initX = e.clientX;
    const initW = width;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = initX - moveEvent.clientX;
      setWidth(Math.min(Math.max(300, initW + delta), 800));
    };
    const onMouseUp = () => {
      document.body.style.cursor = 'default';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const routerData = useMemo(() => {
    if (!isRouter || !topology) return null;
    const routerNode = topology.children?.find(r => r.id === node.id);
    if (!routerNode) return null;
    const aps = routerNode.children?.[0]?.children || [];
    const online = aps.filter(a => a.status === 'online');
    const offline = aps.filter(a => a.status !== 'online');
    const totalClients = aps.reduce((s, a) => s + (a.clients || 0), 0);
    return { aps, online, offline, totalClients };
  }, [node.id, topology, isRouter]);

  return (
    <div 
      style={{ width: `${width}px`, maxWidth: 'calc(100vw - 3rem)' }}
      className="bg-zinc-950 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300 relative flex-shrink-0 border-l border-zinc-800 z-[150] max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:shadow-2xl max-md:h-full"
    >
      <div onMouseDown={startResizing} className="absolute left-0 top-0 bottom-0 w-2 md:w-1.5 cursor-ew-resize hover:bg-indigo-500/50 z-20" />
      <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 bg-zinc-900/40 md:bg-transparent shadow-md md:shadow-none">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <h3 className="font-bold text-white text-sm">Node Details</h3>
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
             <button onClick={() => setActiveTab('details')} className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-colors ${activeTab==='details'?'bg-zinc-800 text-white shadow-sm':'text-zinc-500 hover:text-zinc-300'}`}>Details</button>
             <button onClick={() => setActiveTab('logs')} className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-colors ${activeTab==='logs'?'bg-indigo-600 text-white shadow-sm':'text-zinc-500 hover:text-zinc-300'}`}>Logs</button>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="p-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 hover:border-red-500/60 text-red-500 hover:text-red-400 rounded-xl transition-all shadow-lg shadow-red-500/10 group"
          title="Tutup Panel"
        >
          <X className="w-5 h-5 md:w-4 md:h-4 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'details' ? (
          <>
        {/* Header card */}
        <div className={`p-4 rounded-xl border ${c.border} bg-zinc-900`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${c.bg}`}><Icon className={`w-5 h-5 ${c.text}`} /></div>
            <div className="min-w-0">
              <p className="font-bold text-white truncate">{node.name}</p>
              <p className="text-xs text-zinc-500 capitalize">{node.type}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${c.badge}`}>{node.status}</span>
            {node.wifiSource && node.wifiSource !== 'none' && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getWifiSourceCls(node.wifiSource)}`}>via {node.wifiSource}</span>
            )}
          </div>
        </div>

        {/* Router aggregate stats */}
        {isRouter && routerData && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Network Summary</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-indigo-400">{routerData.aps.length}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Segments</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{routerData.totalClients}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Total Users</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
                <p className={`text-2xl font-bold ${routerData.offline.length > 0 ? 'text-rose-400' : 'text-zinc-600'}`}>{routerData.offline.length}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Down</p>
              </div>
            </div>
            {routerData.online.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />Online ({routerData.online.length})
                </p>
                {routerData.online.map(ap => (
                  <div key={ap.id} className="flex items-center justify-between bg-zinc-900/60 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-zinc-300 truncate max-w-[160px]">{ap.name}</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1"><Users className="w-2.5 h-2.5" />{ap.clients || 0}</span>
                  </div>
                ))}
              </div>
            )}
            {routerData.offline.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                  <XCircle className="w-3 h-3" />Down ({routerData.offline.length})
                </p>
                {routerData.offline.map(ap => (
                  <div key={ap.id} className="flex items-center justify-between bg-rose-950/30 border border-rose-900/30 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-zinc-400 truncate max-w-[160px]">{ap.name}</span>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full ${getStatusColors(ap.status).badge}`}>{ap.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info fields */}
        <div className="space-y-0">
          {[
            { label: 'IP Address', val: node.host, mono: true },
            { label: 'SSID', val: node.ssid !== '-' ? node.ssid : null, mono: false },
            { label: 'Band / Info', val: node.band !== '-' ? node.band : null, mono: false },
            { label: 'Frequency', val: node.frequency !== '-' ? (node.frequency ? node.frequency + ' MHz' : null) : null, mono: false },
            { label: 'Channel / Pool', val: node.channel !== '-' ? node.channel : null, mono: false },
          ].filter(f => f.val).map(f => (
            <div key={f.label} className="flex justify-between text-sm py-2 border-b border-zinc-800/60">
              <span className="text-zinc-400">{f.label}</span>
              <span className={f.mono ? 'font-mono text-zinc-200' : 'text-zinc-200'}>{f.val}</span>
            </div>
          ))}
          {node.clients !== undefined && (
            <div className="flex justify-between text-sm py-2 border-b border-zinc-800/60">
              <span className="text-zinc-400 flex items-center gap-1"><Users className="w-3 h-3" />Clients</span>
              <span className="text-emerald-400 font-bold">{node.clients}</span>
            </div>
          )}
          {node.lastSeen && (
            <div className="flex justify-between text-sm py-2 border-b border-zinc-800/60">
              <span className="text-zinc-400 flex items-center gap-1"><Clock className="w-3 h-3" />Last Seen</span>
              <span className="text-zinc-300 text-xs">{new Date(node.lastSeen).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* AP client list */}
        {node.type === 'ap' && node.clientDetails && node.clientDetails.length > 0 && (
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Connected Clients ({node.clientDetails.length})
            </p>
            <div className="space-y-2">
              {[...node.clientDetails].sort((a, b) => (b.isStatic ? 1 : 0) - (a.isStatic ? 1 : 0)).map((cl, i) => (
                <div key={i} className={`bg-zinc-900 border ${cl.isStatic ? 'border-violet-500/50 shadow-[0_0_10px_rgba(139,92,246,0.1)]' : 'border-zinc-800'} rounded-xl p-3 text-xs space-y-1.5`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-indigo-300 text-[11px]">{cl.mac}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {cl.isStatic && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                          INFRA
                        </span>
                      )}
                      {cl.status && cl.status !== '-' && !cl.isStatic && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          cl.status === 'bound' ? 'bg-emerald-500/20 text-emerald-400' :
                          cl.status === 'waiting' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-zinc-700 text-zinc-400'
                        }`}>{cl.status}</span>
                      )}
                      {cl.hostname && cl.hostname !== '-' && (
                        <span className={`${cl.isStatic ? 'text-violet-300 font-bold' : 'text-zinc-300 font-medium'} truncate max-w-[90px]`} title={cl.hostname}>{cl.hostname}</span>
                      )}
                    </div>
                  </div>
                  {cl.ip && cl.ip !== '-' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-600 text-[10px]">IP</span>
                      <span className="font-mono text-emerald-400">{cl.ip}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-zinc-500 flex-wrap">
                    {cl.signal && cl.signal !== '-' && (
                      <span className="flex items-center gap-0.5 text-amber-300">
                        <Signal className="w-2.5 h-2.5 text-amber-400" />{cl.signal}
                      </span>
                    )}
                    {cl.rxRate && cl.rxRate !== '-' && <span>↓ {cl.rxRate}</span>}
                    {cl.txRate && cl.txRate !== '-' && <span>↑ {cl.txRate}</span>}
                    {cl.uptime && cl.uptime !== '-' && (
                      <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{cl.uptime}</span>
                    )}
                  </div>
                  {cl.interface && cl.interface !== '-' && (
                    <div className="text-[10px] text-zinc-600">pool: {cl.interface}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {node.type === 'ap' && (!node.clientDetails || node.clientDetails.length === 0) && (
          <div className="text-center py-6 text-zinc-600 text-xs">
            <Wifi className="w-8 h-8 mx-auto mb-2 opacity-30" />No clients connected
          </div>
        )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Up/Down History</p>
            {logs.length === 0 ? (
              <div className="text-center text-zinc-500 text-xs py-8">No records available</div>
            ) : (
              <div className="space-y-2 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-800 before:to-transparent">
                {logs.map((log, idx) => (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className={`flex items-center justify-center w-4 h-4 rounded-full border-2 border-zinc-900 ${log.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'} group-[.is-active]:bg-indigo-500 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm`} />
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 shadow-md">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${log.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-500'}`}>
                          {log.status}
                        </span>
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-zinc-300">{new Date(log.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────
const MAX_ROUTERS_PER_ROW = 6;

export function TopologyView() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const highlightApName = searchParams.get('ap');
  const didAutoScroll = useRef(false);

  const [topology, setTopology] = useState<TopologyNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [activeRouters, setActiveRouters] = useState<Set<string>>(new Set(['all']));
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [topologySearch, setTopologySearch] = useState('');
  const [searchMatches, setSearchMatches] = useState<TopologyNode[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Search logic
  const handleSearch = (term: string) => {
    setTopologySearch(term);
    if (!term.trim() || !topology) {
      setSearchMatches([]);
      setActiveMatchIndex(-1);
      return;
    }

    const matches: TopologyNode[] = [];
    const findNodes = (node: TopologyNode) => {
      if (node.name.toLowerCase().includes(term.toLowerCase()) || 
          (node.ssid || '').toLowerCase().includes(term.toLowerCase()) ||
          (node.host || '').toLowerCase().includes(term.toLowerCase())) {
        matches.push(node);
      }
      node.children?.forEach(findNodes);
    };
    
    topology.children?.forEach(findNodes);
    setSearchMatches(matches);
    
    if (matches.length > 0) {
      const idx = 0;
      setActiveMatchIndex(idx);
      focusOnNode(matches[idx]);
    } else {
      setActiveMatchIndex(-1);
    }
  };

  const focusOnNode = (node: TopologyNode) => {
    setSelectedNode(node);
    setActiveRouters(new Set(['all'])); // ensure it's visible
    setTimeout(() => {
      const el = document.getElementById(`node-${node.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 100);
  };

  const nextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % searchMatches.length;
    setActiveMatchIndex(nextIdx);
    focusOnNode(searchMatches[nextIdx]);
  };

  useEffect(() => {
    const fetchTopo = () => {
      authFetch('/api/topology/dynamic')
        .then(r => r.json())
        .then(data => {
          if (data?.id) { setTopology(data); setLastUpdated(data.lastUpdated || new Date().toISOString()); }
        }).catch(console.error);
    };
    fetchTopo();
    const iv = setInterval(fetchTopo, 30000);
    return () => clearInterval(iv);
  }, []);

  // Auto-highlight + scroll when coming from Dashboard "Find in Topology"
  useEffect(() => {
    if (!topology || !highlightApName || didAutoScroll.current) return;
    const nameToFind = highlightApName.toLowerCase();
    let found: TopologyNode | null = null;
    for (const router of (topology.children || [])) {
      const aps = router.children?.[0]?.children || [];
      const match = aps.find((ap: TopologyNode) => ap.name.toLowerCase().includes(nameToFind));
      if (match) { found = match; break; }
    }
    if (found) {
      didAutoScroll.current = true;
      setSelectedNode(found);
      setActiveRouters(new Set(['all']));
      setTimeout(() => {
        const el = document.getElementById(`node-${found!.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }, 300);
    }
  }, [topology, highlightApName]);

  const allRouters = topology?.children || [];

  // Toggle filter logic
  const toggleRouter = (id: string) => {
    if (id === 'all') {
      setActiveRouters(new Set(['all']));
      return;
    }
    setActiveRouters(prev => {
      const next = new Set(prev);
      next.delete('all');
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) next.add('all');
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const visibleRouters = useMemo(() => {
    if (activeRouters.has('all')) return allRouters;
    return allRouters.filter(r => activeRouters.has(r.id));
  }, [allRouters, activeRouters]);

  // Split routers into rows of max MAX_ROUTERS_PER_ROW
  const routerRows = useMemo(() => {
    const rows: TopologyNode[][] = [];
    for (let i = 0; i < visibleRouters.length; i += MAX_ROUTERS_PER_ROW) {
      rows.push(visibleRouters.slice(i, i + MAX_ROUTERS_PER_ROW));
    }
    return rows;
  }, [visibleRouters]);

  const stats = useMemo(() => {
    let totalAP = 0, totalClients = 0, totalRoutersOnline = 0, totalDown = 0;
    allRouters.forEach(r => {
      const aps = r.children?.[0]?.children || [];
      totalAP += aps.length;
      totalClients += aps.reduce((s, a) => s + (a.clients || 0), 0);
      if (r.status === 'online') totalRoutersOnline++; else totalDown++;
    });
    return { totalAP, totalClients, totalRoutersOnline, totalDown, totalRouters: allRouters.length };
  }, [allRouters]);

  const offlineNodes = useMemo(() => {
    const nodes: TopologyNode[] = [];
    allRouters.forEach(r => {
      if (r.status !== 'online') nodes.push(r);
      r.children?.[0]?.children?.forEach((ap: TopologyNode) => {
        if (ap.status !== 'online') nodes.push(ap);
      });
    });
    return nodes;
  }, [allRouters]);

  return (
    <div className={`flex flex-col overflow-hidden animate-in fade-in duration-500 bg-zinc-950 ${isFullscreen ? 'fixed inset-0 z-[100]' : 'h-[calc(100vh-64px)]'}`}>

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl px-5 py-3 space-y-3">
        {/* Title row */}
        <div className="flex items-center gap-4 flex-wrap pb-1">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Network Topology
              <button 
                onClick={() => setIsFullscreen(!isFullscreen)} 
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </h2>
            {lastUpdated && <p className="text-[10px] text-zinc-600 mt-0.5">Updated {new Date(lastUpdated).toLocaleTimeString()}</p>}
          </div>
          {/* Stats pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* ── Search Bar (Now on the Left) ───────────────────── */}
            <div className="flex items-center bg-zinc-900 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 shadow-xl backdrop-blur-md mr-1 h-[34px]">
               <Monitor className="w-3.5 h-3.5 text-zinc-500 mr-2" />
               <input 
                 type="text"
                 placeholder="Search node..."
                 className="bg-transparent border-none outline-none text-[11px] text-zinc-100 w-24 md:w-36 placeholder:text-zinc-600"
                 value={topologySearch}
                 onChange={e => handleSearch(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && nextMatch()}
               />
               {searchMatches.length > 0 && (
                 <div className="flex items-center gap-1.5 border-l border-zinc-800 ml-2 pl-2">
                    <span className="text-[10px] text-zinc-500 font-bold whitespace-nowrap">{activeMatchIndex + 1}/{searchMatches.length}</span>
                    <button onClick={nextMatch} className="p-0.5 hover:bg-zinc-800 rounded transition-colors" title="Next Match">
                      <ChevronRight className="w-3 h-3 text-indigo-400" />
                    </button>
                 </div>
               )}
               {topologySearch && (
                 <button onClick={() => handleSearch('')} className="ml-0.5 p-0.5 hover:bg-zinc-800 rounded transition-colors" title="Clear Search">
                   <X className="w-3 h-3 text-zinc-500" />
                 </button>
               )}
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs text-zinc-300"><span className="font-bold text-indigo-400">{stats.totalRouters}</span> Router</span>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
              <Wifi className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs text-zinc-300"><span className="font-bold text-violet-400">{stats.totalAP}</span> Segments</span>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-zinc-300"><span className="font-bold text-emerald-400">{stats.totalClients}</span> Users</span>
            </div>
            {stats.totalDown > 0 && (
              <div className="flex items-center gap-1.5 bg-rose-950/50 border border-rose-900/50 rounded-lg px-3 py-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-xs text-rose-300"><span className="font-bold">{stats.totalDown}</span> Down</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Toggle Filter Row ──────────────────────────────────────────────── */}
        {allRouters.length > 0 && (
          <>
            {/* Desktop Filter */}
            <div className="hidden md:flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mr-1">Filter:</span>
              {/* "All" toggle */}
              <button
                onClick={() => toggleRouter('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border
                  ${activeRouters.has('all')
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                  }`}
              >
                <Network className="w-3 h-3" /> Semua
              </button>

              {/* Per-router toggle buttons */}
              {allRouters.map(router => {
                const isOn = activeRouters.has(router.id);
                const rc = getStatusColors(router.status);
                const apCount = router.children?.[0]?.children?.length || 0;
                const clients = router.children?.[0]?.children?.reduce((s: number, a: TopologyNode) => s + (a.clients || 0), 0) || 0;
                return (
                  <button
                    key={router.id}
                    onClick={() => toggleRouter(router.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border
                      ${isOn
                        ? 'bg-zinc-800 border-indigo-500/70 text-white shadow-md'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                      }`}
                  >
                    {/* Status dot */}
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${router.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <span className="truncate max-w-[140px]">{router.name}</span>
                    {isOn && (
                      <span className="flex items-center gap-2 text-[9px] text-zinc-400 ml-1">
                        <span className="text-violet-400">{apCount} seg</span>
                        <span className="text-emerald-400">{clients} usr</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mobile Filter Button */}
            <div className="md:hidden w-full pt-1">
              <button 
                onClick={() => setShowFilterModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600 text-zinc-200 rounded-xl font-bold shadow-sm transition-all"
              >
                <Filter className="w-4 h-4" />
                Filter Mikrotik {activeRouters.has('all') ? '(Semua)' : `(${activeRouters.size} Dipilih)`}
              </button>
            </div>
          </>
        )}
      </div>

      {offlineNodes.length > 0 && (
        <div className="flex-shrink-0 bg-red-950/40 border-b border-red-900/50 px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-red-400 font-medium">
            <AlertCircle className="w-4 h-4" />
            <span>Terdeteksi {offlineNodes.length} node jaringan sedang offline.</span>
          </div>
          <button 
            onClick={() => setShowOfflineModal(true)}
            className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 transition-colors font-bold"
          >
            Lihat Detail
          </button>
        </div>
      )}

      {/* ── Canvas + Sidebar ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          {!topology ? (
            <Loader message="Mapping infrastructure topology..." />
          ) : (
            <div className="flex flex-col items-center gap-0 w-max mx-auto">

              {/* Internet Node */}
              <button
                onClick={() => setSelectedNode(selectedNode?.id === topology.id ? null : topology)}
                className={`flex flex-col items-center p-4 rounded-2xl border backdrop-blur-xl transition-all hover:scale-105 min-w-[210px]
                  ${selectedNode?.id === topology.id ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-zinc-950' : ''}
                  border-indigo-500/40 bg-zinc-900/90 shadow-2xl`}
              >
                <div className="p-3 rounded-xl mb-2 bg-indigo-500/20">
                  <Network className="w-7 h-7 text-indigo-400 animate-pulse" />
                </div>
                <p className="font-bold text-zinc-100 text-sm">Public Internet</p>
                <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 mt-1">ONLINE</span>
              </button>

              {/* Rows of routers */}
              {routerRows.map((row, rowIdx) => (
                <div key={rowIdx} className="flex flex-col items-center">
                  {/* Vertical drop from internet/prev-row to horizontal bar */}
                  <div className="w-px h-8 bg-indigo-500/20" />

                  {/* Horizontal bar length = (routers in row) * approx width */}
                  {row.length > 1 && (
                    <div
                      className="h-px bg-zinc-700/50"
                      style={{ width: `${(row.length - 1) * 224 + 190}px` }}
                    />
                  )}

                  {/* Router columns in this row */}
                  <div
                    className="flex items-start justify-center"
                    style={{ gap: '34px' }}
                  >
                    {row.map(router => (
                      <div key={`row-${rowIdx}-${router.id}`}>
                        <RouterColumn
                          router={router}
                          selectedNode={selectedNode}
                          onSelect={node => setSelectedNode(node)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {visibleRouters.length === 0 && (
                <div className="mt-12 text-center text-zinc-600 text-sm">
                  <Server className="w-12 h-12 mx-auto mb-3 opacity-20" />No routers selected
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detail Sidebar */}
        {selectedNode && (
          <DetailPanel node={selectedNode} topology={topology} onClose={() => setSelectedNode(null)} />
        )}

        {/* ── Legend Overlay ──────────────────────────────────────────────── */}
        <div className={`absolute left-6 bottom-6 flex flex-col transition-all duration-300 z-10 ${isLegendOpen ? 'gap-2 p-3 bg-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl rounded-2xl shadow-2xl' : 'p-0'}`}>
           <button 
             onClick={() => setIsLegendOpen(!isLegendOpen)}
             className={`flex items-center gap-2 group transition-all ${isLegendOpen ? 'mb-1 pl-1' : 'bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-full shadow-2xl hover:bg-zinc-800 pointer-events-auto'}`}
             title={isLegendOpen ? "Collapse Legend" : "Show Legend"}
           >
              {isLegendOpen ? (
                <>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Legend</p>
                  <ChevronDown className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </>
              ) : (
                <HelpCircle className="w-5 h-5 text-indigo-400" />
              )}
           </button>
           
           {isLegendOpen && LEGEND_ITEMS.map((item, i) => (
             <div key={i} className="flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="p-1.5 bg-zinc-900 rounded-lg">
                  <item.icon className={`w-3 h-3 ${item.color}`} />
                </div>
                <span className="text-[10px] text-zinc-300 font-medium whitespace-nowrap">{item.label}</span>
             </div>
           ))}
        </div>
      </div>

      {showOfflineModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500" /> Offline Nodes</h3>
              <button onClick={() => setShowOfflineModal(false)} className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              {offlineNodes.map((node: any) => (
                <button 
                  key={node.id}
                  onClick={() => {
                    setSelectedNode(node);
                    setShowOfflineModal(false);
                    // Ensure the node is rendered in the DOM by clearing any filters
                    setActiveRouters(new Set(['all']));
                    
                    setTimeout(() => {
                      document.getElementById(`node-${node.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    }, 150);
                  }}
                  className="w-full text-left p-3 hover:bg-zinc-800/50 rounded-xl mb-1 flex items-center gap-3 transition-colors group border border-transparent hover:border-zinc-700"
                >
                  <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20">
                    {node.type === 'router' ? <Server className="w-5 h-5 text-red-500" /> : <Wifi className="w-5 h-5 text-red-500" />}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-200 text-sm">{node.name}</p>
                    <p className="text-xs text-zinc-500 capitalize">{node.type} {node.host ? `• ${node.host}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Filter Modal ──────────────────────────────────────────────── */}
      {showFilterModal && (
        <div className="fixed md:hidden inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="font-bold text-white flex items-center gap-2"><Filter className="w-5 h-5 text-indigo-400" /> Filter Mikrotik</h3>
              <button onClick={() => setShowFilterModal(false)} className="text-zinc-500 hover:text-white p-1 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2">
              <button
                onClick={() => toggleRouter('all')}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200
                  ${activeRouters.has('all') 
                    ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${activeRouters.has('all') ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-500'}`}>
                    <Network className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Tampilkan Semua</p>
                    <p className="text-[10px] opacity-70">Lihat seluruh topologi jaringan</p>
                  </div>
                </div>
                {activeRouters.has('all') && <CheckCircle className="w-5 h-5 text-indigo-400" />}
              </button>
              
              <div className="w-full h-px bg-zinc-800/50 my-1" />
              
              {allRouters.map(router => {
                const isOn = activeRouters.has(router.id);
                const apCount = router.children?.[0]?.children?.length || 0;
                const clients = router.children?.[0]?.children?.reduce((s: number, a: TopologyNode) => s + (a.clients || 0), 0) || 0;
                return (
                  <button
                    key={router.id}
                    onClick={() => toggleRouter(router.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200
                      ${isOn
                        ? 'bg-zinc-900 border-zinc-700 text-white shadow-sm'
                        : 'bg-zinc-950 border-zinc-800/50 text-zinc-500 hover:border-zinc-700'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${router.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <div className="text-left">
                        <p className={`font-bold text-sm ${isOn ? 'text-zinc-100' : 'text-zinc-400'}`}>{router.name}</p>
                        <p className={`text-[10px] ${isOn ? 'text-zinc-400' : 'text-zinc-600'}`}>{apCount} segmen, {clients} users</p>
                      </div>
                    </div>
                    {/* Toggle Switch */}
                    <div className={`w-10 h-5.5 rounded-full relative transition-colors ${isOn ? 'bg-indigo-500' : 'bg-zinc-800'}`}>
                      <div className={`w-4.5 h-4.5 rounded-full bg-white absolute top-0.5 transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0.5'} shadow-sm`} />
                    </div>
                  </button>
                );
              })}
            </div>
            
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
              <button 
                onClick={() => setShowFilterModal(false)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
              >
                Terapkan & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
