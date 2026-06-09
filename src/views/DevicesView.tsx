import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Edit2, Play, AlertTriangle, Monitor, Activity, Radio, Key, Search, ArrowLeft, Server, Eye, EyeOff, Layers, Download, X } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { Loader } from '../components/common/Loader';
import { encryptId, decryptId } from '../lib/encryption';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix typical Leaflet icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapEventsHandler({ onMapClick }: { onMapClick: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function MapCenterController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom() || 17);
    }
  }, [lat, lng, map]);
  
  return null;
}

export function DevicesView() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any>(null);
  
  const [formData, setFormData] = useState({ name: '', host: '', user: '', password: '', port: '8728', lat: '', lng: '', level: '', driver: 'mikrotik', snmp_community: 'public', snmp_port: '161' });
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showSavedPassword, setShowSavedPassword] = useState(false);
  const [savedPassword, setSavedPassword] = useState('');
  const [showIP, setShowIP] = useState(false);
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, any>>({});

  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchResults, setMapSearchResults] = useState<any[]>([]);
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-7.2908, 112.779]); // ITATS center

  const handleMapSearch = async () => {
    if (!mapSearchQuery.trim()) return;
    setIsSearchingMap(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setMapSearchResults(data);
        if (data.length === 0) {
          toast.error('Lokasi tidak ditemukan');
        }
      } else {
        toast.error('Gagal mencari lokasi');
      }
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan koneksi');
    } finally {
      setIsSearchingMap(false);
    }
  };

  const selectMapSearchResult = (result: any) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    setMapCenter([lat, lng]);
    setFormData(prev => ({ ...prev, lat: String(lat), lng: String(lng) }));
    setMapSearchResults([]);
    setMapSearchQuery('');
  };

  const handleMapClick = (latlng: L.LatLng) => {
    const lat = Number(latlng.lat.toFixed(6));
    const lng = Number(latlng.lng.toFixed(6));
    setMapCenter([lat, lng]);
    setFormData(prev => ({ ...prev, lat: String(lat), lng: String(lng) }));
  };

  const handleLatChange = (val: string) => {
    setFormData(prev => ({ ...prev, lat: val }));
    const parsed = Number(val);
    if (!isNaN(parsed) && parsed !== 0) {
      setMapCenter(prev => [parsed, prev[1]]);
    }
  };

  const handleLngChange = (val: string) => {
    setFormData(prev => ({ ...prev, lng: val }));
    const parsed = Number(val);
    if (!isNaN(parsed) && parsed !== 0) {
      setMapCenter(prev => [prev[0], parsed]);
    }
  };

  const detailIdHash = searchParams.get('detail');
  const detailId = detailIdHash ? decryptId(detailIdHash) : null;

  const fetchDevices = () => {
    authFetch('/api/mikrotiks')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setDevices(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDevices();
    // Fetch available drivers from adapter registry
    authFetch('/api/adapters/drivers').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setAvailableDrivers(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    devices.forEach(device => {
      authFetch(`/api/mikrotiks/${device.id}/status`)
        .then(res => res.json())
        .then(data => {
          setDeviceStatuses(prev => ({ ...prev, [device.id]: data }));
        });
    });
  }, [devices]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingDevice ? `/api/mikrotiks/${editingDevice.id}` : '/api/mikrotiks';
      const method = editingDevice ? 'PUT' : 'POST';
      
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error("Failed to save device");
      toast.success(editingDevice ? 'Router updated!' : 'Router added!');
      setIsModalOpen(false);
      setEditingDevice(null);
      setShowSavedPassword(false);
      setSavedPassword('');
      setFormData({ name: '', host: '', user: '', password: '', port: '8728', lat: '', lng: '', level: '', driver: 'mikrotik', snmp_community: 'public', snmp_port: '161' });
      fetchDevices();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This router and its telemetry data will be removed.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      authFetch(`/api/mikrotiks/${id}`, { method: 'DELETE' })
        .then(() => {
          toast.success('Router deleted');
          fetchDevices();
        }).catch(err => toast.error('Failed to delete'));
    }
  };

  const openDetail = (id: string | number) => {
    setSearchParams({ detail: encryptId(id) });
  };

  if (detailId) {
    const activeDevice = devices.find(d => String(d.id) === detailId);
    return (
      <div className="p-6 md:p-8 animate-in slide-in-from-right-4 duration-300">
         <button onClick={() => setSearchParams({})} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors">
           <ArrowLeft className="w-5 h-5" />
           <span>{t('common.back')}</span>
         </button>

         {activeDevice ? (
           <DeviceDetailPanel device={activeDevice} status={deviceStatuses[activeDevice.id]} />
         ) : (
           <div className="text-center py-20 text-zinc-500">
             <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
             <p>Device not found or still loading.</p>
           </div>
         )}
      </div>
    );
  }

  if (loading) {
     return (
       <div className="flex-1 flex items-center justify-center p-8">
         <Loader message="Fetching infrastructure status..." />
       </div>
     );
  }

  return (
    <div className="p-6 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            Infrastructure
            <button
              onClick={() => setShowIP(!showIP)}
              className={`p-2 rounded-lg transition-all ${showIP ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}
              title={showIP ? 'Hide IP Addresses' : 'Show IP Addresses'}
            >
              {showIP ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>
          </h2>
          <p className="text-zinc-400 mt-1">Manage core routers and access tier endpoints.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder={t('devices.searchInterface')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl pl-9 pr-4 py-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-52"
            />
          </div>
          <button 
            onClick={() => { 
              setEditingDevice(null); 
              setFormData({ name: '', host: '', user: '', password: '', port: '8728', lat: '', lng: '', level: '', driver: 'mikrotik', snmp_community: 'public', snmp_port: '161' });
              setMapCenter([-7.2908, 112.779]);
              setMapSearchQuery('');
              setMapSearchResults([]);
              setIsModalOpen(true); 
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/20"
          >
              <Plus className="w-4 h-4" /> {t('devices.addDevice')}
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-zinc-400 uppercase bg-zinc-950/50 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-semibold">{t('devices.deviceName')}</th>
                <th className="px-6 py-4 font-semibold">IP Address</th>
                <th className="px-6 py-4 font-semibold">{t('devices.status')}</th>
                <th className="px-6 py-4 font-semibold">{t('devices.snmpCheck')}</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {devices.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.host.toLowerCase().includes(search.toLowerCase())).map((device) => {
                const stat = deviceStatuses[device.id];
                const isRouterOnline = device.status === 'online';
                const isSnmpConnected = stat?.online === true;
                return (
                  <tr key={device.id} className="hover:bg-zinc-800/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isRouterOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{device.name}</p>
                          <p className="text-xs text-zinc-500 font-mono mt-0.5">Port {device.port}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-zinc-300 bg-zinc-800/50 px-2.5 py-1 rounded-md border border-zinc-700/50 ${!showIP ? 'blur-sm select-none' : ''}`}>
                          {device.host}
                        </span>
                        <button
                          onClick={() => setShowIP(!showIP)}
                          className="p-1 hover:bg-zinc-700/50 rounded transition-colors"
                          title={showIP ? 'Hide IP' : 'Show IP'}
                        >
                          {showIP ? <EyeOff className="w-3.5 h-3.5 text-zinc-500" /> : <Eye className="w-3.5 h-3.5 text-zinc-500" />}
                        </button>
                      </div>
                    </td>

                    {/* COLUMN: Router Status */}
                    <td className="px-6 py-4">
                      {isRouterOnline ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {t('dashboard.online')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {t('dashboard.offline')}
                        </span>
                      )}
                    </td>

                    {/* COLUMN: SNMP Metrics (separate from router status) */}
                    <td className="px-6 py-4">
                      {stat ? (
                        isSnmpConnected ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                              SNMP {t('dashboard.online')}
                            </span>
                            <div className="text-[11px] text-zinc-500 flex items-center gap-3 mt-0.5">
                              <span title="RouterOS Version">v{stat.version}</span>
                              <span title="CPU Load">CPU {stat.cpuLoad}%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              SNMP {t('dashboard.offline')}
                            </span>
                            {stat.error && <span className="text-[10px] text-amber-500/70 max-w-[220px] truncate" title={stat.error}>{stat.error}</span>}
                          </div>
                        )
                      ) : (
                        <div className="h-5 bg-zinc-800 rounded animate-pulse w-28" />
                      )}
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                       <button onClick={() => openDetail(device.id)} className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/40 rounded-lg transition-colors" title="Manage Router">
                         <Play className="w-4 h-4" />
                       </button>
                       <button onClick={() => {
                          setEditingDevice(device);
                          setFormData({
                            name: device.name,
                            host: device.host,
                            user: device.user,
                            password: '',
                            port: String(device.port),
                            lat: device.lat || '',
                            lng: device.lng || '',
                            level: device.level !== null ? String(device.level) : '',
                            driver: device.driver || 'mikrotik',
                            snmp_community: device.snmp_community || 'public',
                            snmp_port: String(device.snmp_port || '161')
                          });
                          const dLat = Number(device.lat);
                          const dLng = Number(device.lng);
                          if (!isNaN(dLat) && !isNaN(dLng) && dLat !== 0 && dLng !== 0) {
                            setMapCenter([dLat, dLng]);
                          } else {
                            setMapCenter([-7.2908, 112.779]);
                          }
                          setMapSearchQuery('');
                          setMapSearchResults([]);
                          setShowSavedPassword(false);
                          // Ambil password dari server
                          authFetch(`/api/mikrotiks/${device.id}/credentials`)
                            .then(r => r.json())
                            .then(data => setSavedPassword(data.password || ''))
                            .catch(() => setSavedPassword(''));
                          setIsModalOpen(true);
                       }} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                         <Edit2 className="w-4 h-4" />
                       </button>
                       <button onClick={() => handleDelete(device.id)} className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors">
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                );
              })}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Monitor className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-400">No routers configured.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {editingDevice ? t('devices.editDevice') : t('devices.addDevice')}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">Configure device connection and identity settings.</p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setShowSavedPassword(false);
                  setSavedPassword('');
                }}
                className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6">
              {/* Scrollable Form Body Wrapper to prevent overflow */}
              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Connection Settings */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                      <Key className="w-3.5 h-3.5" /> Connection Settings
                    </h4>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1.5 ml-1">{t('devices.hostIp')}</label>
                        <input required type="text" value={formData.host} onChange={e => setFormData({...formData, host: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="192.168.1.1" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1.5 ml-1">Port</label>
                        <input required type="text" value={formData.port} onChange={e => setFormData({...formData, port: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="8728" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1.5 ml-1">Admin User</label>
                      <input required type="text" value={formData.user} onChange={e => setFormData({...formData, user: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="admin" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1.5 ml-1">{t('devices.password')}</label>
                      <div className="space-y-2">
                        {/* Saved password (only when editing) */}
                        {editingDevice && savedPassword && (
                          <div className="relative">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] text-emerald-400 font-medium">Password tersimpan:</span>
                              <button
                                type="button"
                                onClick={() => setShowSavedPassword(!showSavedPassword)}
                                className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                              >
                                {showSavedPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {showSavedPassword ? 'Sembunyikan' : 'Tampilkan'}
                              </button>
                            </div>
                            <input
                              type={showSavedPassword ? "text" : "password"}
                              value={savedPassword}
                              readOnly
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-300 font-mono text-sm outline-none"
                            />
                          </div>
                        )}
                        {/* New password input */}
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            placeholder={editingDevice ? '(Kosongkan untuk menjaga password)' : ''}
                            required={!editingDevice}
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none pr-10 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {editingDevice && (
                          <p className="text-[10px] text-zinc-600 italic ml-1">
                            Isi password baru untuk mengganti yang tersimpan
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Driver Options Grouped */}
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-2 ml-1">Protocol / Adapter</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['mikrotik', 'snmp'].map((d) => (
                          <label key={d} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${formData.driver === d ? 'border-indigo-500/50 bg-indigo-500/10 text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>
                            <input type="radio" name="driver" value={d} checked={formData.driver === d} onChange={() => setFormData({...formData, driver: d})} className="accent-indigo-500" />
                            <span className="text-xs font-bold uppercase">{d}</span>
                          </label>
                        ))}
                      </div>
                      {formData.driver === 'snmp' && (
                        <div className="grid grid-cols-2 gap-3 mt-3 animate-in slide-in-from-top-2 duration-200">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1 ml-1">Community</label>
                            <input type="text" value={formData.snmp_community} onChange={e => setFormData({...formData, snmp_community: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 text-sm outline-none" placeholder="public" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1 ml-1">UDP Port</label>
                            <input type="number" value={formData.snmp_port} onChange={e => setFormData({...formData, snmp_port: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 text-sm outline-none" placeholder="161" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Identity & Location */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                      <Monitor className="w-3.5 h-3.5" /> Identity & Location
                    </h4>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1.5 ml-1">Identifier / Name</label>
                      <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium" placeholder="e.g. Core Switch Gedung F" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1.5 ml-1 flex items-center gap-1.5">
                        Complexity Level
                      </label>
                      <input 
                        type="number" 
                        value={formData.level} 
                        onChange={e => setFormData({...formData, level: e.target.value})} 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                        placeholder="1 (Root), 2, 3..." 
                      />
                      <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">Lower value appears higher in topology tree.</p>
                    </div>

                    {/* Geocoding Search Bar */}
                    <div className="relative">
                      <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1.5 ml-1">Cari Lokasi di Map</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input
                            type="text"
                            placeholder="Cari lokasi, misal: Kampus ITATS"
                            value={mapSearchQuery}
                            onChange={e => setMapSearchQuery(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleMapSearch();
                              }
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleMapSearch}
                          disabled={isSearchingMap}
                          className="px-4 bg-zinc-850 hover:bg-zinc-750 text-white rounded-xl text-xs font-bold transition-all border border-zinc-700 disabled:opacity-50"
                        >
                          {isSearchingMap ? 'Mencari...' : 'Cari'}
                        </button>
                      </div>

                      {/* Search Results Dropdown */}
                      {mapSearchResults.length > 0 && (
                        <div className="absolute z-[110] left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl divide-y divide-zinc-900">
                          {mapSearchResults.map((result, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => selectMapSearchResult(result)}
                              className="w-full text-left px-4 py-2 hover:bg-zinc-900 text-xs text-zinc-300 transition-colors truncate block"
                              title={result.display_name}
                            >
                              {result.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Leaflet Map Preview */}
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1.5 ml-1">
                        Preview Lokasi (Klik map untuk memindahkan pin)
                      </label>
                      <div className="h-[180px] w-full rounded-xl border border-zinc-800 overflow-hidden z-0 relative">
                        <MapContainer
                          center={mapCenter}
                          zoom={17}
                          maxZoom={19}
                          style={{ height: '100%', width: '100%', background: '#18181b' }}
                          zoomControl={true}
                          doubleClickZoom={false}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; OpenStreetMap'
                            maxNativeZoom={19}
                            maxZoom={19}
                          />
                          <MapEventsHandler onMapClick={handleMapClick} />
                          <MapCenterController lat={mapCenter[0]} lng={mapCenter[1]} />
                          {!isNaN(Number(formData.lat)) && !isNaN(Number(formData.lng)) && formData.lat !== '' && formData.lng !== '' ? (
                            <Marker
                              draggable={true}
                              eventHandlers={{
                                dragend(e) {
                                  const marker = e.target;
                                  if (marker != null) {
                                    const latlng = marker.getLatLng();
                                    const lat = Number(latlng.lat.toFixed(6));
                                    const lng = Number(latlng.lng.toFixed(6));
                                    setMapCenter([lat, lng]);
                                    setFormData(prev => ({ ...prev, lat: String(lat), lng: String(lng) }));
                                  }
                                }
                              }}
                              position={[Number(formData.lat), Number(formData.lng)]}
                            />
                          ) : null}
                        </MapContainer>
                      </div>
                    </div>

                    {/* Manual Coordinates Grid */}
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1.5 ml-1">Latitude</label>
                        <input
                          type="text"
                          value={formData.lat}
                          onChange={e => handleLatChange(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                          placeholder="-7.29..."
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1.5 ml-1">Longitude</label>
                        <input
                          type="text"
                          value={formData.lng}
                          onChange={e => handleLngChange(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                          placeholder="112.77..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Actions Footer */}
              <div className="flex gap-4 pt-6 border-t border-zinc-800 mt-6">
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
                   {editingDevice ? 'Update Device' : 'Register Device'}
                </button>
                <button type="button" onClick={() => { setIsModalOpen(false); setShowSavedPassword(false); setSavedPassword(''); }} className="flex-[0.5] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 py-3 rounded-2xl font-bold transition-all active:scale-95">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// Panel detail Interfaces & Queues (Diintegrasikan di satu file)
// ----------------------------------------------------
function DeviceDetailPanel({ device, status }: { device: any, status: any }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'interfaces'|'bandwidth'|'terminal'>('interfaces');
  const [interfaces, setInterfaces] = useState<any[]>([]);
  const [ifaceRates, setIfaceRates] = useState<Record<string, { txRate: number; rxRate: number }>>({});
  const ifacePrevRef = useRef<Record<string, any>>({});
  const lastFetchTimeRef = useRef<number>(Date.now());
  const [searchIface, setSearchIface] = useState('');
  const [queues, setQueues] = useState<any[]>([]);
  const [queueRates, setQueueRates] = useState<Record<string, { txRate: number; rxRate: number }>>({});
  const queuePrevRef = useRef<Record<string, any>>({});
  const lastQueueFetchTimeRef = useRef<number>(Date.now());
  const [terminalOutput, setTerminalOutput] = useState<any>(null);
  const [terminalCmd, setTerminalCmd] = useState('');
  const [isLoadingIface, setIsLoadingIface] = useState(true);
  const [isLoadingBandwidth, setIsLoadingBandwidth] = useState(true);
  // State untuk menampilkan pesan error SNMP yang informatif ke user
  const [snmpError, setSnmpError] = useState<{ error: string; hint?: string; raw?: string } | null>(null);

  const fetchInterfaces = useCallback(() => {
    setSnmpError(null); // Reset error setiap kali fetch baru dimulai
    authFetch(`/api/mikrotiks/${device.id}/interfaces`)
      .then(async r => {
        const data = await r.json();

        // ── Handle error dari SNMP adapter (HTTP 502/503) ──
        if (!r.ok) {
          console.warn('[fetchInterfaces] Server returned error:', data);
          setSnmpError({
            error: data.error || `HTTP ${r.status}: Gagal mengambil data interface.`,
            hint: data.hint || '',
            raw: data.raw || '',
          });
          setInterfaces([]);
          return;
        }

        // ── Handle SNMP warning: koneksi berhasil tapi data kosong ──
        if (data && data._snmpWarning === true) {
          console.warn('[fetchInterfaces] SNMP warning:', data._message);
          setSnmpError({
            error: data._message || 'SNMP terhubung tapi interface kosong.',
            hint: data._hint || '',
          });
          setInterfaces([]);
          return;
        }

        // ── Data normal (array) ──
        if (!Array.isArray(data)) {
          console.warn('[fetchInterfaces] Data bukan array:', data);
          setInterfaces([]);
          return;
        }

        const now = Date.now();
        const elapsed = Math.max(1, (now - lastFetchTimeRef.current) / 1000); // seconds
        lastFetchTimeRef.current = now;

        const newRates: Record<string, { txRate: number; rxRate: number }> = {};
        data.forEach(iface => {
          const prev = ifacePrevRef.current[iface.name];
          if (prev) {
            // Calculate bps from byte delta
            const deltaTxBits = Math.max(0, (Number(iface['tx-byte']) - Number(prev['tx-byte'])) * 8);
            const deltaRxBits = Math.max(0, (Number(iface['rx-byte']) - Number(prev['rx-byte'])) * 8);
            newRates[iface.name] = {
              txRate: deltaTxBits / elapsed,
              rxRate: deltaRxBits / elapsed,
            };
          } else {
            // First fetch — use device-reported rate if available
            newRates[iface.name] = {
              txRate: Number(iface['tx-rate'] || 0),
              rxRate: Number(iface['rx-rate'] || 0),
            };
          }
        });

        // Store current as previous for next diff
        const newPrev: Record<string, any> = {};
        data.forEach(iface => { newPrev[iface.name] = iface; });
        ifacePrevRef.current = newPrev;

        setIfaceRates(newRates);
        setInterfaces(data);
      })
      .catch(err => {
        console.error('[fetchInterfaces] Network error:', err);
        setSnmpError({
          error: `Gagal menghubungi server: ${err.message}`,
          hint: 'Pastikan server backend sedang berjalan.',
        });
      })
      .finally(() => setIsLoadingIface(false));
  }, [device.id]);

  const fetchQueues = useCallback(() => {
    authFetch(`/api/mikrotiks/${device.id}/queues`)
      .then(r => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        const now = Date.now();
        const elapsed = Math.max(1, (now - lastQueueFetchTimeRef.current) / 1000);
        lastQueueFetchTimeRef.current = now;

        const newRates: Record<string, { txRate: number; rxRate: number }> = {};
        data.forEach(q => {
          const prev = queuePrevRef.current[q['.id']];
          if (prev) {
            const rxByteCur = Number(q['rx-byte']) || 0;
            const rxBytePrev = Number(prev['rx-byte']) || 0;
            const txByteCur = Number(q['tx-byte']) || 0;
            const txBytePrev = Number(prev['tx-byte']) || 0;
            
            const deltaRxBits = Math.max(0, rxByteCur - rxBytePrev) * 8;
            const deltaTxBits = Math.max(0, txByteCur - txBytePrev) * 8;
            
            const calcTxRate = deltaTxBits / elapsed;
            const calcRxRate = deltaRxBits / elapsed;
            newRates[q['.id']] = {
              txRate: calcTxRate > 0 || prev['tx-byte'] ? calcTxRate : Number(q['tx-rate'] || 0),
              rxRate: calcRxRate > 0 || prev['rx-byte'] ? calcRxRate : Number(q['rx-rate'] || 0),
            };
          } else {
            newRates[q['.id']] = {
              txRate: Number(q['tx-rate'] || 0),
              rxRate: Number(q['rx-rate'] || 0),
            };
          }
        });

        const newPrev: Record<string, any> = {};
        data.forEach(q => { newPrev[q['.id']] = q; });
        queuePrevRef.current = newPrev;

        setQueueRates(newRates);
        setQueues(data);
      })
      .catch(console.error)
      .finally(() => setIsLoadingBandwidth(false));
  }, [device.id]);

  useEffect(() => {
    // Reset rates when switching device or tab
    ifacePrevRef.current = {};
    lastFetchTimeRef.current = Date.now();

    if (activeTab === 'interfaces') {
      fetchInterfaces();
      const inv = setInterval(fetchInterfaces, 2000); // Poll every 2s for precise live rate tracking
      return () => clearInterval(inv);
    } else if (activeTab === 'bandwidth') {
      queuePrevRef.current = {};
      lastQueueFetchTimeRef.current = Date.now();
      fetchQueues();
      const inv = setInterval(fetchQueues, 2000); // Also poll every 2s for precise rate tracking
      return () => clearInterval(inv);
    }
  }, [activeTab, device.id, fetchInterfaces, fetchQueues]);

  // Keep fetchData as alias for toggle operations
  const fetchData = activeTab === 'interfaces' ? fetchInterfaces : fetchQueues;

  const toggleIface = async (name: string, disabled: string) => {
    await authFetch(`/api/mikrotiks/${device.id}/interfaces/${encodeURIComponent(name)}/toggle`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ disabled })
    });
    fetchData();
  };

  const toggleQueue = async (id: string, disabled: string) => {
     Swal.fire({ title: 'Processing...', allowOutsideClick: false, showConfirmButton: false, background: '#18181b', color: '#fff' });
     try {
       const res = await authFetch(`/api/mikrotiks/${device.id}/queues/${encodeURIComponent(id)}/toggle`, {
          method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ disabled })
       });
       if (res.ok) {
         Swal.fire({ icon: 'success', title: 'Success', timer: 1500, showConfirmButton: false, background: '#18181b', color: '#fff' });
         fetchData();
       } else throw new Error();
     } catch (e) {
       Swal.fire({ icon: 'error', title: 'Action Failed', background: '#18181b', color: '#fff' });
     }
  };

  const editQueueLimit = async (q: any) => {
    const { value: limit } = await Swal.fire({
      title: 'Edit Limit Bandwidth',
      input: 'text',
      inputLabel: `Target: ${q.target}`,
      inputValue: q['max-limit'],
      showCancelButton: true,
      inputPlaceholder: 'e.g., 10M/10M',
      background: '#18181b',
      color: '#fff',
    });
    
    if (limit && limit !== q['max-limit']) {
      Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, showConfirmButton: false, background: '#18181b', color: '#fff' });
      try {
        const res = await authFetch(`/api/mikrotiks/${device.id}/queues/${encodeURIComponent(q['.id'])}`, {
           method: 'PUT',
           headers: {'Content-Type': 'application/json'},
           body: JSON.stringify({ maxLimit: limit })
        });
        if (res.ok) {
           Swal.fire({ icon: 'success', title: 'Tersimpan', text: `Limit diubah ke ${limit}`, timer: 1500, showConfirmButton: false, background: '#18181b', color: '#fff' });
           fetchData();
        } else {
           throw new Error('Gagal');
        }
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', background: '#18181b', color: '#fff' });
      }
    }
  };

  const execCommand = async (cmd: string) => {
    setTerminalOutput('Executing...');
    try {
      const res = await authFetch(`/api/mikrotiks/${device.id}/exec`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ command: cmd })
      });
      const data = await res.json();
      setTerminalOutput(data.result || data.error || 'Done.');
    } catch (err: any) {
      setTerminalOutput(err.message);
    }
  };

  // ── FIX #8: Export interface data ke CSV ──
  const exportInterfaceCSV = () => {
    if (interfaces.length === 0) return;
    const headers = ['Name', 'Type', 'Status', 'MTU', 'Tx Rate (bps)', 'Rx Rate (bps)', 'Tx Bytes', 'Rx Bytes', 'Tx Packets', 'Rx Packets', 'Parent'];
    const rows = interfaces.map((i: any) => [
      i.name,
      i.type,
      (i.running === 'true' || i.running === true) ? 'Running' : 'Stopped',
      i['actual-mtu'] || 1500,
      ifaceRates[i.name]?.txRate ?? 0,
      ifaceRates[i.name]?.rxRate ?? 0,
      i['tx-byte'] || 0,
      i['rx-byte'] || 0,
      i['tx-packet'] || 0,
      i['rx-packet'] || 0,
      i.parent || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interfaces_${device.name}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[600px]">
       <div className="p-6 border-b border-zinc-800 bg-zinc-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="flex items-center gap-4">
           <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
             <Server className="w-8 h-8" />
           </div>
           <div>
             <h2 className="text-2xl font-bold text-white tracking-tight">{device.name}</h2>
             <div className="flex items-center gap-3 mt-1 text-sm">
               <span className="font-mono text-zinc-400">{device.host}:{device.port}</span>
               {/* Badge driver aktif */}
               <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${
                 (device.driver || 'mikrotik') === 'mikrotik'
                   ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                   : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
               }`}>
                 {device.driver || 'mikrotik'}
               </span>
               {status?.online ? (
                 <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium text-xs">{status.uptime}</span>
               ) : (
                 <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-medium text-xs">{t('dashboard.offline')}</span>
               )}
             </div>
           </div>
         </div>
         <div className="flex bg-zinc-800/50 p-1 rounded-xl flex-wrap">
           <button onClick={() => setActiveTab('interfaces')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab==='interfaces'?'bg-zinc-700 text-white shadow':'text-zinc-400 hover:text-white'}`}>Interfaces</button>
           <button onClick={() => setActiveTab('bandwidth')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab==='bandwidth'?'bg-zinc-700 text-white shadow':'text-zinc-400 hover:text-white'}`}>Bandwidth</button>
           <button onClick={() => setActiveTab('terminal')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab==='terminal'?'bg-zinc-700 text-white shadow':'text-zinc-400 hover:text-white'}`}>Terminal</button>
         </div>
       </div>

       <div className="flex-1 p-6 overflow-auto bg-zinc-900/50">
           {activeTab === 'interfaces' && (
             <div className="flex flex-col gap-0 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl">
               {/* Dark Action Bar */}
               <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-zinc-900 border-b border-zinc-800 text-xs">
                 <div className="flex-1" />
                 <div className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5">
                   <Search className="w-3 h-3 text-zinc-500" />
                   <input type="text" placeholder="Find interface..." value={searchIface} onChange={e => setSearchIface(e.target.value)} className="outline-none text-xs w-28 bg-transparent text-zinc-300 placeholder-zinc-600" />
                 </div>
                 <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                   <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
                   Live
                 </div>
                  {interfaces.length > 0 && (
                    <button onClick={exportInterfaceCSV} title="Export ke CSV" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-[10px] font-semibold">
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  )}
               </div>

               {/* Dark Table */}
               <div className="overflow-auto">
                 <table className="w-full text-xs text-left whitespace-nowrap">
                   <thead className="text-[10px] text-zinc-500 uppercase tracking-wider bg-zinc-900/80 sticky top-0 z-10 border-b border-zinc-800">
                     <tr>
                       <th className="px-3 py-2.5 font-semibold text-center w-12">St.</th>
                       <th className="px-3 py-2.5 font-semibold min-w-[180px]">Name</th>
                       <th className="px-3 py-2.5 font-semibold">Type</th>
                       <th className="px-3 py-2.5 font-semibold text-center">MTU</th>
                       <th className="px-3 py-2.5 font-semibold text-center">L2 MTU</th>
                       <th className="px-3 py-2.5 font-semibold text-right">↑ Tx</th>
                       <th className="px-3 py-2.5 font-semibold text-right">↓ Rx</th>
                       <th className="px-3 py-2.5 font-semibold text-right">Tx Pkt</th>
                       <th className="px-3 py-2.5 font-semibold text-right">Rx Pkt</th>
                       <th className="px-3 py-2.5 font-semibold text-right text-zinc-600">FP Tx</th>
                       <th className="px-3 py-2.5 font-semibold text-right text-zinc-600">FP Rx</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-800/60">
                     {(() => {
                       const map: Record<string, any[]> = {};
                       interfaces.forEach(i => { map[i.name] = []; });
                       const root: any[] = [];
                       interfaces.forEach(i => {
                         if (i.parent && map[i.parent]) map[i.parent].push(i);
                         else root.push(i);
                       });
                       const flatten = (nodes: any[], depth: number): any[] => {
                         let res: any[] = [];
                         nodes.forEach(n => {
                           res.push({ ...n, _depth: depth });
                           if (map[n.name]?.length > 0) res = res.concat(flatten(map[n.name], depth + 1));
                         });
                         return res;
                       };
                       let flatList = flatten(root, 0);
                       if (searchIface) flatList = flatList.filter(f => f.name.toLowerCase().includes(searchIface.toLowerCase()));

                       return flatList.map((iface, i) => {
                         const isRunning = iface.running === 'true' || iface.running === true;
                         const isDisabled = iface.disabled === 'true' || iface.disabled === true;
                         const isSlave = iface.type === 'vlan';

                         // Status indicator dot
                         const statusColor = isDisabled ? 'bg-zinc-600' : isRunning ? 'bg-emerald-400' : 'bg-rose-400';
                         let statusLabel = isDisabled ? 'X' : isRunning && isSlave ? 'RS' : isRunning ? 'R' : 'S';

                         const typeColor =
                           iface.type === 'bridge' ? 'text-violet-400 bg-violet-500/10 border-violet-500/20' :
                           iface.type === 'vlan'   ? 'text-sky-400 bg-sky-500/10 border-sky-500/20' :
                                                     'text-zinc-300 bg-zinc-800 border-zinc-700';

                         // Use computed rates (bps delta) for live display
                         const rate = ifaceRates[iface.name];
                         const txBps = rate?.txRate ?? 0;
                         const rxBps = rate?.rxRate ?? 0;
                         const hasTx = txBps > 0;
                         const hasRx = rxBps > 0;

                         return (
                           <tr key={i} className={`group transition-colors ${isDisabled ? 'opacity-40' : 'hover:bg-zinc-800/40'}`}>
                             {/* Status */}
                             <td className="px-3 py-2 text-center">
                               <div className="flex items-center justify-center gap-1">
                                 <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor} ${isRunning && !isDisabled ? 'animate-pulse' : ''}`} />
                                 <span className={`text-[9px] font-bold ${isDisabled ? 'text-zinc-600' : isRunning ? 'text-emerald-500' : 'text-zinc-500'}`}>{statusLabel}</span>
                               </div>
                             </td>
                             {/* Name with indentation */}
                             <td className="px-3 py-2" style={{ paddingLeft: `${iface._depth * 20 + 12}px` }}>
                               <div className="flex items-center gap-2 min-w-0">
                                 {iface._depth > 0 && <span className="text-zinc-700 select-none text-xs flex-shrink-0">└</span>}
                                 <span className={`truncate ${iface._depth === 0 ? 'font-semibold text-zinc-100' : 'text-zinc-300'} ${isDisabled ? 'line-through' : ''}`}>
                                   {iface.name}
                                 </span>
                               </div>
                             </td>
                             {/* Type badge */}
                             <td className="px-3 py-2">
                               <span className={`inline-flex px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${typeColor}`}>
                                 {iface.type}
                               </span>
                             </td>
                             <td className="px-3 py-2 text-center text-zinc-400">{iface['actual-mtu'] || 1500}</td>
                             <td className="px-3 py-2 text-center text-zinc-500">{iface['l2mtu'] || 1598}</td>
                             {/* Tx rate */}
                             <td className="px-3 py-2 text-right font-mono">
                               <span className={hasTx ? 'text-rose-400' : 'text-zinc-700'}>
                                 {formatBps(txBps)}
                               </span>
                             </td>
                             {/* Rx rate */}
                             <td className="px-3 py-2 text-right font-mono">
                               <span className={hasRx ? 'text-emerald-400' : 'text-zinc-700'}>
                                 {formatBps(rxBps)}
                               </span>
                             </td>
                             <td className="px-3 py-2 text-right text-zinc-400">{(Number(iface['tx-packet']) || 0).toLocaleString()}</td>
                             <td className="px-3 py-2 text-right text-zinc-400">{(Number(iface['rx-packet']) || 0).toLocaleString()}</td>
                             <td className="px-3 py-2 text-right font-mono text-zinc-600">{formatBps((Number(iface['fp-tx-byte']) || 0) * 8)}</td>
                             <td className="px-3 py-2 text-right font-mono text-zinc-600">{formatBps((Number(iface['fp-rx-byte']) || 0) * 8)}</td>
                           </tr>
                         );
                       });
                     })()}
                   </tbody>
                 </table>
                 {/* ── SNMP Error Banner — tampil jika ada error koneksi SNMP ── */}
                 {snmpError && !isLoadingIface && (
                   <div className="m-3 p-4 bg-amber-500/5 border border-amber-500/30 rounded-xl flex flex-col gap-2">
                     <div className="flex items-start gap-3">
                       <span className="text-amber-400 text-lg flex-shrink-0">⚠️</span>
                       <div className="flex-1 min-w-0">
                         <p className="text-sm font-semibold text-amber-300">{snmpError.error}</p>
                         {snmpError.hint && (
                           <p className="text-xs text-amber-400/70 mt-1.5 leading-relaxed">{snmpError.hint}</p>
                         )}
                         {snmpError.raw && (
                           <details className="mt-2">
                             <summary className="text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-400">Detail teknis</summary>
                             <code className="text-[10px] text-zinc-500 font-mono block mt-1 bg-zinc-950 p-2 rounded">{snmpError.raw}</code>
                           </details>
                         )}
                       </div>
                     </div>
                     <div className="flex items-center gap-2 ml-8">
                       <span className="text-[10px] text-zinc-600">Driver aktif:</span>
                       <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">{device.driver || 'mikrotik'}</span>
                       <span className="text-[10px] text-zinc-600">•</span>
                       <span className="text-[10px] text-zinc-600">Ganti driver di halaman</span>
                       <a href="/admin/smart-central" className="text-[10px] text-indigo-400 hover:underline">Smart Central</a>
                     </div>
                   </div>
                 )}
                 {isLoadingIface ? (
                   <div className="py-20 flex justify-center">
                     <Loader message="Fetching interface data..." />
                   </div>
                 ) : interfaces.length === 0 && !snmpError ? (
                   <div className="flex flex-col items-center gap-3 py-16 text-zinc-600">
                     <Radio className="w-10 h-10 opacity-50" />
                     <p className="text-sm">No interfaces loaded. Ensure device is online or simulation mode is active.</p>
                   </div>
                 ) : null}
               </div>
             </div>
          )}

          {activeTab === 'bandwidth' && (
             <div className="space-y-4">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-bold text-zinc-200">Bandwidth Management (Simple Queues)</h3>
               </div>
               <div className="grid gap-4 bg-zinc-900 rounded-xl overflow-hidden shadow-inner border border-zinc-800">
                  {queues.map((q, i) => (
                    <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <div className="flex-1 min-w-0 mb-3 md:mb-0 pr-4">
                         <div className="flex items-center gap-3">
                           <h4 className="font-bold text-indigo-300">{q.name}</h4>
                           <span className="font-mono text-xs text-zinc-400 px-2 py-0.5 bg-zinc-800 rounded">{q.target}</span>
                           <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${q.disabled === 'true' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                             {q.disabled === 'true' ? 'Disabled' : 'Active'}
                           </span>
                         </div>
                         <p className="text-xs text-zinc-500 mt-1">Limit: {q['max-limit']} • RX: {formatBps(queueRates[q['.id']]?.rxRate)} / TX: {formatBps(queueRates[q['.id']]?.txRate)}</p>
                       </div>
                       <div className="flex gap-2">
                         <button 
                           onClick={() => editQueueLimit(q)}
                           className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 transition"
                         >
                           Edit Limit
                         </button>
                         <button 
                           onClick={() => toggleQueue(q['.id'], q.disabled==='true'?'false':'true')}
                           className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                         >
                           {q.disabled === 'true' ? 'Turn On' : 'Turn Off'}
                         </button>
                       </div>
                    </div>
                  ))}
                  {isLoadingBandwidth ? (
                    <div className="py-20 flex justify-center border-b border-zinc-800/50">
                      <Loader message="Fetching queues data..." />
                    </div>
                  ) : queues.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">No queues configured on this device.</div>
                  ) : null}
               </div>
             </div>
          )}
           {activeTab === 'terminal' && (
              <div className="flex flex-col h-full space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-zinc-400 py-1.5 font-bold mr-2">Quick Commands:</span>
                  <button onClick={() => execCommand('/ping 8.8.8.8 count=4')} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded hover:bg-indigo-500/20 text-xs font-mono">Ping Google</button>
                  <button onClick={() => execCommand('/ip/route/print')} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded hover:bg-indigo-500/20 text-xs font-mono">Print Routes</button>
                  <button onClick={() => execCommand('/interface/print')} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded hover:bg-indigo-500/20 text-xs font-mono">Interfaces Print</button>
                  <button onClick={() => execCommand('/system/resource/print')} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded hover:bg-indigo-500/20 text-xs font-mono">System Resource</button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">[admin@{device.name}] &gt;</span>
                    <input 
                      type="text" 
                      value={terminalCmd}
                      onChange={e => setTerminalCmd(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && execCommand(terminalCmd)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-[150px] pr-4 py-3 text-emerald-400 font-mono text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="Type RouterOS command..."
                    />
                  </div>
                  <button onClick={() => execCommand(terminalCmd)} className="px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors">Run</button>
                </div>
                <div className="flex-1 bg-black border border-zinc-800 rounded-xl p-4 overflow-auto font-mono text-sm text-zinc-300 min-h-[300px] shadow-inner">
                  {terminalOutput ? (
                    <pre className="whitespace-pre-wrap">{typeof terminalOutput === 'string' ? terminalOutput : JSON.stringify(terminalOutput, null, 2)}</pre>
                  ) : (
                    <span className="text-zinc-600 italic">Console output will appear here...</span>
                  )}
                </div>
              </div>
           )}
        </div>
    </div>
  );
}

function formatBps(val: string|number|undefined) {
  if (!val) return '0 bps';
  let b = Number(val);
  const k = 1000;
  const sizes = ['bps', 'kbps', 'Mbps', 'Gbps'];
  if (b === 0) return '0 bps';
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
