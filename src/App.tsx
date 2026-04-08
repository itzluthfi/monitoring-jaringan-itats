import React, { useEffect, useState } from 'react';
import { 
  Wifi, 
  Users, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  RefreshCw,
  ChevronRight,
  Activity,
  Calendar,
  MapPin,
  Signal,
  SignalLow,
  SignalHigh,
  Power,
  PowerOff,
  Network,
  BookOpen,
  Server,
  HardDrive,
  Globe,
  Cpu,
  Layers,
  ChevronDown,
  Info,
  Settings,
  Plus,
  Trash2,
  RotateCw,
  MemoryStick,
  Terminal,
  Star,
  Edit,
  X
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icon issue
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WifiStat {
  id: number;
  timestamp: string;
  client_count: number;
  ap_name: string;
}

interface Prediction {
  prediction: string;
  rawanHours: Array<{ hour: string; expectedDensity: string }>;
}

interface Room {
  id: string;
  name: string;
  cap: number;
  current: number;
  status: 'online' | 'offline';
  latency: number;
  noWifi?: boolean;
}

interface Floor {
  level: number;
  rooms: Room[];
}

interface Building {
  id: string;
  name: string;
  lat: number;
  lng: number;
  floors: Floor[];
}

interface MikroTikDevice {
  id: number;
  name: string;
  host: string;
  user: string;
  port: number;
  status: string;
  last_seen: string | null;
  is_primary: number;
}

interface DeviceStatus {
  online: boolean;
  identity?: string;
  uptime?: string;
  version?: string;
  cpuLoad?: string;
  freeMemory?: string;
  error?: string;
}

interface TopologyNode {
  id: string;
  name: string;
  type: 'cloud' | 'router' | 'switch' | 'ap';
  status: 'online' | 'offline';
  children?: TopologyNode[];
}

function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function App() {
  const [currentCount, setCurrentCount] = useState<number | null>(null);
  const [history, setHistory] = useState<WifiStat[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [campusData, setCampusData] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'dashboard' | 'map' | 'topology' | 'docs' | 'devices'>('dashboard');
  const [topology, setTopology] = useState<TopologyNode | null>(null);
  const [devices, setDevices] = useState<MikroTikDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<MikroTikDevice | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [deviceInterfaces, setDeviceInterfaces] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState<{ total: number, online: number, offline: number } | null>(null);
  const [notifications, setNotifications] = useState<{ id: string, message: string, type: 'info' | 'error', time: Date }[]>([]);
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [isEditingDevice, setIsEditingDevice] = useState(false);
  const [editingDevice, setEditingDevice] = useState<MikroTikDevice | null>(null);
  const [newDevice, setNewDevice] = useState({ name: '', host: '', user: '', password: '', port: 8728 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [command, setCommand] = useState('');
  const [commandResult, setCommandResult] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [statusRes, historyRes, predictRes, campusRes, topologyRes, devicesRes, statsRes] = await Promise.all([
        fetch('/api/current-status'),
        fetch('/api/history'),
        fetch('/api/prediction'),
        fetch('/api/campus-map'),
        fetch('/api/topology'),
        fetch('/api/mikrotiks'),
        fetch('/api/mikrotiks/stats')
      ]);

      const status = await statusRes.json();
      const historyData = await historyRes.json();
      const predictionData = await predictRes.json();
      const campus = await campusRes.json();
      const topologyData = await topologyRes.json();
      const devicesData = await devicesRes.json();
      const statsData = await statsRes.json();

      setCurrentCount(status.count);
      setHistory(historyData);
      setPrediction(predictionData);
      setCampusData(campus);
      setTopology(topologyData);
      setDevices(devicesData);
      setGlobalStats(statsData);

      // Simple notification logic: if a device went offline
      devicesData.forEach((d: MikroTikDevice) => {
        const oldDevice = devices.find(od => od.id === d.id);
        if (oldDevice && oldDevice.status === 'online' && d.status === 'offline') {
          setNotifications(prev => [{
            id: Math.random().toString(36).substr(2, 9),
            message: `Device ${d.name} is now OFFLINE`,
            type: 'error',
            time: new Date()
          }, ...prev].slice(0, 5));
        }
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDeviceStatus = async (device: MikroTikDevice) => {
    setSelectedDevice(device);
    setDeviceStatus(null);
    setDeviceInterfaces([]);
    try {
      const [statusRes, interfacesRes] = await Promise.all([
        fetch(`/api/mikrotiks/${device.id}/status`),
        fetch(`/api/mikrotiks/${device.id}/interfaces`)
      ]);
      const statusData = await statusRes.json();
      const interfacesData = await interfacesRes.json();
      setDeviceStatus(statusData);
      setDeviceInterfaces(interfacesData);
    } catch (err) {
      setDeviceStatus({ online: false, error: 'Connection failed' });
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/mikrotiks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDevice)
      });
      if (res.ok) {
        setIsAddingDevice(false);
        setNewDevice({ name: '', host: '', user: '', password: '', port: 8728 });
        fetchData();
      }
    } catch (err) {
      console.error('Failed to add device:', err);
    }
  };

  const handleEditDevice = (device: MikroTikDevice) => {
    setEditingDevice(device);
    setNewDevice({
      name: device.name,
      host: device.host,
      user: device.user,
      password: '', // Don't pre-fill password for security
      port: device.port
    });
    setIsEditingDevice(true);
  };

  const handleUpdateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    try {
      const res = await fetch(`/api/mikrotiks/${editingDevice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDevice)
      });
      if (res.ok) {
        setIsEditingDevice(false);
        setEditingDevice(null);
        setNewDevice({ name: '', host: '', user: '', password: '', port: 8728 });
        fetchData();
      }
    } catch (err) {
      console.error('Failed to update device:', err);
    }
  };

  const handleDeleteDevice = async (id: number) => {
    if (!confirm('Are you sure you want to delete this device?')) return;
    try {
      await fetch(`/api/mikrotiks/${id}`, { method: 'DELETE' });
      if (selectedDevice?.id === id) setSelectedDevice(null);
      fetchData();
    } catch (err) {
      console.error('Failed to delete device:', err);
    }
  };

  const handleSetPrimary = async (id: number) => {
    try {
      await fetch(`/api/mikrotiks/${id}/primary`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Failed to set primary device:', err);
    }
  };

  const handleReboot = async (id: number) => {
    if (!confirm('Are you sure you want to reboot this device?')) return;
    try {
      await fetch(`/api/mikrotiks/${id}/reboot`, { method: 'POST' });
      alert('Reboot command sent');
    } catch (err) {
      console.error('Failed to reboot:', err);
    }
  };

  const handleToggleInterface = async (deviceId: number, ifaceName: string, isDisabled: string) => {
    try {
      const res = await fetch(`/api/mikrotiks/${deviceId}/interfaces/${ifaceName}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: isDisabled })
      });
      if (res.ok) {
        // Refresh interfaces
        const interfacesRes = await fetch(`/api/mikrotiks/${deviceId}/interfaces`);
        const interfacesData = await interfacesRes.json();
        setDeviceInterfaces(interfacesData);
      }
    } catch (err) {
      console.error('Failed to toggle interface:', err);
    }
  };

  const handleRename = async (id: number) => {
    if (!newName) return;
    try {
      const res = await fetch(`/api/mikrotiks/${id}/set-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        setIsRenaming(false);
        if (selectedDevice) fetchDeviceStatus(selectedDevice);
      }
    } catch (err) {
      console.error('Failed to rename:', err);
    }
  };

  const handleExec = async (id: number) => {
    if (!command) return;
    setIsExecuting(true);
    setCommandResult(null);
    try {
      const res = await fetch(`/api/mikrotiks/${id}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      const data = await res.json();
      setCommandResult(JSON.stringify(data.result, null, 2));
    } catch (err) {
      setCommandResult('Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const chartData = history.map(item => ({
    time: format(new Date(item.timestamp), 'HH:mm'),
    count: item.client_count
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-emerald-500/60 font-mono text-sm tracking-widest uppercase">Initializing System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
              <Wifi className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">ITATS WiFi Monitor</h1>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">Campus Network Node v1.0</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-full p-1">
              <button 
                onClick={() => setView('dashboard')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                  view === 'dashboard' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setView('map')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                  view === 'map' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Campus Map
              </button>
              <button 
                onClick={() => setView('topology')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                  view === 'topology' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Topology
              </button>
              <button 
                onClick={() => setView('docs')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                  view === 'docs' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Knowledge
              </button>
              <button 
                onClick={() => setView('devices')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                  view === 'devices' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Devices
              </button>
            </nav>

            <button 
              onClick={fetchData}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={cn("w-5 h-5 text-zinc-400", refreshing && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {view === 'dashboard' ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* Top Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  icon={<Users className="w-5 h-5" />}
                  label="Total Campus Clients"
                  value={currentCount ?? 0}
                  trend="+12% from last hour"
                  color="emerald"
                />
                <StatCard 
                  icon={<Activity className="w-5 h-5" />}
                  label="Network Load"
                  value={currentCount ? `${Math.min(100, Math.floor((currentCount / 150) * 100))}%` : '0%'}
                  trend="Stable"
                  color="blue"
                />
                <StatCard 
                  icon={<Clock className="w-5 h-5" />}
                  label="Next Peak Hour"
                  value={prediction?.rawanHours?.[0]?.hour || 'N/A'}
                  trend="Estimated by AI"
                  color="amber"
                />
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart Section */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-8 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp className="w-32 h-32" />
                    </div>
                    
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="text-xl font-semibold">Density Trends</h2>
                        <p className="text-sm text-zinc-500">Last 24 hours of connectivity snapshots</p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Live Feed</span>
                      </div>
                    </div>

                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                          <XAxis 
                            dataKey="time" 
                            stroke="#71717a" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis 
                            stroke="#71717a" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#18181b', 
                              borderColor: '#27272a',
                              borderRadius: '12px',
                              fontSize: '12px'
                            }}
                            itemStyle={{ color: '#10b981' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorCount)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Recent Snapshots */}
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-zinc-400" />
                      Recent Snapshots
                    </h3>
                    <div className="space-y-4">
                      {history.slice(0, 5).map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-mono text-zinc-400">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{format(new Date(item.timestamp), 'MMM d, HH:mm')}</p>
                              <p className="text-xs text-zinc-500">{item.ap_name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-500">{item.client_count} Clients</p>
                            <p className="text-[10px] text-zinc-600 uppercase tracking-tighter">Connected</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Prediction Sidebar */}
                <div className="space-y-8">
                  <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                      <TrendingUp className="w-32 h-32" />
                    </div>
                    
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <Activity className="w-6 h-6 text-white" />
                      </div>
                      <h2 className="text-xl font-bold">AI Prediction</h2>
                    </div>

                    <p className="text-sm text-zinc-400 leading-relaxed mb-8 italic">
                      "{prediction?.prediction || 'Analyzing network patterns to predict future congestion...'}"
                    </p>

                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Rawan Hours (Next 24h)</h4>
                      {prediction?.rawanHours?.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5">
                          <div className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-medium">{item.hour}</span>
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                            item.expectedDensity === 'High' ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                            item.expectedDensity === 'Medium' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                            "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          )}>
                            {item.expectedDensity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : view === 'map' ? (
            <motion.div 
              key="map"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Campus Map Visualization */}
                <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-6 min-h-[600px] relative overflow-hidden">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">ITATS Live Network Map</h2>
                      <p className="text-sm text-zinc-500">Real-time node status and density visualization</p>
                    </div>
                    <div className="flex gap-2">
                       <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Online</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Offline</span>
                      </div>
                    </div>
                  </div>

                  {/* Real Map Representation */}
                  <div className="relative w-full h-[550px] rounded-2xl border border-white/10 overflow-hidden z-0 shadow-2xl">
                    <MapContainer 
                      center={[-7.2908, 112.7790]} 
                      zoom={18} 
                      maxZoom={22}
                      style={{ height: '100%', width: '100%', background: '#f0f0f0' }}
                      zoomControl={false}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      
                      {selectedBuilding ? (
                        <MapUpdater center={[selectedBuilding.lat, selectedBuilding.lng]} zoom={20} />
                      ) : (
                        <MapUpdater center={[-7.2908, 112.7790]} zoom={18} />
                      )}

                      {campusData.map(building => {
                        const totalRooms = building.floors.reduce((acc, f) => acc + f.rooms.length, 0);
                        const offlineRooms = building.floors.reduce((acc, f) => acc + f.rooms.filter(r => r.status === 'offline').length, 0);
                        const avgLoad = building.floors.reduce((acc, f) => acc + f.rooms.reduce((racc, r) => racc + (r.current / r.cap), 0), 0) / totalRooms;
                        
                        const markerColor = offlineRooms > 0 ? '#ef4444' : (avgLoad > 0.7 ? '#f59e0b' : '#10b981');

                        const customIcon = L.divIcon({
                          className: 'custom-div-icon',
                          html: `
                            <div class="relative flex items-center justify-center">
                              <div class="absolute w-10 h-10 rounded-full animate-ping opacity-20" style="background-color: ${markerColor}"></div>
                              <div class="relative w-8 h-8 rounded-xl flex items-center justify-center border-2 shadow-xl transition-all hover:scale-110" 
                                   style="background-color: ${markerColor}20; border-color: ${markerColor}; color: ${markerColor}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/></svg>
                              </div>
                            </div>
                          `,
                          iconSize: [32, 32],
                          iconAnchor: [16, 16]
                        });

                        return (
                          <Marker 
                            key={building.id} 
                            position={[building.lat, building.lng]} 
                            icon={customIcon}
                            eventHandlers={{
                              click: () => setSelectedBuilding(building)
                            }}
                          >
                            <Popup className="custom-popup">
                              <div className="p-2 bg-zinc-900 text-white rounded-lg border border-white/10">
                                <h4 className="font-bold text-sm mb-1">{building.name}</h4>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                  <Users className="w-3 h-3" />
                                  <span>{Math.floor(avgLoad * 100)}% Avg Load</span>
                                </div>
                                {offlineRooms > 0 && (
                                  <div className="mt-1 flex items-center gap-1 text-[10px] text-red-500 font-bold">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{offlineRooms} APs Offline</span>
                                  </div>
                                )}
                              </div>
                            </Popup>
                          </Marker>
                        );
                      })}
                    </MapContainer>
                  </div>
                </div>

                {/* Building Detail Panel */}
                <div className="w-full lg:w-[450px] space-y-6">
                  <AnimatePresence mode="wait">
                    {selectedBuilding ? (
                      <motion.div 
                        key={selectedBuilding.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="bg-white/5 border border-white/10 rounded-3xl p-8 h-full flex flex-col"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-2xl font-bold">{selectedBuilding.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Active Node: {selectedBuilding.id.toUpperCase()}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setSelectedBuilding(null)}
                            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Building Quick Stats */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Total Capacity</p>
                            <p className="text-xl font-bold">{selectedBuilding.floors.reduce((acc, f) => acc + f.rooms.reduce((ra, r) => ra + r.cap, 0), 0)}</p>
                          </div>
                          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Active Users</p>
                            <p className="text-xl font-bold text-emerald-500">{selectedBuilding.floors.reduce((acc, f) => acc + f.rooms.reduce((ra, r) => ra + r.current, 0), 0)}</p>
                          </div>
                          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Uptime</p>
                            <p className="text-xl font-bold text-blue-500">99.9%</p>
                          </div>
                          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Bandwidth</p>
                            <p className="text-xl font-bold text-purple-500">{(Math.random() * 100).toFixed(1)} <span className="text-[10px]">Mbps</span></p>
                          </div>
                        </div>

                        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                          <div className="flex items-center gap-2 mb-2">
                            <Info className="w-3 h-3 text-emerald-500" />
                            <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Building Intelligence</h4>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            Node ini merupakan titik distribusi utama untuk area {selectedBuilding.name}. 
                            Sistem mendeteksi stabilitas sinyal yang optimal dengan interferensi rendah.
                          </p>
                        </div>

                        {/* Floor Selector */}
                        <div className="grid grid-cols-4 gap-2 mb-8">
                          {selectedBuilding.floors.map(floor => (
                            <button
                              key={floor.level}
                              onClick={() => setSelectedFloor(floor.level)}
                              className={cn(
                                "py-3 rounded-2xl text-xs font-bold transition-all border flex flex-col items-center gap-1",
                                selectedFloor === floor.level 
                                  ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20" 
                                  : "bg-white/5 border-white/10 text-zinc-500 hover:bg-white/10"
                              )}
                            >
                              <span className="opacity-60 text-[8px] uppercase">Floor</span>
                              <span>{floor.level}</span>
                            </button>
                          ))}
                        </div>

                        {/* Room List for Selected Floor */}
                        <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Access Point Status</h4>
                            <span className="text-[10px] text-zinc-600">Floor {selectedFloor}</span>
                          </div>
                          
                          {selectedBuilding.floors.find(f => f.level === selectedFloor)?.rooms.map(room => (
                            <div key={room.id} className={cn(
                              "p-5 rounded-3xl border transition-all",
                              room.status === 'offline' ? "bg-red-500/5 border-red-500/20" : "bg-black/40 border-white/5"
                            )}>
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center border",
                                    room.noWifi ? "bg-zinc-500/10 border-zinc-500/20 text-zinc-500" :
                                    room.status === 'offline' ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                  )}>
                                    {room.noWifi ? <SignalLow className="w-5 h-5" /> : room.status === 'offline' ? <PowerOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
                                  </div>
                                  <div>
                                    <span className="text-sm font-bold block">{room.name}</span>
                                    <div className="flex items-center gap-2">
                                      <div className={cn("w-1.5 h-1.5 rounded-full", room.noWifi ? "bg-zinc-600" : room.status === 'online' ? "bg-emerald-500" : "bg-red-500")} />
                                      <span className="text-[10px] uppercase font-mono tracking-tighter text-zinc-500">{room.noWifi ? 'No Coverage' : room.status}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                                    room.noWifi ? "text-zinc-500 bg-zinc-800" :
                                    room.status === 'offline' ? "text-zinc-600 bg-zinc-800" :
                                    (room.current / room.cap) > 0.8 ? "text-red-500 bg-red-500/10" :
                                    (room.current / room.cap) > 0.5 ? "text-amber-500 bg-amber-500/10" :
                                    "text-emerald-500 bg-emerald-500/10"
                                  )}>
                                    {room.noWifi ? 'OFF' : room.status === 'offline' ? 'N/A' : `${Math.floor((room.current / room.cap) * 100)}% Load`}
                                  </span>
                                  {room.status === 'online' && !room.noWifi && (
                                    <p className="text-[9px] text-zinc-600 mt-1 font-mono">{room.latency}ms Latency</p>
                                  )}
                                </div>
                              </div>

                              {room.status === 'online' && !room.noWifi && (
                                <>
                                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-3">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${(room.current / room.cap) * 100}%` }}
                                      className={cn(
                                        "h-full rounded-full",
                                        (room.current / room.cap) > 0.8 ? "bg-red-500" :
                                        (room.current / room.cap) > 0.5 ? "bg-amber-500" :
                                        "bg-emerald-500"
                                      )}
                                    />
                                  </div>
                                  <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                                    <span>{room.current} Connected</span>
                                    <span>{room.cap} Max</span>
                                  </div>
                                </>
                              )}
                              
                              {room.status === 'offline' && !room.noWifi && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                                  <AlertTriangle className="w-4 h-4 text-red-500" />
                                  <p className="text-[10px] text-red-500/80 leading-tight">Node unreachable. Maintenance or power failure detected.</p>
                                </div>
                              )}

                              {room.noWifi && (
                                <div className="flex items-center gap-2 p-3 bg-zinc-500/5 rounded-2xl border border-white/5">
                                  <SignalLow className="w-4 h-4 text-zinc-500" />
                                  <p className="text-[10px] text-zinc-500 leading-tight">This area is not covered by the campus WiFi network.</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ) : (
                      <div className="bg-white/5 border border-white/10 border-dashed rounded-3xl p-8 h-full flex flex-col items-center justify-center text-center text-zinc-600">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                          <MapPin className="w-10 h-10 opacity-20" />
                        </div>
                        <h4 className="text-lg font-bold text-zinc-400 mb-2">Interactive Map Explorer</h4>
                        <p className="text-sm max-w-[250px]">Select a WiFi node on the map to monitor real-time traffic and hardware status</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ) : view === 'topology' ? (
            <motion.div
              key="topology"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 min-h-[700px]">
                <div className="mb-12">
                  <h2 className="text-2xl font-bold">Network Topology Visualization</h2>
                  <p className="text-sm text-zinc-500">Hierarchical path monitoring from Internet to Access Points</p>
                </div>

                <div className="flex flex-col items-center">
                  {topology && <TopologyTree node={topology} />}
                </div>

                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Signal className="w-4 h-4 text-emerald-500" />
                      </div>
                      <h4 className="text-sm font-bold">Parent-Child Logic</h4>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">If a parent node (e.g. Switch) goes offline, all child nodes (APs) will automatically show as offline, indicating a path failure.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-blue-500" />
                      </div>
                      <h4 className="text-sm font-bold">Link Monitoring</h4>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">Real-time monitoring of interface status. "Link-down" on a switch port immediately flags the connected segment as problematic.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Layers className="w-4 h-4 text-purple-500" />
                      </div>
                      <h4 className="text-sm font-bold">Root Cause Analysis</h4>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">Visualizing the topology allows admins to quickly identify if a blackout is localized to a room or a whole building segment.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : view === 'devices' ? (
            <motion.div
              key="devices"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">MikroTik Device Manager</h2>
                  <p className="text-sm text-zinc-500">Manage and monitor multiple MikroTik routers</p>
                </div>
                <div className="flex items-center gap-4">
                  {/* Global Analytics Summary */}
                  {globalStats && (
                    <div className="flex items-center gap-6 px-6 py-2 bg-white/5 border border-white/10 rounded-2xl">
                      <div className="text-center">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Total</p>
                        <p className="text-lg font-bold">{globalStats.total}</p>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div className="text-center">
                        <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-widest">Online</p>
                        <p className="text-lg font-bold text-emerald-500">{globalStats.online}</p>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div className="text-center">
                        <p className="text-[10px] text-red-500 uppercase font-bold tracking-widest">Offline</p>
                        <p className="text-lg font-bold text-red-500">{globalStats.offline}</p>
                      </div>
                    </div>
                  )}
                  <button 
                    onClick={() => setIsAddingDevice(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Device
                  </button>
                </div>
              </div>

              {/* Notifications Bar */}
              {notifications.length > 0 && (
                <div className="space-y-2">
                  {notifications.map(notif => (
                    <motion.div 
                      key={notif.id}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className={cn(
                        "p-4 rounded-2xl border flex items-center justify-between",
                        notif.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-blue-500/10 border-blue-500/20 text-blue-500"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">{notif.message}</span>
                      </div>
                      <span className="text-[10px] opacity-60">{format(notif.time, 'HH:mm:ss')}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Device List */}
                <div className="lg:col-span-1 space-y-4">
                  {devices.length === 0 ? (
                    <div className="p-8 border border-dashed border-white/10 rounded-3xl text-center text-zinc-500">
                      <p className="text-sm">No devices registered yet.</p>
                    </div>
                  ) : (
                    devices.map(device => (
                      <div 
                        key={device.id}
                        onClick={() => fetchDeviceStatus(device)}
                        className={cn(
                          "p-5 rounded-3xl border transition-all cursor-pointer group",
                          selectedDevice?.id === device.id ? "bg-emerald-500/10 border-emerald-500/50" : "bg-white/5 border-white/10 hover:bg-white/10"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center border",
                              device.status === 'online' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border-red-500/20 text-red-500"
                            )}>
                              <HardDrive className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold">{device.name}</h4>
                                {device.is_primary === 1 && (
                                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-500 font-mono">{device.host}:{device.port}</p>
                            </div>
                          </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              {device.is_primary === 0 && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleSetPrimary(device.id); }}
                                  className="p-2 rounded-lg hover:bg-yellow-500/10 text-yellow-500 transition-all"
                                  title="Set as Primary"
                                >
                                  <Star className="w-4 h-4" />
                                </button>
                              )}
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEditDevice(device); }}
                                className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-500 transition-all"
                                title="Edit Device"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteDevice(device.id); }}
                                className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-all"
                                title="Delete Device"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-1.5 h-1.5 rounded-full", device.status === 'online' ? "bg-emerald-500" : "bg-red-500")} />
                            <span className="text-[10px] uppercase font-mono tracking-tighter text-zinc-500">{device.status}</span>
                          </div>
                          {device.last_seen && (
                            <span className="text-[10px] text-zinc-600">Last seen: {format(new Date(device.last_seen), 'HH:mm')}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Device Status & Control */}
                <div className="lg:col-span-2">
                  <AnimatePresence mode="wait">
                    {selectedDevice ? (
                      <motion.div 
                        key={selectedDevice.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                              <Terminal className="w-8 h-8 text-emerald-500" />
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-bold">{selectedDevice.name}</h3>
                                {selectedDevice.is_primary === 1 && (
                                  <span className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-[10px] font-bold text-yellow-500 uppercase tracking-wider">
                                    Primary
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-zinc-500">Identity: {deviceStatus?.identity || '...'}</p>
                                <button 
                                  onClick={() => { setIsRenaming(true); setNewName(deviceStatus?.identity || ''); }}
                                  className="text-[10px] text-emerald-500 hover:underline"
                                >
                                  Rename
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => fetchDeviceStatus(selectedDevice)}
                              className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                              title="Refresh Status"
                            >
                              <RotateCw className="w-5 h-5 text-zinc-400" />
                            </button>
                            <button 
                              onClick={() => handleReboot(selectedDevice.id)}
                              className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-bold text-sm hover:bg-red-500/20 transition-all"
                            >
                              Reboot
                            </button>
                          </div>
                        </div>

                        {deviceStatus?.online ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                              <div className="flex items-center gap-3">
                                <Cpu className="w-5 h-5 text-blue-500" />
                                <h4 className="text-sm font-bold">System Resources</h4>
                              </div>
                              <div className="space-y-3">
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-500">CPU Load</span>
                                  <span className="font-mono text-blue-500">{deviceStatus.cpuLoad}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500 transition-all" 
                                    style={{ width: `${deviceStatus.cpuLoad}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-500">Free Memory</span>
                                  <span className="font-mono text-emerald-500">{(Number(deviceStatus.freeMemory) / (1024 * 1024)).toFixed(1)} MB</span>
                                </div>
                              </div>
                            </div>

                            <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                              <div className="flex items-center gap-3">
                                <Info className="w-5 h-5 text-purple-500" />
                                <h4 className="text-sm font-bold">System Info</h4>
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-500">Uptime</span>
                                  <span className="font-mono">{deviceStatus.uptime}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-500">Version</span>
                                  <span className="font-mono">{deviceStatus.version}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-500">Host</span>
                                  <span className="font-mono">{selectedDevice.host}</span>
                                </div>
                              </div>
                            </div>

                            {/* Interfaces Section */}
                            <div className="md:col-span-2 p-6 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Network className="w-5 h-5 text-emerald-500" />
                                  <h4 className="text-sm font-bold">Network Interfaces</h4>
                                </div>
                                <span className="text-[10px] text-zinc-500 font-mono">{deviceInterfaces.length} Interfaces</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {deviceInterfaces.map((iface: any) => (
                                  <div key={iface.name} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        iface.running === "true" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-600"
                                      )} />
                                      <div>
                                        <p className="text-xs font-bold truncate max-w-[100px]">{iface.name}</p>
                                        <p className="text-[10px] text-zinc-500 font-mono">{iface.type}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleToggleInterface(selectedDevice.id, iface.name, iface.disabled)}
                                        className={cn(
                                          "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase transition-all",
                                          iface.disabled === "true" ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                        )}
                                      >
                                        {iface.disabled === "true" ? "Enable" : "Disable"}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Remote Console Section */}
                            <div className="md:col-span-2 p-6 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                              <div className="flex items-center gap-3">
                                <Terminal className="w-5 h-5 text-amber-500" />
                                <h4 className="text-sm font-bold">Quick Command Console</h4>
                              </div>
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  placeholder="/ip/address/print"
                                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono focus:outline-none focus:border-amber-500/50 transition-all"
                                  value={command}
                                  onChange={e => setCommand(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleExec(selectedDevice.id)}
                                />
                                <button 
                                  disabled={isExecuting}
                                  onClick={() => handleExec(selectedDevice.id)}
                                  className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl font-bold text-xs hover:bg-amber-500/20 transition-all disabled:opacity-50"
                                >
                                  {isExecuting ? '...' : 'Execute'}
                                </button>
                              </div>
                              {commandResult && (
                                <div className="p-4 rounded-xl bg-black/60 border border-white/5 overflow-x-auto">
                                  <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap">{commandResult}</pre>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : deviceStatus?.error ? (
                          <div className="p-8 rounded-2xl bg-red-500/5 border border-red-500/20 text-center space-y-4">
                            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                            <div>
                              <h4 className="font-bold text-red-500">Connection Failed</h4>
                              <p className="text-sm text-red-500/60">{deviceStatus.error}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-20 text-center">
                            <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <div className="bg-white/5 border border-white/10 border-dashed rounded-3xl p-20 h-full flex flex-col items-center justify-center text-center text-zinc-600">
                        <Settings className="w-16 h-16 opacity-10 mb-6" />
                        <h4 className="text-lg font-bold text-zinc-400 mb-2">Select a device to monitor</h4>
                        <p className="text-sm max-w-[300px]">Choose a MikroTik device from the list to view real-time status and perform remote actions.</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>              {/* Add/Edit Device Modal */}
              <AnimatePresence>
                {(isAddingDevice || isEditingDevice) && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => {
                        setIsAddingDevice(false);
                        setIsEditingDevice(false);
                        setEditingDevice(null);
                        setNewDevice({ name: '', host: '', user: '', password: '', port: 8728 });
                      }}
                      className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
                    >
                      <h3 className="text-xl font-bold mb-6">{isEditingDevice ? 'Edit MikroTik Device' : 'Add New MikroTik Device'}</h3>
                      <form onSubmit={isEditingDevice ? handleUpdateDevice : handleAddDevice} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Device Name</label>
                          <input 
                            required
                            type="text"
                            placeholder="e.g. Core Router"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                            value={newDevice.name}
                            onChange={e => setNewDevice({...newDevice, name: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-2 space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Host / IP</label>
                            <input 
                              required
                              type="text"
                              placeholder="192.168.1.1"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                              value={newDevice.host}
                              onChange={e => setNewDevice({...newDevice, host: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Port</label>
                            <input 
                              required
                              type="number"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                              value={newDevice.port}
                              onChange={e => setNewDevice({...newDevice, port: parseInt(e.target.value)})}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Username</label>
                            <input 
                              required
                              type="text"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                              value={newDevice.user}
                              onChange={e => setNewDevice({...newDevice, user: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Password</label>
                            <input 
                              required={!isEditingDevice}
                              type="password"
                              placeholder={isEditingDevice ? "Leave blank to keep current" : "••••••••"}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                              value={newDevice.password}
                              onChange={e => setNewDevice({...newDevice, password: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="pt-4 flex gap-3">
                          <button 
                            type="button"
                            onClick={() => {
                              setIsAddingDevice(false);
                              setIsEditingDevice(false);
                              setEditingDevice(null);
                              setNewDevice({ name: '', host: '', user: '', password: '', port: 8728 });
                            }}
                            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-sm hover:bg-white/10 transition-all"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit"
                            className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                          >
                            {isEditingDevice ? 'Save Changes' : 'Add Device'}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Rename Modal */}
              <AnimatePresence>
                {isRenaming && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsRenaming(false)}
                      className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
                    >
                      <h3 className="text-xl font-bold mb-6">Rename Router Identity</h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">New Identity</label>
                          <input 
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                          />
                        </div>
                        <div className="pt-4 flex gap-3">
                          <button 
                            onClick={() => setIsRenaming(false)}
                            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-sm hover:bg-white/10 transition-all"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => selectedDevice && handleRename(selectedDevice.id)}
                            className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                          >
                            Rename
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="docs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold tracking-tight">Network Intelligence Guide</h2>
                <p className="text-zinc-500">Understanding Network Topology Visualization & Path Monitoring</p>
              </div>

              <div className="grid gap-8">
                <section className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <Network className="w-6 h-6 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl font-bold">1. Network Topology Monitoring</h3>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    Sistem ini menampilkan struktur jaringan secara visual. Menampilkan jalur koneksi jaringan (kabel/link) sehingga kalau ada perangkat offline, bisa terlihat di titik mana jaringan putus.
                  </p>
                  <div className="bg-black/40 rounded-2xl p-6 font-mono text-xs text-emerald-500/80 border border-white/5">
                    Internet<br/>
                    &nbsp;&nbsp;│<br/>
                    Router MikroTik<br/>
                    &nbsp;&nbsp;│<br/>
                    Switch Core<br/>
                    &nbsp;&nbsp;├── Switch Gedung A<br/>
                    &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── AP A1<br/>
                    &nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── AP A2<br/>
                    &nbsp;&nbsp;│<br/>
                    &nbsp;&nbsp;└── Switch Gedung B<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── AP B1<br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── AP B2
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <Info className="w-5 h-5 text-amber-500 mt-0.5" />
                    <p className="text-sm text-amber-200/70">
                      Jika <strong>Switch Gedung A</strong> mati, maka semua AP di bawahnya akan ikut merah/offline. Sistem menyimpulkan gangguan ada di Switch tersebut atau kabel ke sana.
                    </p>
                  </div>
                </section>

                <section className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <HardDrive className="w-6 h-6 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-bold">2. Link Monitoring (Kabel / Jalur)</h3>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    Sistem monitoring juga memonitor status link interface. Contoh di MikroTik menggunakan command <code>/interface ethernet print</code>.
                  </p>
                  <div className="bg-black/40 rounded-2xl p-6 font-mono text-xs text-blue-400/80 border border-white/5">
                    ether1&nbsp;&nbsp;running<br/>
                    ether2&nbsp;&nbsp;link-down
                  </div>
                  <p className="text-sm text-zinc-500">
                    Jika kabel dicabut, status berubah menjadi <strong>link-down</strong>. Berarti sistem tahu kabel pada port tersebut yang bermasalah.
                  </p>
                </section>

                <section className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                      <Cpu className="w-6 h-6 text-purple-500" />
                    </div>
                    <h3 className="text-2xl font-bold">3. Teknologi & Protokol</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                      <h4 className="font-bold text-emerald-500 mb-1">SNMP</h4>
                      <p className="text-xs text-zinc-500">Simple Network Management Protocol untuk membaca status internal perangkat.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                      <h4 className="font-bold text-blue-500 mb-1">ICMP (Ping)</h4>
                      <p className="text-xs text-zinc-500">Untuk mengecek ketersediaan (online/offline) perangkat secara cepat.</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <p className="text-sm text-zinc-500 mb-4">Sistem populer yang mendukung fitur ini:</p>
                    <div className="flex flex-wrap gap-2">
                      {['Zabbix', 'LibreNMS', 'PRTG Network Monitor', 'The Dude'].map(tool => (
                        <span key={tool} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            System Operational
          </div>
          <p className="text-zinc-600 text-xs">© 2026 ITATS Network Intelligence. Powered by Gemini AI.</p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ icon, label, value, trend, color }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number; 
  trend: string;
  color: 'emerald' | 'blue' | 'amber';
}) {
  const colors = {
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    amber: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", colors[color])}>
          {icon}
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
      </div>
      <p className="text-sm text-zinc-500 mb-1">{label}</p>
      <h3 className="text-3xl font-bold tracking-tight mb-2">{value}</h3>
      <p className={cn("text-[10px] font-bold uppercase tracking-widest", color === 'emerald' ? 'text-emerald-500/60' : 'text-zinc-500')}>
        {trend}
      </p>
    </motion.div>
  );
}

function TopologyTree({ node, level = 0 }: { node: TopologyNode; level?: number }) {
  const icons = {
    cloud: <Globe className="w-5 h-5" />,
    router: <Server className="w-5 h-5" />,
    switch: <HardDrive className="w-5 h-5" />,
    ap: <Wifi className="w-5 h-5" />
  };

  const colors = {
    online: "bg-emerald-500 border-emerald-400 shadow-emerald-500/20",
    offline: "bg-red-500 border-red-400 shadow-red-500/20"
  };

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group"
      >
        <div className={cn(
          "w-48 p-4 rounded-2xl border transition-all duration-500 flex flex-col items-center gap-2 z-10 relative",
          node.status === 'online' ? "bg-black/60 border-white/10 group-hover:border-emerald-500/50" : "bg-red-500/10 border-red-500/30"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center border shadow-lg",
            node.status === 'online' ? "bg-white/5 border-white/10 text-zinc-400" : "bg-red-500/20 border-red-500/40 text-red-500"
          )}>
            {icons[node.type]}
          </div>
          <div className="text-center">
            <p className="text-xs font-bold tracking-tight">{node.name}</p>
            <p className={cn(
              "text-[8px] uppercase font-mono tracking-widest mt-0.5",
              node.status === 'online' ? "text-emerald-500" : "text-red-500"
            )}>
              {node.status}
            </p>
          </div>
        </div>
        
        {node.children && node.children.length > 0 && (
          <div className="h-12 w-px bg-white/10 mx-auto" />
        )}
      </motion.div>

      {node.children && node.children.length > 0 && (
        <div className="flex gap-8 relative">
          {/* Horizontal connecting line */}
          {node.children.length > 1 && (
            <div className="absolute top-0 left-[24px] right-[24px] h-px bg-white/10" />
          )}
          
          {node.children.map((child, idx) => (
            <div key={child.id} className="flex flex-col items-center">
              {/* Vertical line to horizontal line */}
              <div className="h-4 w-px bg-white/10" />
              <TopologyTree node={child} level={level + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
