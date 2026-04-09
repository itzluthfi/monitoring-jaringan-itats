import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Search, Server, Wifi as WifiIcon, Info, Users, Activity } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { Building } from '../types';
import ReactDOMServer from 'react-dom/server';

// Fix typical Leaflet icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export function MapView() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMap = () => {
      authFetch('/api/campus-map').then(r => r.json()).then(data => {
        if (Array.isArray(data)) setBuildings(data);
      }).catch(console.error);
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

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden animate-in fade-in duration-500">
      <div className="w-80 bg-zinc-950/80 backdrop-blur-md border-r border-zinc-800 flex flex-col z-10 shrink-0">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white mb-4 tracking-tight">Campus Radar</h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search buildings or rooms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-700/50 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow"
            />
          </div>
          <div className="mt-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-zinc-400">Total Density</span>
              <span className="text-sm font-bold text-white">{totalCurrent} / {totalCapacity}</span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                style={{ width: `${totalCapacity ? Math.min(100, (totalCurrent / totalCapacity) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {filteredBuildings.map(building => {
            const bCurrent = building.floors.reduce((acc, f) => acc + f.rooms.reduce((r, room) => r + room.current, 0), 0);
            const bCap = building.floors.reduce((acc, f) => acc + f.rooms.reduce((r, room) => r + room.cap, 0), 0);
            
            return (
              <div key={building.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:bg-zinc-800/80 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-zinc-200">{building.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700">
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getHeatColor(bCurrent, bCap) }}
                    />
                    {bCurrent}/{bCap}
                  </div>
                </div>
                {!building.hasWifi && (
                  <p className="text-xs text-rose-400 font-medium">No AP Signal</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 relative bg-zinc-900 z-0">
        <MapContainer 
          center={[-7.2908, 112.779]} 
          zoom={18} 
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          {/* Standard OpenStreetMap Tiles (colored) */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {buildings.map(building => {
             const bCurrent = building.floors.reduce((acc, f) => acc + f.rooms.reduce((r, room) => r + room.current, 0), 0);
             const bCap = building.floors.reduce((acc, f) => acc + f.rooms.reduce((r, room) => r + room.cap, 0), 0);
             const color = getHeatColor(bCurrent, bCap);

             return (
               <Marker 
                  key={building.id}
                  position={[building.lat, building.lng]}
                  icon={createCustomIcon(building.name, selectedId === building.id, color)}
                  eventHandlers={{
                    click: () => setSelectedId(building.id),
                    popupclose: () => setSelectedId(null)
                  }}
               >
                 <Popup className="custom-popup">
                   <div className="font-sans text-sm min-w-[240px] bg-white rounded-lg p-1">
                     <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                        <div className="flex items-center gap-2">
                           <div className={`w-2.5 h-2.5 rounded-full ${building.hasWifi !== false ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'}`} />
                           <h3 className="font-black text-gray-900 text-sm uppercase tracking-tight">{building.name}</h3>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">ID: {building.id.split('-').pop()}</span>
                     </div>

                     <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                           <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                              <Users size={12} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Clients</span>
                           </div>
                           <p className="text-lg font-black text-gray-900 leading-none">{bCurrent} <span className="text-[10px] text-gray-400 font-medium">/ {bCap || 250}</span></p>
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
                       {building.floors.map((floor, idx) => (
                         <div key={idx} className="mb-2">
                           <div className="flex items-center gap-2 mb-1.5">
                              <div className="h-px flex-1 bg-gray-100" />
                              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-2">{floor.level || `Floor ${idx+1}`}</span>
                              <div className="h-px flex-1 bg-gray-100" />
                           </div>
                           <div className="space-y-1">
                             {floor.rooms.map(room => (
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
        
        <div className="absolute bottom-6 right-6 z-10 bg-zinc-900/90 backdrop-blur-md p-4 rounded-xl border border-zinc-700 shadow-2xl">
           <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Density Legend</h4>
           <div className="space-y-2">
             <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span><span className="text-sm text-zinc-300">Low (0 - 50%)</span></div>
             <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500"></span><span className="text-sm text-zinc-300">Medium (51 - 80%)</span></div>
             <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-500"></span><span className="text-sm text-zinc-300">High (&gt;80%)</span></div>
           </div>
        </div>
      </div>
    </div>
  );
}
