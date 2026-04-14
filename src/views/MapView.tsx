import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Search, Server, Wifi as WifiIcon, Info, Users, Activity, 
  ChevronLeft, ChevronRight, Layers, Map as MapIcon, 
  Zap, Navigation2, BarChart3, Layers as LayersIcon
} from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { Loader } from '../components/common/Loader';
import { MikroTikDevice } from '../types';
import ReactDOMServer from 'react-dom/server';

// Fix typical Leaflet icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export function MapView() {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mapStyle, setMapStyle] = useState<'standard' | 'dark'>('standard');

  useEffect(() => {
    const fetchMap = () => {
      authFetch('/api/campus-map')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setBuildings(data);
        })
        .finally(() => setLoading(false));
    };
    fetchMap();
    const interval = setInterval(fetchMap, 30000); // 30s refresh rate for map
    return () => clearInterval(interval);
  }, []);

  const totalCapacity = buildings.reduce((acc, b) => acc + b.floors.reduce((fAcc, f) => fAcc + f.rooms.reduce((rAcc, r) => rAcc + r.cap, 0), 0), 0);
  const totalCurrent = buildings.reduce((acc, b) => acc + b.floors.reduce((fAcc, f) => fAcc + f.rooms.reduce((rAcc, r) => rAcc + r.current, 0), 0), 0);

  const getHeatColor = (current: number, cap: number) => {
    if (cap === 0) return '#3f3f46';
    const ratio = current / cap;
    if (ratio > 0.8) return '#ef4444'; // Red
    if (ratio > 0.5) return '#eab308'; // Yellow
    return '#10b981'; // Green
  };

  const filteredBuildings = buildings.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.floors.some(f => f.rooms.some(r => r.name.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  // Custom Icon Generator
  const createCustomIcon = (name: string, isSelected: boolean, color: string) => {
    return L.divIcon({
      className: 'custom-div-icon',
      html: ReactDOMServer.renderToString(
        <div className="flex items-center gap-2 group">
          <div className={`p-2 rounded-lg border-2 shadow-lg transition-all duration-300 ${isSelected ? 'scale-125 bg-white border-indigo-500 text-indigo-500' : 'bg-zinc-900 border-zinc-700 text-white'}`}
               style={{ borderColor: isSelected ? undefined : color }}>
            {isSelected ? <WifiIcon size={20} /> : <Server size={20} />}
          </div>
          {!isSelected && (
            <div className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 px-2.5 py-1 rounded-md shadow-xl whitespace-nowrap">
               <span className="text-[10px] font-black text-white uppercase tracking-tighter">{name}</span>
            </div>
          )}
        </div>
      ),
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  // Helper component to pan map
  function MapController({ selectedId, buildings }: { selectedId: string | null, buildings: any[] }) {
    const map = useMap();
    useEffect(() => {
      if (selectedId) {
        const b = buildings.find(b => b.id === selectedId);
        if (b) {
          map.setView([b.lat, b.lng], 19, { animate: true });
        }
      }
    }, [selectedId, buildings, map]);
    return null;
  }

  if (loading) {
    return <div className="flex h-[calc(100vh-64px)] items-center justify-center"><Loader /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden animate-in fade-in duration-500 relative bg-zinc-950">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <div className={`relative bg-zinc-950/80 backdrop-blur-md border-r border-zinc-800 flex flex-col z-20 transition-all duration-500 ease-in-out shrink-0 ${isSidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'w-80 opacity-100'}`}>
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white tracking-tight">Campus Radar</h2>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Cari gedung atau ruangan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-700/50 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
            />
          </div>
          <div className="mt-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Campus Density</span>
              <span className="text-sm font-black text-white">{totalCurrent} <span className="text-zinc-500 text-[10px] font-medium">/ {totalCapacity}</span></span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-1000"
                style={{ width: `${totalCapacity ? Math.min(100, (totalCurrent / totalCapacity) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredBuildings.map(building => {
            const bCurrent = building.floors.reduce((acc, f) => acc + f.rooms.reduce((r, room) => r + room.current, 0), 0);
            const bCap = building.floors.reduce((acc, f) => acc + f.rooms.reduce((r, room) => r + room.cap, 0), 0);
            const isSelected = selectedId === building.id;
            
            return (
              <div 
                key={building.id} 
                onClick={() => setSelectedId(building.id)}
                className={`group bg-zinc-900 border transition-all duration-300 rounded-xl p-4 cursor-pointer relative overflow-hidden
                  ${isSelected ? 'border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500/20' : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'}`}
              >
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />}
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`font-bold text-xs uppercase tracking-tight transition-colors ${isSelected ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{building.name}</h3>
                  <div className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-0.5 rounded-full border transition-colors
                    ${isSelected ? 'bg-indigo-500 text-white border-transparent' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                    {bCurrent}/{bCap}
                  </div>
                </div>
                {!building.hasWifi && (
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-rose-500 font-black uppercase">
                    <Zap className="w-3 h-3" />
                    <span>Signal Offline</span>
                  </div>
                )}

                {/* Floor Selector Stack */}
                {isSelected && building.floors.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-800 animate-in slide-in-from-top-2 fade-in duration-300">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <LayersIcon className="w-3 h-3" /> Level Explorer
                    </h4>
                    <div className="flex flex-col gap-2">
                       <button 
                         onClick={(e) => { e.stopPropagation(); setSelectedFloor(null); }}
                         className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-xs font-bold transition-all ${!selectedFloor ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/80'}`}
                       >
                         <span>Building Overview</span>
                         <span className={!selectedFloor ? "bg-black/20 px-1.5 py-0.5 rounded" : "bg-zinc-900 px-1.5 py-0.5 rounded"}>{bCurrent}/{bCap}</span>
                       </button>
                       {building.floors.map((floor: any, idx: number) => {
                         const fLevel = floor.level || `Floor ${idx+1}`;
                         const isFSelected = selectedFloor === fLevel;
                         const fCurrent = floor.rooms.reduce((r: number, room: any) => r + room.current, 0);
                         const fCap = floor.rooms.reduce((r: number, room: any) => r + room.cap, 0);
                         
                         return (
                           <button
                             key={idx}
                             onClick={(e) => { e.stopPropagation(); setSelectedFloor(fLevel); }}
                             className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-xs font-bold transition-all ${isFSelected ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-zinc-800/30 text-zinc-400 hover:bg-zinc-800'}`}
                           >
                             <span>{fLevel}</span>
                             <span className={isFSelected ? "bg-black/20 px-1.5 py-0.5 rounded" : "bg-zinc-900 px-1.5 py-0.5 rounded"}>{fCurrent}/{fCap}</span>
                           </button>
                         );
                       })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Toggle Handle ────────────────────────────────────────────────── */}
      <button 
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className={`absolute left-0 top-1/2 -translate-y-1/2 z-30 w-5 h-12 bg-zinc-900 border border-zinc-800 rounded-r-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all shadow-xl group
          ${isSidebarCollapsed ? 'translate-x-0' : 'translate-x-80'}`}
      >
        {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* ── Map Container ────────────────────────────────────────────────── */}
      <div className="flex-1 relative bg-zinc-900 z-0 overflow-hidden">
        <MapContainer 
          center={[-7.2908, 112.779]} 
          zoom={18} 
          zoomControl={false}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <MapController selectedId={selectedId} buildings={buildings} />

          {/* Standard OSM vs Dark CartoDB */}
          <TileLayer
            url={mapStyle === 'standard' 
              ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {buildings.map(building => {
             const bCurrent = building.floors.reduce((acc, f) => acc + f.rooms.reduce((r, room) => r + room.current, 0), 0);
             const bCap = building.floors.reduce((acc, f) => acc + f.rooms.reduce((r, room) => r + room.cap, 0), 0);
             
             // Base color logic on selected floor if applicable
             let displayCurrent = bCurrent;
             let displayCap = bCap;
             let displayFloors = building.floors;
             
             if (selectedId === building.id && selectedFloor) {
                const f = building.floors.find((f:any) => (f.level || `Floor ${building.floors.indexOf(f)+1}`) === selectedFloor);
                if (f) {
                   displayCurrent = f.rooms.reduce((r: number, room: any) => r + room.current, 0);
                   displayCap = f.rooms.reduce((r: number, room: any) => r + room.cap, 0);
                   displayFloors = [f];
                }
             }
             
             const color = getHeatColor(displayCurrent, displayCap);
             const isSelected = selectedId === building.id;
             
             return (
               <Marker 
                  key={building.id}
                  position={[building.lat, building.lng]}
                  icon={createCustomIcon(building.name, selectedId === building.id, color)}
                  eventHandlers={{
                    click: () => { setSelectedId(building.id); setSelectedFloor(null); },
                    popupclose: () => { setSelectedId(null); setSelectedFloor(null); }
                  }}
               >
                 <Popup className="custom-popup" autoPan={false}>
                   <div className="font-sans text-sm min-w-[240px] bg-white rounded-lg p-1">
                     <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                        <div className="flex items-center gap-2">
                           <div className={`w-2.5 h-2.5 rounded-full ${building.hasWifi !== false ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'}`} />
                           <h3 className="font-black text-gray-900 text-sm uppercase tracking-tight">{building.name} {selectedFloor ? `- ${selectedFloor}` : ''}</h3>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">ID: {building.id.split('-').pop()}</span>
                     </div>

                     <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                           <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                              <Users size={12} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Clients</span>
                           </div>
                           <p className="text-lg font-black text-gray-900 leading-none">{displayCurrent} <span className="text-[10px] text-gray-400 font-medium">/ {displayCap || 250}</span></p>
                        </div>
                        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                           <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                              <Activity size={12} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Status</span>
                           </div>
                           <p className={`text-xs font-black uppercase tracking-tight ${building.hasWifi !== false ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {building.hasWifi !== false ? 'Operational' : 'No Signal'}
                           </p>
                        </div>
                     </div>
                     
                     <div className="space-y-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                       {displayFloors.map((floor: any, idx: number) => (
                         <div key={idx} className="mb-2">
                           <div className="flex items-center gap-2 mb-1.5">
                              <div className="h-px flex-1 bg-gray-100" />
                              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-2">{floor.level || `Floor ${idx+1}`}</span>
                              <div className="h-px flex-1 bg-gray-100" />
                           </div>
                           <div className="space-y-1">
                             {floor.rooms.map((room: any) => (
                               <div key={room.id} className="flex justify-between items-center text-[11px] bg-white p-2 rounded-lg border border-gray-100 hover:border-indigo-100 transition-colors">
                                 <span className="text-gray-600 font-medium">{room.name}</span>
                                 <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-12 bg-gray-100 rounded-full overflow-hidden">
                                       <div className="h-full bg-indigo-500" style={{ width: `${(room.current/room.cap)*100}%` }} />
                                    </div>
                                    <span className="font-bold text-gray-900 min-w-[30px] text-right">{room.current}</span>
                                 </div>
                               </div>
                             ))}
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 </Popup>
               </Marker>
             );
          })}
        </MapContainer>

        {/* ── Visual Controls (Style Toggler) ────────────────────────────────── */}
        <div className="absolute top-6 right-6 z-10 flex flex-col gap-2">
           <button 
             onClick={() => setMapStyle(mapStyle === 'dark' ? 'standard' : 'dark')}
             className="p-3 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-xl shadow-2xl text-white hover:bg-zinc-800 transition-all group"
             title="Ganti Style Peta"
           >
             {mapStyle === 'dark' ? <MapIcon className="w-5 h-5" /> : <Layers className="w-5 h-5 text-indigo-400" />}
           </button>
        </div>

        {/* ── Campus Summary Widget ─────────────────────────────────────────── */}
        <div className="absolute top-6 left-6 z-10 transition-all duration-500 pointer-events-none" style={{ marginLeft: isSidebarCollapsed ? '0px' : '320px' }}>
           <div className="bg-zinc-900/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-zinc-800 shadow-2xl pointer-events-auto flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Campus Health</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-black text-white">94% WiFi Active</span>
                </div>
              </div>
              <div className="h-8 w-px bg-zinc-800" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Peak Occupancy</span>
                <div className="flex items-center gap-2 text-rose-400">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="text-sm font-black italic">Building G</span>
                </div>
              </div>
           </div>
        </div>
        
        {/* ── Legend ──────────────────────────────────────────────────────── */}
        <div className="absolute bottom-6 right-6 z-10 bg-zinc-900/90 backdrop-blur-md p-4 rounded-2xl border border-zinc-800 shadow-2xl">
           <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Density Thresholds</h4>
           <div className="space-y-3">
             <div className="flex items-center gap-3">
               <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
               <span className="text-xs text-zinc-300 font-bold uppercase tracking-tight">Low (Safe)</span>
             </div>
             <div className="flex items-center gap-3">
               <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]" />
               <span className="text-xs text-zinc-300 font-bold uppercase tracking-tight">Medium (Warn)</span>
             </div>
             <div className="flex items-center gap-3">
               <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]" />
               <span className="text-xs text-zinc-300 font-bold uppercase tracking-tight">High (Peak)</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
