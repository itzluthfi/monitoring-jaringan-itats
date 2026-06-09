import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import {
  Search,
  Shield,
  Wifi,
  MapPin,
  Activity,
  Globe,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Clock,
  Zap,
  Users,
  Building2,
  Cpu,
  ArrowDownUp,
  Info,
  X,
  Sun,
  Moon,
  LayoutList,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import { usePublicTheme } from "../hooks/usePublicTheme";

// Fix Leaflet marker icon for React environment
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface PublicMapBuilding {
  id: string;
  name: string;
  lat: number;
  lng: number;
  online?: boolean;
  user_count?: number;
  user_breakdown?: Array<{ label: string; count: number }>;
  device_count?: number;
  device_categories?: Array<{ label: string; count: number }>;
  device_names?: string[];
  density?: number;
  load_label?: string;
  bandwidth_download?: string | null;
  bandwidth_upload?: string | null;
  floors: Array<{
    level: string;
    areas: Array<{
      name: string;
      current: number;
      online: boolean;
    }>;
  }>;
}

interface PublicStatus {
  network: { total: number; online: number; offline: number };
  hasActiveAlerts: boolean;
  recentIssues: Array<{
    type: string;
    title: string;
    time: string;
  }>;
  lastUpdated?: string;
}

const sanitizePublicName = (name: string): string => {
  if (!name) return "";
  let clean = name;

  // If the whole name is specifically router core or eth interfaces
  const lower = clean.toLowerCase();
  if (lower === "router core") return "Pusat Jaringan";
  if (lower === "eth interfaces") return "Sistem Jaringan Utama";

  // Replace case-insensitive "mikrotik"
  clean = clean.replace(/mikrotik/gi, "");

  // Replace other technical jargon
  clean = clean.replace(/router\s*core/gi, "Pusat Jaringan");
  clean = clean.replace(/eth\s*interfaces?/gi, "Koneksi Jaringan");
  clean = clean.replace(/ethernet/gi, "Koneksi Kabel");

  // Clean up dashes, underscores, and extra spaces
  clean = clean.replace(/[-_\s]+/g, " ").trim();

  return clean || "Perangkat Jaringan";
};

const CAMPUS_BOUNDS = L.latLngBounds(
  [-7.294, 112.774], // Southwest
  [-7.287, 112.784]  // Northeast
);

function MapUpdater({ selectedBuilding }: { selectedBuilding: any | null }) {
  const map = useMap();
  useEffect(() => {
    if (selectedBuilding) {
      map.setView([selectedBuilding.lat, selectedBuilding.lng], 18);
    } else {
      map.setView([-7.2908, 112.779], 17);
    }
  }, [selectedBuilding, map]);
  return null;
}

export default function PublicMapPage() {
  const [buildings, setBuildings] = useState<PublicMapBuilding[]>([]);
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] =
    useState<PublicMapBuilding | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [leftExpanded, setLeftExpanded] = useState(window.innerWidth >= 1024);
  const [rightExpanded, setRightExpanded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [showDeviceDetail, setShowDeviceDetail] = useState(false);
  const { isDark, toggleTheme } = usePublicTheme();

  const [activeBuilding, setActiveBuilding] = useState<PublicMapBuilding | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  useEffect(() => {
    if (selectedBuilding) {
      setActiveBuilding(selectedBuilding);
    }
  }, [selectedBuilding]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = (onDismiss: () => void) => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchEnd - touchStart;
    const isSwipeDown = distance > 70;
    if (isSwipeDown) {
      onDismiss();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  const baseUrl = import.meta.env.VITE_API_URL || "";

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setLeftExpanded(true);
        if (selectedId) {
          setRightExpanded(true);
        }
      } else {
        setLeftExpanded(false);
        if (!selectedId) {
          setRightExpanded(false);
        }
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [selectedId]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statusRes, mapRes] = await Promise.all([
          fetch(`${baseUrl}/api/public/status`),
          fetch(`${baseUrl}/api/public/campus-map`),
        ]);

        const statusJson = await statusRes.json();
        const mapJson = await mapRes.json();

        console.log("MAP DATA:", mapJson);
        setStatus(statusJson);
        setLastRefresh(new Date());
        if (Array.isArray(mapJson)) {
          setBuildings(mapJson);
          setSelectedBuilding((prev) => {
            if (!prev) return null;
            return (
              mapJson.find((b: PublicMapBuilding) => b.id === prev.id) || null
            );
          });
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
        setMapLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [baseUrl]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedBuilding(null);
      if (isMobile) setRightExpanded(false);
      return;
    }
    const found = buildings.find((b) => b.id === selectedId);
    setSelectedBuilding(found || null);
    setRightExpanded(true);
    // Reset detail panels on building change
    setShowUserDetail(false);
    setShowDeviceDetail(false);
  }, [selectedId, buildings, isMobile]);

  const filteredBuildings = buildings.filter(
    (b) =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sanitizePublicName(b.name).toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.floors.some((floor) =>
        floor.areas.some((area) =>
          area.name.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      ),
  );

  const sortedBuildings = [...filteredBuildings].sort((a, b) => {
    const aDensity = a.density ?? 0;
    const bDensity = b.density ?? 0;
    return bDensity - aDensity || (b.user_count ?? 0) - (a.user_count ?? 0);
  });

  // Aggregate totals across all buildings
  const totalCurrent = buildings.reduce((acc, b) => acc + (b.user_count ?? 0), 0);
  const totalDevices = buildings.reduce((acc, b) => acc + (b.device_count ?? 0), 0);
  const totalCapacity = 0; // Not used (was always 0)

  const getDensityColor = (building: PublicMapBuilding) => {
    if (!building.online) return "#9ca3af"; // gray for offline
    const userCount = building.user_count ?? 0;
    if (userCount === 0) return "#9ca3af"; // gray for 0 users
    const density = building.density ?? 0;
    if (density >= 80) return "#dc2626"; // red
    if (density >= 40) return "#f59e0b"; // yellow
    return "#22c55e"; // green
  };

  const getDensityStatusText = (building: PublicMapBuilding) => {
    if (!building.online) return "Offline";
    const userCount = building.user_count ?? 0;
    if (userCount === 0) return "Sepi (0%)";
    const density = building.density ?? 0;
    if (density >= 80) return `Padat (${density}%)`;
    if (density >= 40) return `Sedang (${density}%)`;
    return `Sepi (${density}%)`;
  };

  const getDensityLabel = (building: PublicMapBuilding) => {
    if (!building.online) return "Offline";
    // Use load_label from API (already computed correctly in backend)
    if (building.load_label) return building.load_label;
    const d = building.density ?? 0;
    if (d >= 90) return "Sangat Ramai";
    if (d >= 70) return "Ramai";
    if (d >= 40) return "Sedang";
    return "Ringan";
  };

  const getStatusLabelClass = (building: PublicMapBuilding) =>
    building.online ? "text-emerald-300" : "text-rose-400";

  const getDensityBadgeClass = (building: PublicMapBuilding) => {
    if (!building.online) {
      return isDark
        ? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
        : "bg-zinc-100 text-zinc-600 border border-zinc-200";
    }
    const userCount = building.user_count ?? 0;
    if (userCount === 0) {
      return isDark
        ? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
        : "bg-zinc-100 text-zinc-600 border border-zinc-200";
    }
    const density = building.density ?? 0;
    if (density >= 80) {
      return isDark
        ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
        : "bg-rose-50 text-rose-700 border border-rose-200";
    }
    if (density >= 40) {
      return isDark
        ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
        : "bg-amber-50 text-amber-700 border border-amber-250";
    }
    return isDark
      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
      : "bg-emerald-50 text-emerald-700 border border-emerald-200";
  };

  const getWifiIcon = (building: PublicMapBuilding) => {
    const fillColor = getDensityColor(building);
    const label = sanitizePublicName(building.name) || "Wi-Fi";
    const clients = building.user_count ?? 0;
    const isOffline = !building.online;
    const labelColor = isOffline ? "#9ca3af" : "#f8fafc";
    const html = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;max-width:120px;">
      <div style="padding:4px 8px;border-radius:999px;background:rgba(15,23,42,0.95);color:${labelColor};font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
      <div style="position:relative;width:48px;height:48px;border-radius:999px;background:${fillColor};display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 6px rgba(15,23,42,0.3);filter:${isOffline ? "grayscale(100%) brightness(0.7)" : "none"};">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${isOffline ? `<line x1="2" y1="22" x2="22" y2="2" stroke="white" stroke-width="2" stroke-linecap="round" />` : ""}
          <path d="M2 8.5C7 3.5 17 3.5 22 8.5" stroke="white" stroke-width="2" stroke-linecap="round" />
          <path d="M5.5 12C8.5 9 15.5 9 18.5 12" stroke="white" stroke-width="2" stroke-linecap="round" />
          <path d="M9.5 15.5C11 14 13 14 14.5 15.5" stroke="white" stroke-width="2" stroke-linecap="round" />
          <circle cx="12" cy="18" r="1.5" fill="white" />
        </svg>
        <div style="position:absolute;right:-8px;bottom:-8px;width:24px;height:24px;border-radius:999px;background:#0f172a;border:1px solid rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;color:#f8fafc;font-size:11px;font-weight:700;">
          ${clients}
        </div>
      </div>
    </div>`;
    return L.divIcon({
      className: "custom-wifi-icon",
      html,
      iconSize: [72, 72],
      iconAnchor: [36, 72],
    });
  };

  const isAllGood = status && status.network?.offline === 0 && !status.hasActiveAlerts;
  const hasIssues = status && (status.network?.offline > 0 || status.hasActiveAlerts);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${isDark ? 'bg-[#08111f] text-zinc-100' : 'bg-[#eef2f9] text-slate-900 pub-light'}`}>
      {/* Mobile Search Drawer */}
      {isMobile && (
        <div 
          className={`fixed inset-x-0 bottom-0 top-16 z-[700] flex flex-col rounded-t-[2.5rem] border-t shadow-2xl transition-all duration-300 ease-out lg:hidden ${
            isDark ? 'bg-slate-950/98 text-zinc-100 border-white/10' : 'bg-white text-slate-900 border-slate-200'
          } ${leftExpanded ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
        >
          <div 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => handleTouchEnd(() => setLeftExpanded(false))}
            className="flex flex-col flex-shrink-0 cursor-pointer pt-3 pb-1"
          >
            <div className="flex justify-center mb-2">
              <div className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-slate-350'}`} />
            </div>
            <div className={`flex items-center justify-between gap-3 border-b px-4 pb-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <h2 className="text-lg font-semibold">Cari Area</h2>
              <button
                onClick={() => setLeftExpanded(false)}
                className={`rounded-full border p-2 transition ${isDark ? 'border-white/10 bg-zinc-900/80 text-zinc-300 hover:text-white' : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'}`}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 p-4 pb-12">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari gedung atau ruang..."
                className={`w-full rounded-3xl border py-3 pl-12 pr-4 text-sm outline-none transition ${
                  isDark 
                    ? 'border-zinc-800 bg-slate-950/90 text-zinc-100 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20' 
                    : 'border-slate-200 bg-white text-slate-800 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10'
                }`}
              />
            </div>
            <div className="space-y-3">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className={`w-full rounded-3xl border p-4 animate-pulse ${isDark ? 'border-white/5 bg-zinc-900/40' : 'border-slate-100 bg-slate-50/50'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-2 flex-1">
                        <div className={`h-4 rounded w-3/4 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}></div>
                        <div className={`h-3 rounded w-1/2 ${isDark ? 'bg-zinc-850' : 'bg-slate-100'}`}></div>
                      </div>
                      <div className={`h-6 w-16 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}></div>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  {filteredBuildings.map((building) => (
                    <button
                      key={building.id}
                      onClick={() => {
                        setSelectedId(building.id);
                        setLeftExpanded(false);
                      }}
                      className={`w-full rounded-3xl border p-3 text-left transition duration-200 select-none active:scale-[0.98] ${
                        selectedId === building.id 
                          ? isDark ? "border-cyan-400/40 bg-cyan-500/10" : "border-cyan-400 bg-cyan-50" 
                          : isDark ? "border-white/5 bg-zinc-900/70 hover:border-white/10 hover:bg-zinc-900/90" : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-100/70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {sanitizePublicName(building.name)}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {building.density ?? 0}% • {building.user_count ?? 0}{" "}
                            pengguna
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold whitespace-nowrap ${getDensityBadgeClass(building)}`}
                        >
                          {getDensityStatusText(building)}
                        </span>
                      </div>
                    </button>
                  ))}
                  {filteredBuildings.length === 0 && (
                    <p className="text-sm text-zinc-500">
                      Tidak ditemukan area pada pencarian.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}      {/* Mobile Detail Drawer */}
      {isMobile && activeBuilding && (
        <div 
          className={`fixed inset-x-0 bottom-0 top-16 z-[700] flex flex-col rounded-t-[2.5rem] border-t shadow-2xl transition-all duration-300 ease-out lg:hidden ${
            isDark ? 'bg-slate-950/98 text-zinc-100 border-white/10' : 'bg-white text-slate-900 border-slate-200'
          } ${rightExpanded ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
        >
          <div 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => handleTouchEnd(() => setRightExpanded(false))}
            className="flex flex-col flex-shrink-0 cursor-pointer pt-3 pb-1"
          >
            <div className="flex justify-center mb-2">
              <div className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-slate-350'}`} />
            </div>
            <div className={`flex items-center justify-between gap-3 border-b px-4 pb-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <h2 className="text-lg font-semibold">Detail Area</h2>
              <button
                onClick={() => setRightExpanded(false)}
                className={`rounded-full border p-2 transition ${isDark ? 'border-white/10 bg-zinc-900/80 text-zinc-300 hover:text-white' : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'}`}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 p-4 pb-12">
            <div className={`rounded-3xl border p-4 ${isDark ? 'border-zinc-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/50'}`}>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Lokasi
              </p>
              <p className={`mt-2 text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {sanitizePublicName(activeBuilding.name)}
              </p>
              <p
                className={`mt-1 text-xs uppercase tracking-[0.2em] ${getStatusLabelClass(activeBuilding)}`}
              >
                {activeBuilding.online ? "Online" : "Offline"}
              </p>
            </div>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Pengguna WiFi — klikable */}
                <button
                  onClick={() => setShowUserDetail((v) => !v)}
                  className={`rounded-3xl border text-left transition active:scale-[0.97] p-4 select-none ${
                    isDark 
                      ? 'border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10' 
                      : 'border-cyan-200 bg-cyan-50/40 hover:bg-cyan-100/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                      <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-cyan-400' : 'text-cyan-750'}`}>Pengguna WiFi</p>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isDark ? 'text-cyan-400' : 'text-cyan-650'} ${showUserDetail ? "rotate-90" : ""}`} />
                  </div>
                  <p className={`mt-1 text-3xl font-bold ${isDark ? 'text-white' : 'text-cyan-950'}`}>{activeBuilding.user_count ?? 0}</p>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-cyan-300/60' : 'text-cyan-600/80'}`}>Ketuk untuk detail</p>
                </button>
                {/* Perangkat — klikable */}
                <button
                  onClick={() => setShowDeviceDetail((v) => !v)}
                  className={`rounded-3xl border text-left transition active:scale-[0.97] p-4 select-none ${
                    isDark 
                      ? 'border-zinc-800 bg-slate-900/80 hover:bg-slate-800/80' 
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-400' : 'text-slate-550'}`} />
                      <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-slate-555'}`}>Perangkat</p>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 text-zinc-550 transition-transform ${showDeviceDetail ? "rotate-90" : ""}`} />
                  </div>
                  <p className={`mt-1 text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{activeBuilding.device_count ?? 0}</p>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-650' : 'text-slate-400'}`}>Ketuk untuk detail</p>
                </button>
              </div>

              {/* Panel detail pengguna WiFi */}
              {showUserDetail && (
                <div className={`rounded-3xl border p-4 ${isDark ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/40'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                    <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-cyan-400' : 'text-cyan-755'}`}>Jenis Perangkat Pengguna</p>
                  </div>
                  {activeBuilding.user_breakdown && activeBuilding.user_breakdown.length > 0 ? (
                    <div className="space-y-2">
                      {activeBuilding.user_breakdown.map((item) => (
                        <div key={item.label} className={`flex items-center justify-between py-1 border-b last:border-0 ${isDark ? 'border-cyan-500/10' : 'border-cyan-200/50'}`}>
                          <span className={`text-xs ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{item.label}</span>
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isDark ? 'text-cyan-200 bg-cyan-500/10' : 'text-cyan-800 bg-cyan-100/50'}`}>{item.count} perangkat</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Informasi perangkat tidak tersedia saat ini.</p>
                  )}
                  <p className={`text-[10px] ${isDark ? 'text-zinc-650' : 'text-slate-400'} mt-3`}>Data anonim — tidak mencantumkan identitas pengguna</p>
                </div>
              )}

              {/* Panel detail perangkat kampus */}
              {showDeviceDetail && (
                <div className={`rounded-3xl border p-4 ${isDark ? 'border-zinc-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-400' : 'text-slate-550'}`} />
                    <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-slate-555'}`}>Detail Perangkat Kampus</p>
                  </div>
                  {activeBuilding.device_names && activeBuilding.device_names.length > 0 ? (
                    <div className="space-y-2">
                      {activeBuilding.device_names.map((name, index) => (
                        <div key={index} className={`flex items-center justify-between py-1 border-b last:border-0 ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                          <span className={`text-xs font-semibold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'text-emerald-300 bg-emerald-500/10' : 'text-emerald-800 bg-emerald-100/50'}`}>Online</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Tidak ada perangkat kampus terdeteksi.</p>
                  )}
                </div>
              )}
              {activeBuilding.online && (activeBuilding.bandwidth_download || activeBuilding.bandwidth_upload) && (
                <div className={`rounded-3xl border p-4 ${isDark ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/40'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownUp className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                    <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-cyan-400' : 'text-cyan-750'}`}>Bandwidth</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-zinc-500">↓ Download</p>
                      <p className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-850'}`}>{activeBuilding.bandwidth_download ?? "–"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500">↑ Upload</p>
                      <p className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-850'}`}>{activeBuilding.bandwidth_upload ?? "–"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {activeBuilding.floors && activeBuilding.floors.length > 0 && (
              <div className={`rounded-3xl border p-4 ${isDark ? 'border-zinc-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/50'}`}>
                <p className={`text-xs uppercase tracking-[0.2em] mb-3 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                  Titik Akses Wi-Fi / Sektor
                </p>
                <div className="space-y-3">
                  {activeBuilding.floors.map((floor) => (
                    <div
                      key={floor.level}
                      className={`rounded-2xl p-3 ${isDark ? 'bg-slate-950/80' : 'bg-white border border-slate-100 shadow-sm'}`}
                    >
                      <p className={`text-xs uppercase tracking-[0.2em] font-semibold mb-2 ${isDark ? 'text-cyan-300/80' : 'text-cyan-755'}`}>
                        {floor.level}
                      </p>
                      <div className="space-y-2">
                        {floor.areas.map((area, aIdx) => (
                          <div
                            key={aIdx}
                            className={`flex items-center justify-between gap-2 text-xs rounded-lg p-2 ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                {area.name}
                              </p>
                              <p className="text-zinc-500 text-[10px]">
                                {area.current} pengguna
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                                area.online
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              }`}
                            >
                              {area.online ? "Online" : "Offline"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-[500] border-b backdrop-blur-xl ${isDark ? 'border-white/10 bg-slate-950/80' : 'border-black/8 bg-white/92'}`}>
        <div className="mx-auto px-4 md:px-6 py-3 md:py-4">

          {/* ── MOBILE HEADER: satu baris, compact ── */}
          <div className="flex items-center justify-between md:hidden">
            {/* Logo kecil */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-cyan-400/70 font-semibold leading-none">ITATS Portal</p>
                <h1 className="text-base font-bold tracking-tight leading-tight">Live Campus Map</h1>
              </div>
            </div>
            {/* Icons kanan: Info + Theme toggle */}
            <div className="flex items-center gap-2">
              {/* Info lapor */}
              <div className="relative">
                <button
                  onClick={() => setShowInfoTooltip((v) => !v)}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border transition ${
                    isDark ? 'border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:text-cyan-300 hover:border-cyan-500/40' : 'border-slate-200 bg-white text-slate-500 hover:text-cyan-600 hover:border-slate-350'
                  }`}
                  title="Cara melaporkan gangguan"
                >
                  <Info className="w-4 h-4" />
                </button>
                {showInfoTooltip && (
                  <div className={`absolute top-10 right-0 z-[600] w-72 rounded-2xl border shadow-2xl p-4 ${isDark ? 'border-cyan-500/20 bg-slate-950 shadow-cyan-950/30 text-zinc-100' : 'border-cyan-200 bg-white shadow-cyan-100/50 text-slate-700'}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Cara Lapor Gangguan</p>
                      </div>
                      <button onClick={() => setShowInfoTooltip(false)} className={`transition ${isDark ? 'text-zinc-500 hover:text-white' : 'text-slate-400 hover:text-slate-850'}`}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className={`space-y-2 text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-650'}`}>
                      <div className="flex gap-2"><span className="text-cyan-400 font-bold flex-shrink-0">1.</span><p>Klik tombol <span className={`font-semibold ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>Lapor</span> di menu bawah.</p></div>
                      <div className="flex gap-2"><span className="text-cyan-400 font-bold flex-shrink-0">2.</span><p>Isi formulir: nama, lokasi, dan deskripsi masalah koneksi.</p></div>
                      <div className="flex gap-2"><span className="text-cyan-400 font-bold flex-shrink-0">3.</span><p>Laporan dikirim ke tim UPT TI dan ditangani sesuai antrean (<span className={`font-semibold ${isDark ? 'text-indigo-300' : 'text-indigo-650'}`}>sistem tiket</span>).</p></div>
                      <div className="flex gap-2"><span className="text-cyan-400 font-bold flex-shrink-0">4.</span><p>Pantau melalui menu <span className={`font-semibold ${isDark ? 'text-indigo-300' : 'text-indigo-650'}`}>Tiket</span> di bawah.</p></div>
                    </div>
                    <div className={`mt-3 pt-3 border-t text-[10px] ${isDark ? 'border-white/5 text-zinc-500' : 'border-slate-100 text-slate-450'}`}>Tiket = nomor antrian penanganan</div>
                  </div>
                )}
              </div>
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border transition ${
                  isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20' : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-white'
                }`}
                title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* ── DESKTOP HEADER: full layout ── */}
          <div className="hidden md:flex md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70 font-semibold">ITATS Student Portal</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Live Campus Map</h1>
              </div>
            </div>
            <div className="flex gap-3 items-center">
              {/* Lapor Gangguan */}
              <button
                onClick={() => (window.location.href = "/report")}
                className={`relative inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] cursor-pointer shadow-lg ${
                  isDark 
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 shadow-rose-950/20' 
                    : 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 shadow-rose-100/50'
                }`}
              >
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <Plus className="w-4 h-4 text-rose-500" />
                Lapor Gangguan
              </button>
              <button
                onClick={() => (window.location.href = "/status-board")}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] cursor-pointer ${
                  isDark ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20' : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Status Tiket
              </button>
              <button
                onClick={() => (window.location.href = "/login")}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all hover:scale-[1.02] cursor-pointer ${
                  isDark ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20' : 'border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-cyan-700'
                }`}
              >
                <Shield className="w-4 h-4 text-cyan-400" />
                Admin
              </button>
              {/* Info Panduan */}
              <div className="relative">
                <button
                  onClick={() => setShowInfoTooltip((v) => !v)}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-2xl border transition ${
                    isDark ? 'border-zinc-700 bg-zinc-900/80 text-zinc-200 hover:bg-zinc-800' : 'border-slate-350 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Cara melaporkan gangguan"
                >
                  <Info className="w-4 h-4" />
                </button>
                {showInfoTooltip && (
                  <div className={`absolute top-12 right-0 z-[600] w-72 rounded-2xl border shadow-2xl p-4 ${isDark ? 'border-cyan-500/20 bg-slate-950 shadow-cyan-950/30 text-zinc-100' : 'border-cyan-200 bg-white shadow-cyan-100/50 text-slate-700'}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Cara Lapor Gangguan</p>
                      </div>
                      <button onClick={() => setShowInfoTooltip(false)} className={`transition ${isDark ? 'text-zinc-500 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}><X className="w-4 h-4" /></button>
                    </div>
                    <div className={`space-y-2 text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-650'}`}>
                      <div className="flex gap-2"><span className="text-cyan-400 font-bold flex-shrink-0">1.</span><p>Klik tombol <span className={`font-semibold ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>Lapor Gangguan</span> di sebelah kiri.</p></div>
                      <div className="flex gap-2"><span className="text-cyan-400 font-bold flex-shrink-0">2.</span><p>Isi formulir: nama, lokasi kejadian, dan deskripsi masalah koneksi.</p></div>
                      <div className="flex gap-2"><span className="text-cyan-400 font-bold flex-shrink-0">3.</span><p>Laporan dikirim ke tim UPT TI dan ditangani sesuai antrean (<span className={`font-semibold ${isDark ? 'text-indigo-300' : 'text-indigo-650'}`}>sistem tiket</span>).</p></div>
                      <div className="flex gap-2"><span className="text-cyan-400 font-bold flex-shrink-0">4.</span><p>Pantau status melalui tombol <span className={`font-semibold ${isDark ? 'text-indigo-300' : 'text-indigo-650'}`}>Status Tiket</span>.</p></div>
                    </div>
                    <div className={`mt-3 pt-3 border-t text-[10px] ${isDark ? 'border-white/5 text-zinc-500' : 'border-slate-100 text-slate-450'}`}>Tiket = nomor antrian penanganan</div>
                  </div>
                )}
              </div>
              <button
                onClick={toggleTheme}
                className={`inline-flex items-center justify-center w-9 h-9 rounded-2xl border transition ${
                  isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20' : 'border-slate-300 bg-white/80 text-slate-600 hover:bg-white hover:border-slate-400'
                }`}
                title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => window.location.reload()}
                className={`inline-flex items-center justify-center w-9 h-9 rounded-2xl border transition ${
                  isDark ? 'border-zinc-700 bg-zinc-900/80 text-zinc-200 hover:bg-zinc-800' : 'border-slate-350 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* ── Mobile Floating Bottom Bar ─────────────────────────────── */}
      {isMobile && (
        <div className={`fixed bottom-4 left-4 right-4 z-[800] lg:hidden pub-mobile-safe`}>
          <div className={`rounded-[2rem] shadow-2xl backdrop-blur-xl border flex items-center justify-around py-2 px-1 ${
            isDark
              ? 'bg-slate-950/95 border-white/10 shadow-cyan-950/30'
              : 'bg-white/96 border-black/8 shadow-slate-200/80'
          }`}>
            {/* Peta — tutup semua drawer, kembali ke peta */}
            <button
              onClick={() => {
                setLeftExpanded(false);
                setRightExpanded(false);
                setSelectedId(null);
              }}
              className={`flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all ${
                !leftExpanded && !rightExpanded
                  ? isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
                  : isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Globe className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Peta</span>
            </button>
            {/* Cari — tutup drawer detail dulu */}
            <button
              onClick={() => {
                setRightExpanded(false);
                setLeftExpanded(true);
              }}
              className={`flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all ${
                leftExpanded && !rightExpanded
                  ? isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
                  : isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Search className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Cari</span>
            </button>
            {/* Tiket — status board */}
            <button
              onClick={() => (window.location.href = '/status-board')}
              className={`flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all ${
                isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-500 hover:text-indigo-600'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Tiket</span>
            </button>
            {/* Lapor */}
            <button
              onClick={() => (window.location.href = '/report')}
              className={`relative flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all ${
                isDark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-500 hover:text-rose-600'
              }`}
            >
              <span className="absolute top-1.5 right-3.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Lapor</span>
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto px-4 py-4 md:px-6 md:py-8 relative z-0 pb-28 lg:pb-8">
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <aside
            className={`rounded-[2rem] border transition-all duration-300 hidden lg:block ${leftExpanded ? "w-80 lg:w-80" : "w-16"} ${
              isDark 
                ? "border-white/10 bg-slate-950/90 shadow-2xl shadow-cyan-500/10" 
                : "border-black/8 bg-white/92 shadow-xl shadow-slate-200/50"
            }`}
          >
            <div className={`flex items-center ${leftExpanded ? 'justify-between' : 'justify-center'} gap-3 border-b p-4 ${isDark ? 'border-white/10' : 'border-black/8'}`}>
              {leftExpanded ? (
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-cyan-500/10 p-2 text-cyan-300">
                    <Wifi className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-xs uppercase tracking-[0.24em] ${isDark ? 'text-cyan-300/80' : 'text-cyan-600'}`}>
                      Panel Informasi
                    </p>
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      Ringkasan Jaringan
                    </p>
                  </div>
                </div>
              ) : null}
              <button
                onClick={() => setLeftExpanded((prev) => !prev)}
                className={`rounded-full border p-2 transition ${isDark ? 'border-white/10 bg-zinc-900/80 text-zinc-300 hover:text-white' : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'}`}
              >
                {leftExpanded ? (
                  <ChevronLeft className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            </div>
            {leftExpanded ? (
              <div className="space-y-5 p-4">
                {/* Support Card */}
                <div className={`relative overflow-hidden rounded-3xl border p-4 shadow-lg transition-all duration-300 ${
                  isDark 
                    ? 'border-rose-500/25 bg-gradient-to-b from-rose-500/10 via-slate-950 to-slate-950 shadow-rose-950/10' 
                    : 'border-rose-200 bg-gradient-to-b from-rose-50/50 via-rose-100/30 to-rose-200/20 shadow-rose-100/50'
                }`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                    <h3 className={`text-xs font-bold uppercase tracking-[0.1em] ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>Ada Kendala Jaringan?</h3>
                  </div>
                  <p className={`text-[11px] mt-2 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-650'}`}>
                    Jika koneksi Wi-Fi atau internet di kampus terganggu, segera laporkan ke admin.
                  </p>
                  <div className="mt-3.5 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => (window.location.href = "/report")}
                      className="flex items-center justify-center gap-1 rounded-xl bg-rose-500 hover:bg-rose-600 px-2.5 py-2 text-xs font-bold text-white transition-all shadow-md shadow-rose-500/10 hover:scale-[1.03] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Lapor
                    </button>
                    <button
                      onClick={() => (window.location.href = "/status-board")}
                      className={`flex items-center justify-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-bold transition-all hover:scale-[1.03] cursor-pointer ${
                        isDark 
                          ? 'border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300' 
                          : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Status
                    </button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        Cari Area
                      </p>
                      <p className="text-xs text-zinc-500">
                        Temukan gedung atau AP.
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${isDark ? 'bg-cyan-500/10 text-cyan-200' : 'bg-cyan-100 text-cyan-800 font-bold'}`}>
                      {filteredBuildings.length}
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Cari gedung atau ruang..."
                      className={`w-full rounded-3xl border py-3 pl-12 pr-4 text-sm outline-none transition ${
                        isDark 
                          ? 'border-zinc-800 bg-slate-950/90 text-zinc-100 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20' 
                          : 'border-slate-200 bg-white text-slate-800 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10'
                      }`}
                    />
                  </div>
                </div>
                <div className="space-y-3 max-h-[44vh] overflow-y-auto pr-1 custom-scrollbar">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className={`w-full rounded-3xl border p-4 animate-pulse ${isDark ? 'border-white/5 bg-zinc-900/40' : 'border-slate-100 bg-slate-50/50'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-2 flex-1">
                            <div className={`h-4 rounded w-3/4 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}></div>
                            <div className={`h-3 rounded w-1/2 ${isDark ? 'bg-zinc-850' : 'bg-slate-100'}`}></div>
                          </div>
                          <div className={`h-6 w-16 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      {filteredBuildings.map((building) => (
                        <button
                          key={building.id}
                          onClick={() => setSelectedId(building.id)}
                          className={`w-full rounded-3xl border p-3 text-left transition duration-200 ${
                            selectedId === building.id 
                              ? isDark ? "border-cyan-400/40 bg-cyan-500/10" : "border-cyan-400 bg-cyan-50" 
                              : isDark ? "border-white/5 bg-zinc-900/70 hover:border-white/10 hover:bg-zinc-900/90" : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                {sanitizePublicName(building.name)}
                              </p>
                              <p className="text-xs text-zinc-500 mt-1">
                                {building.density ?? 0}% •{" "}
                                {building.user_count ?? 0} pengguna
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-1 text-[11px] font-semibold whitespace-nowrap ${getDensityBadgeClass(building)}`}
                            >
                              {getDensityStatusText(building)}
                            </span>
                          </div>
                        </button>
                      ))}
                      {filteredBuildings.length === 0 && (
                        <p className="text-sm text-zinc-500">
                          Tidak ditemukan area pada pencarian.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </aside>

          <section className="space-y-4 md:space-y-5 order-first lg:order-none">
            <div className={`rounded-[2rem] border p-4 md:p-6 backdrop-blur-xl transition-all duration-300 ${
              isDark 
                ? 'border-white/10 bg-slate-950/90 shadow-2xl shadow-cyan-500/10' 
                : 'border-black/8 bg-white/92 shadow-xl shadow-slate-200/50'
            }`}>
              <div className="grid gap-3 md:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className={`rounded-3xl border p-3 md:p-5 animate-pulse ${isDark ? 'border-zinc-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50/50'} ${i === 4 ? 'col-span-2 sm:col-span-1' : ''}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className={`h-3 rounded w-16 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}></div>
                        <div className={`w-4 h-4 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}></div>
                      </div>
                      <div className={`h-7 rounded w-10 mt-3 ${isDark ? 'bg-zinc-800' : 'bg-slate-250'}`}></div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className={`rounded-3xl border p-3 md:p-5 transition-colors ${isDark ? 'border-zinc-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50/50'}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-slate-500'} line-clamp-1`}>
                          Online
                        </p>
                        <Activity className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      </div>
                      <p className={`mt-2 md:mt-3 text-2xl md:text-3xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>
                        {status?.network?.online ?? "-"}
                      </p>
                    </div>
                    <div className={`rounded-3xl border p-3 md:p-5 transition-colors ${isDark ? 'border-zinc-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50/50'}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-slate-500'} line-clamp-1`}>
                          Offline
                        </p>
                        <AlertTriangle className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                      </div>
                      <p className={`mt-2 md:mt-3 text-2xl md:text-3xl font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
                        {status?.network?.offline ?? "-"}
                      </p>
                    </div>
                    <div className={`rounded-3xl border p-3 md:p-5 transition-colors ${isDark ? 'border-zinc-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50/50'}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-slate-500'} line-clamp-1`}>
                          Gedung
                        </p>
                        <Building2 className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                      </div>
                      <p className={`mt-2 md:mt-3 text-2xl md:text-3xl font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>
                        {buildings.length}
                      </p>
                    </div>
                    <div className={`rounded-3xl border p-3 md:p-5 transition-colors ${isDark ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/40'}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-cyan-400' : 'text-cyan-750'} line-clamp-1`}>
                          Pengguna
                        </p>
                        <Users className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-cyan-650'}`} />
                      </div>
                      <p className={`mt-2 md:mt-3 text-2xl md:text-3xl font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>
                        {totalCurrent}
                      </p>
                    </div>
                    <div className={`rounded-3xl border p-3 md:p-5 col-span-2 sm:col-span-1 transition-colors ${isDark ? 'border-zinc-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50/50'}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-slate-500'} line-clamp-1`}>
                          Perangkat
                        </p>
                        <Cpu className={`w-4 h-4 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
                      </div>
                      <p className={`mt-2 md:mt-3 text-2xl md:text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {totalDevices}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Map container — isolation prevents Leaflet z-index from bleeding outside */}
            <div className={`rounded-[2rem] border overflow-hidden transition-all duration-300 ${
              isDark 
                ? 'border-white/10 bg-slate-950/90 shadow-2xl shadow-cyan-500/10' 
                : 'border-black/8 bg-white shadow-xl shadow-slate-200/50'
            }`} style={{isolation: 'isolate'}}>
              <div className="h-[42vh] min-h-[280px] md:h-[58vh] md:min-h-[440px] relative">
                {mapLoading ? (
                  <div className={`w-full h-full flex flex-col items-center justify-center animate-pulse ${isDark ? 'bg-slate-950/80' : 'bg-slate-50'}`}>
                    <div className={`w-10 h-10 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin mb-4`}></div>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Memuat Peta...</p>
                  </div>
                ) : (
                  <MapContainer
                    center={[-7.2908, 112.779]}
                    zoom={17.8}
                    minZoom={16.8}
                    maxZoom={19.5}
                    maxBounds={CAMPUS_BOUNDS}
                    maxBoundsViscosity={0.9}
                    scrollWheelZoom={true}
                    touchZoom={true}
                    doubleClickZoom={true}
                    zoomControl={false}
                    keyboard={true}
                    boxZoom={true}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <MapUpdater selectedBuilding={selectedBuilding} />
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      maxNativeZoom={19}
                      maxZoom={20}
                    />
                    {filteredBuildings.map((building) => (
                      <Marker
                        key={building.id}
                        icon={getWifiIcon(building)}
                        position={[building.lat, building.lng]}
                        eventHandlers={{
                          click: () => setSelectedId(building.id),
                        }}
                      />
                    ))}
                  </MapContainer>
                )}
              </div>
            </div>
          </section>

          <aside
            className={`rounded-[2rem] border transition-all duration-300 hidden lg:block ${rightExpanded ? "w-96 lg:w-96" : "w-16"} ${
              isDark 
                ? "border-white/10 bg-slate-950/90 shadow-2xl shadow-cyan-500/10" 
                : "border-black/8 bg-white/92 shadow-xl shadow-slate-200/50"
            }`}
          >
            <div className={`flex items-center ${rightExpanded ? 'justify-between' : 'justify-center'} gap-3 border-b p-4 ${isDark ? 'border-white/10' : 'border-black/8'}`}>
              {rightExpanded ? (
                <div>
                  <p className={`text-xs uppercase tracking-[0.24em] ${isDark ? 'text-cyan-300/80' : 'text-cyan-600'}`}>
                    Detail Klik
                  </p>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    Informasi Area
                  </p>
                </div>
              ) : null}
              <button
                onClick={() => setRightExpanded((prev) => !prev)}
                className={`rounded-full border p-2 transition ${isDark ? 'border-white/10 bg-zinc-900/80 text-zinc-300 hover:text-white' : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'}`}
              >
                {rightExpanded ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            </div>
            {rightExpanded ? (
              <div className="p-4 space-y-5">
                {selectedBuilding ? (
                  <div className="space-y-5">
                    <button
                      onClick={() => setSelectedId(null)}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer pb-2 ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-700 hover:text-cyan-850'}`}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Kembali ke Ringkasan Jaringan
                    </button>
                    <div className={`rounded-3xl border p-4 ${isDark ? 'border-zinc-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/50'}`}>
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Lokasi
                      </p>
                      <p className={`mt-2 text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {sanitizePublicName(selectedBuilding.name)}
                      </p>
                      <p
                        className={`mt-1 text-xs uppercase tracking-[0.2em] ${getStatusLabelClass(selectedBuilding)}`}
                      >
                        {selectedBuilding.online ? "Online" : "Offline"}
                      </p>
                    </div>
                    <div className="grid gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          {/* Pengguna WiFi — klikable */}
                          <button
                            onClick={() => setShowUserDetail((v) => !v)}
                            className={`rounded-3xl border text-left transition active:scale-[0.97] p-4 ${
                              isDark 
                                ? 'border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10' 
                                : 'border-cyan-200 bg-cyan-50/40 hover:bg-cyan-100/50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Users className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                                <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-cyan-400' : 'text-cyan-750'}`}>Pengguna WiFi</p>
                              </div>
                              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isDark ? 'text-cyan-400' : 'text-cyan-650'} ${showUserDetail ? "rotate-90" : ""}`} />
                            </div>
                            <p className={`mt-1 text-3xl font-bold ${isDark ? 'text-white' : 'text-cyan-950'}`}>
                              {selectedBuilding.user_count ?? 0}
                            </p>
                            <p className={`text-[10px] mt-1 ${isDark ? 'text-cyan-300/60' : 'text-cyan-600/80'}`}>Klik untuk detail</p>
                          </button>
                          {/* Perangkat — klikable */}
                          <button
                            onClick={() => setShowDeviceDetail((v) => !v)}
                            className={`rounded-3xl border text-left transition active:scale-[0.97] p-4 ${
                              isDark 
                                ? 'border-zinc-800 bg-slate-900/80 hover:bg-slate-800/80' 
                                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Building2 className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
                                <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>Perangkat</p>
                              </div>
                              <ChevronRight className={`w-3.5 h-3.5 text-zinc-550 transition-transform ${showDeviceDetail ? "rotate-90" : ""}`} />
                            </div>
                            <p className={`mt-1 text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{selectedBuilding.device_count ?? 0}</p>
                            <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>Klik untuk detail</p>
                          </button>
                        </div>

                        {/* Panel detail pengguna WiFi */}
                        {showUserDetail && (
                          <div className={`rounded-3xl border p-4 ${isDark ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/40'}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <Users className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                              <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-cyan-400' : 'text-cyan-750'}`}>Jenis Perangkat Pengguna</p>
                            </div>
                            {selectedBuilding.user_breakdown && selectedBuilding.user_breakdown.length > 0 ? (
                              <div className="space-y-2">
                                {selectedBuilding.user_breakdown.map((item) => (
                                  <div key={item.label} className={`flex items-center justify-between py-1 border-b last:border-0 ${isDark ? 'border-cyan-500/10' : 'border-cyan-200/50'}`}>
                                    <span className={`text-xs ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{item.label}</span>
                                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isDark ? 'text-cyan-200 bg-cyan-500/10' : 'text-cyan-800 bg-cyan-100/60'}`}>{item.count} perangkat</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-500">Informasi perangkat tidak tersedia saat ini.</p>
                            )}
                            <p className={`text-[10px] mt-3 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>Data anonim — tidak mencantumkan identitas pengguna</p>
                          </div>
                        )}

                        {/* Panel detail perangkat kampus */}
                        {showDeviceDetail && (
                          <div className={`rounded-3xl border p-4 ${isDark ? 'border-zinc-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/50'}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <Cpu className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-400' : 'text-slate-555'}`} />
                              <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-slate-555'}`}>Detail Perangkat Kampus</p>
                            </div>
                            {selectedBuilding.device_names && selectedBuilding.device_names.length > 0 ? (
                              <div className="space-y-2">
                                {selectedBuilding.device_names.map((name, index) => (
                                  <div key={index} className={`flex items-center justify-between py-1 border-b last:border-0 ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                                    <span className={`text-xs font-semibold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{name}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'text-emerald-300 bg-emerald-500/10' : 'text-emerald-800 bg-emerald-100/50'}`}>Online</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-500">Tidak ada perangkat kampus terdeteksi.</p>
                            )}
                          </div>
                        )}
                      {selectedBuilding.online && (selectedBuilding.bandwidth_download || selectedBuilding.bandwidth_upload) && (
                        <div className={`rounded-3xl border p-4 ${isDark ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/40'}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <ArrowDownUp className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                            <p className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-cyan-400' : 'text-cyan-750'}`}>Bandwidth Real-time</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">↓ Download</p>
                              <p className={`text-base font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-850'}`}>{selectedBuilding.bandwidth_download ?? "–"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">↑ Upload</p>
                              <p className={`text-base font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-850'}`}>{selectedBuilding.bandwidth_upload ?? "–"}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Kapasitas Total dihapus — selalu 0 karena tidak dikonfigurasi */}
                    {selectedBuilding.floors &&
                      selectedBuilding.floors.length > 0 && (
                        <div className={`rounded-3xl border p-4 ${isDark ? 'border-zinc-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/50'}`}>
                          <p className={`text-xs uppercase tracking-[0.2em] mb-3 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                            Titik Akses Wi-Fi / Sektor
                          </p>
                          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                            {selectedBuilding.floors.map((floor) => (
                              <div
                                key={floor.level}
                                className={`rounded-2xl p-3 ${isDark ? 'bg-slate-950/80' : 'bg-white border border-slate-100 shadow-sm'}`}
                              >
                                <p className={`text-xs uppercase tracking-[0.2em] font-semibold mb-2 ${isDark ? 'text-cyan-300/80' : 'text-cyan-750'}`}>
                                  {floor.level}
                                </p>
                                <div className="space-y-2">
                                  {floor.areas.map((area, aIdx) => (
                                    <div
                                      key={aIdx}
                                      className={`flex items-center justify-between gap-2 text-xs rounded-lg p-2 ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                          {area.name}
                                        </p>
                                        <p className="text-zinc-500 text-[10px]">
                                          {area.current} pengguna
                                        </p>
                                      </div>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                                          area.online
                                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                        }`}
                                      >
                                        {area.online ? "Online" : "Offline"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 py-20 space-y-4">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center border transition-all duration-300 ${
                      isDark 
                        ? 'bg-zinc-900/80 border-zinc-800 text-cyan-400/80 shadow-[0_0_15px_rgba(34,211,238,0.15)]' 
                        : 'bg-slate-50 border-slate-200 text-cyan-600 shadow-sm'
                    }`}>
                      <Info className="w-8 h-8 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Pilih Area pada Peta</p>
                      <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-500'} leading-relaxed max-w-[240px]`}>
                        Silakan pilih atau klik salah satu marker gedung/area pada peta untuk melihat detail informasi perangkat, kapasitas, dan status jaringan secara real-time.
                      </p>
                    </div>
                  </div>
                )} 
                <div className="text-[10px] text-zinc-600 text-center pt-2 font-mono">
                    Terakhir diperbarui: {lastRefresh.toLocaleTimeString('id-ID')}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </main>
    </div>
  );
}
