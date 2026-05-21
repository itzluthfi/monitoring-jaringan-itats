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
} from "lucide-react";
import "leaflet/dist/leaflet.css";

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
  device_count?: number;
  device_categories?: Array<{ label: string; count: number }>;
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
  const [rightExpanded, setRightExpanded] = useState(window.innerWidth >= 1024);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  const baseUrl = import.meta.env.VITE_API_URL || "";

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setLeftExpanded(true);
        setRightExpanded(true);
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
      if (isMobile) {
        setRightExpanded(false);
      }
      return;
    }
    const found = buildings.find((b) => b.id === selectedId);
    setSelectedBuilding(found || null);
    setRightExpanded(true);
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
    const density = building.density ?? 0;
    if (density >= 90) return "#dc2626";
    if (density >= 70) return "#f59e0b";
    return "#22c55e";
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
    if (!building.online)
      return "bg-rose-500/10 text-rose-300 border border-rose-500/20";
    const density = building.density ?? 0;
    if (density >= 70)
      return "bg-amber-500/10 text-amber-300 border border-amber-500/20";
    return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
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
    <div className="min-h-screen bg-[#08111f] text-zinc-100 font-sans">
      {/* Mobile Search Drawer */}
      {leftExpanded && isMobile && (
        <div className="fixed inset-0 z-[700] flex flex-col bg-slate-950/95 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
            <h2 className="text-lg font-semibold">Cari Area</h2>
            <button
              onClick={() => setLeftExpanded(false)}
              className="rounded-full border border-white/10 bg-zinc-900/80 p-2 text-zinc-300 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari gedung atau ruang..."
                className="w-full rounded-3xl border border-zinc-800 bg-slate-950/90 py-3 pl-12 pr-4 text-sm text-zinc-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
            <div className="space-y-3">
              {filteredBuildings.map((building) => (
                <button
                  key={building.id}
                  onClick={() => {
                    setSelectedId(building.id);
                    setLeftExpanded(false);
                  }}
                  className={`w-full rounded-3xl border p-3 text-left transition duration-200 ${selectedId === building.id ? "border-cyan-400/40 bg-cyan-500/10" : "border-white/5 bg-zinc-900/70 hover:border-white/10 hover:bg-zinc-900/90"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {sanitizePublicName(building.name)}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {building.density ?? 0}% • {building.user_count ?? 0}{" "}
                        pengguna
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getDensityBadgeClass(building)}`}
                    >
                      {building.density ?? 0}%
                    </span>
                  </div>
                </button>
              ))}
              {filteredBuildings.length === 0 && (
                <p className="text-sm text-zinc-500">
                  Tidak ditemukan area pada pencarian.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Detail Drawer */}
      {rightExpanded && isMobile && selectedBuilding && (
        <div className="fixed inset-0 z-[700] flex flex-col bg-slate-950/95 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
            <h2 className="text-lg font-semibold">Detail Area</h2>
            <button
              onClick={() => setRightExpanded(false)}
              className="rounded-full border border-white/10 bg-zinc-900/80 p-2 text-zinc-300 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 p-4">
            <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Lokasi
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
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
                <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Pengguna WiFi</p>
                  </div>
                  <p className="mt-1 text-3xl font-bold text-white">{selectedBuilding.user_count ?? 0}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">mahasiswa &amp; tamu</p>
                </div>
                <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Perangkat</p>
                  </div>
                  <p className="mt-1 text-3xl font-bold text-white">{selectedBuilding.device_count ?? 0}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">milik kampus</p>
                </div>
              </div>
              <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Keramaian</p>
                <div className="flex items-center gap-3 mt-3">
                  <p className={`text-2xl font-bold ${
                    (selectedBuilding.density ?? 0) >= 90 ? "text-rose-300" :
                    (selectedBuilding.density ?? 0) >= 70 ? "text-amber-300" : "text-emerald-300"
                  }`}>{selectedBuilding.density ?? 0}%</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    (selectedBuilding.density ?? 0) >= 90 ? "bg-rose-500/20 text-rose-300" :
                    (selectedBuilding.density ?? 0) >= 70 ? "bg-amber-500/20 text-amber-300" :
                    "bg-emerald-500/20 text-emerald-300"
                  }`}>{getDensityLabel(selectedBuilding)}</span>
                </div>
              </div>
              {selectedBuilding.device_categories && selectedBuilding.device_categories.length > 0 && (
                <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Detail Perangkat Kampus</p>
                  </div>
                  <div className="space-y-2">
                    {selectedBuilding.device_categories.map((cat) => (
                      <div key={cat.label} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                        <span className="text-xs text-zinc-300">{cat.label}</span>
                        <span className="text-xs font-bold text-white bg-zinc-700/60 px-2.5 py-0.5 rounded-full">{cat.count} unit</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedBuilding.online && (selectedBuilding.bandwidth_download || selectedBuilding.bandwidth_upload) && (
                <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownUp className="w-3.5 h-3.5 text-cyan-400" />
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Bandwidth</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-zinc-500">↓ Download</p>
                      <p className="text-sm font-bold text-white mt-0.5">{selectedBuilding.bandwidth_download ?? "–"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500">↑ Upload</p>
                      <p className="text-sm font-bold text-white mt-0.5">{selectedBuilding.bandwidth_upload ?? "–"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-[500] border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto px-4 md:px-6 py-4 flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70 font-semibold">
                ITATS Student Portal
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Live Campus Map
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3 items-center">
            {isMobile && (
              <>
                <button
                  onClick={() => setLeftExpanded(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 md:hidden"
                >
                  <Search className="w-4 h-4" />
                  Cari
                </button>
                {selectedBuilding && (
                  <button
                    onClick={() => setRightExpanded(true)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 md:hidden"
                  >
                    <MapPin className="w-4 h-4" />
                    Detail
                  </button>
                )}
              </>
            )}
            {/* Info tooltip tentang cara lapor */}
            <div className="relative">
              <button
                onClick={() => (window.location.href = "/report")}
                className="relative inline-flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 md:px-4 py-2 text-sm font-semibold text-rose-300 transition-all duration-200 hover:bg-rose-500/20 hover:scale-[1.02] cursor-pointer shadow-lg shadow-rose-950/20"
              >
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <Plus className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Lapor Gangguan</span>
                <span className="sm:hidden">Lapor</span>
              </button>
              <button
                onClick={() => setShowInfoTooltip((v) => !v)}
                className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full border border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:text-cyan-300 hover:border-cyan-500/40 transition"
                title="Cara melaporkan gangguan"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {showInfoTooltip && (
                <div className="absolute top-12 right-0 z-[600] w-72 rounded-2xl border border-cyan-500/20 bg-slate-950 shadow-2xl shadow-cyan-950/30 p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <p className="text-sm font-bold text-white">Cara Lapor Gangguan</p>
                    </div>
                    <button onClick={() => setShowInfoTooltip(false)} className="text-zinc-500 hover:text-white transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2 text-xs text-zinc-400 leading-relaxed">
                    <div className="flex gap-2">
                      <span className="text-cyan-400 font-bold flex-shrink-0">1.</span>
                      <p>Klik tombol <span className="text-rose-300 font-semibold">Lapor Gangguan</span> di sebelah kiri.</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-cyan-400 font-bold flex-shrink-0">2.</span>
                      <p>Isi formulir: nama, lokasi kejadian, dan deskripsi masalah koneksi.</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-cyan-400 font-bold flex-shrink-0">3.</span>
                      <p>Laporan dikirim ke tim UPT TI dan akan ditangani sesuai antrean (<span className="text-indigo-300 font-semibold">sistem tiket</span>).</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-cyan-400 font-bold flex-shrink-0">4.</span>
                      <p>Pantau status laporan kamu melalui tombol <span className="text-indigo-300 font-semibold">Status Tiket</span>.</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-zinc-500">
                    Tiket = nomor antrian penanganan — bukan yang lain 😊
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => (window.location.href = "/status-board")}
              className="inline-flex items-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-3 md:px-4 py-2 text-sm font-semibold text-indigo-300 transition-all duration-200 hover:bg-indigo-500/20 hover:scale-[1.02] cursor-pointer shadow-lg shadow-indigo-950/20"
            >
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Status Tiket</span>
              <span className="sm:hidden">Tiket</span>
            </button>
            <button
              onClick={() => (window.location.href = "/login")}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 md:px-4 py-2 text-sm font-semibold text-cyan-200 transition-all duration-200 hover:bg-cyan-500/20 hover:scale-[1.02] cursor-pointer shadow-lg shadow-cyan-950/20"
            >
              <Shield className="w-4 h-4 text-cyan-400" />
              Admin
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/80 px-3 md:px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 hover:scale-[1.02] duration-200 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-4 md:px-6 md:py-8 relative z-0">
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <aside
            className={`rounded-[2rem] border border-white/10 bg-slate-950/90 shadow-2xl shadow-cyan-500/10 transition-all duration-300 hidden lg:block ${leftExpanded ? "w-80 lg:w-80" : "w-16"}`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/10 p-2 text-cyan-300">
                  <Wifi className="w-4 h-4" />
                </div>
                {leftExpanded ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">
                      Panel Informasi
                    </p>
                    <p className="text-sm font-semibold text-white">
                      Ringkasan Jaringan
                    </p>
                  </div>
                ) : null}
              </div>
              <button
                onClick={() => setLeftExpanded((prev) => !prev)}
                className="rounded-full border border-white/10 bg-zinc-900/80 p-2 text-zinc-300 hover:text-white transition"
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
                <div className="relative overflow-hidden rounded-3xl border border-rose-500/25 bg-gradient-to-b from-rose-500/10 via-slate-950 to-slate-950 p-4 shadow-lg shadow-rose-950/10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-rose-300">Ada Kendala Jaringan?</h3>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
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
                      className="flex items-center justify-center gap-1 rounded-xl border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-2 text-xs font-bold text-indigo-300 transition-all hover:scale-[1.03] cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Status
                    </button>
                  </div>
                </div>
                {/* Stats: Total Pengguna WiFi + Perangkat Kampus */}
                <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Total Pengguna WiFi</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{totalCurrent}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">seluruh area kampus</p>
                </div>
                <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Perangkat Kampus</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{totalDevices}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">seluruh area kampus</p>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Cari Area
                      </p>
                      <p className="text-xs text-zinc-500">
                        Temukan gedung atau AP.
                      </p>
                    </div>
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200">
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
                      className="w-full rounded-3xl border border-zinc-800 bg-slate-950/90 py-3 pl-12 pr-4 text-sm text-zinc-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                </div>
                <div className="space-y-3 max-h-[44vh] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredBuildings.map((building) => (
                    <button
                      key={building.id}
                      onClick={() => setSelectedId(building.id)}
                      className={`w-full rounded-3xl border p-3 text-left transition duration-200 ${selectedId === building.id ? "border-cyan-400/40 bg-cyan-500/10" : "border-white/5 bg-zinc-900/70 hover:border-white/10 hover:bg-zinc-900/90"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {sanitizePublicName(building.name)}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {building.density ?? 0}% •{" "}
                            {building.user_count ?? 0} pengguna
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getDensityBadgeClass(building)}`}
                        >
                          {building.density ?? 0}%
                        </span>
                      </div>
                    </button>
                  ))}
                  {filteredBuildings.length === 0 && (
                    <p className="text-sm text-zinc-500">
                      Tidak ditemukan area pada pencarian.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </aside>

          <section className="space-y-4 md:space-y-5 order-first lg:order-none">
            <div className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-4 md:p-6 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl">
              <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3">
                <div className="rounded-3xl border border-zinc-800 bg-slate-900/90 p-3 md:p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 line-clamp-1">
                    Online
                  </p>
                  <p className="mt-2 md:mt-3 text-2xl md:text-3xl font-bold text-emerald-300">
                    {status?.network?.online ?? "-"}
                  </p>
                </div>
                <div className="rounded-3xl border border-zinc-800 bg-slate-900/90 p-3 md:p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 line-clamp-1">
                    Offline
                  </p>
                  <p className="mt-2 md:mt-3 text-2xl md:text-3xl font-bold text-amber-300">
                    {status?.network?.offline ?? "-"}
                  </p>
                </div>
                <div className="rounded-3xl border border-zinc-800 bg-slate-900/90 p-3 md:p-5 col-span-2 md:col-span-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 line-clamp-1">
                    Gedung
                  </p>
                  <p className="mt-2 md:mt-3 text-2xl md:text-3xl font-bold text-cyan-300">
                    {buildings.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Map container — isolation prevents Leaflet z-index from bleeding outside */}
            <div className="rounded-[2rem] border border-white/10 bg-slate-950/90 overflow-hidden shadow-2xl shadow-cyan-500/10" style={{isolation: 'isolate'}}>
              <div className="h-[42vh] min-h-[280px] md:h-[58vh] md:min-h-[440px] relative">
                {mapLoading ? (
                  <div className="flex h-full items-center justify-center bg-slate-950 text-zinc-400">
                    Memuat peta...
                  </div>
                ) : (
                  <MapContainer
                    center={[-7.2908, 112.779]}
                    zoom={17}
                    minZoom={17}
                    maxZoom={20}
                    maxBounds={CAMPUS_BOUNDS}
                    maxBoundsViscosity={1.0}
                    scrollWheelZoom={true}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <MapUpdater selectedBuilding={selectedBuilding} />
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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

            {/* Mobile status & info sections */}
            {isMobile && (
              <div className="space-y-4">
                {/* Status banner */}
                <div className={`rounded-[2rem] border p-4 transition-all duration-300 ${
                  isAllGood
                    ? "bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-950/10"
                    : hasIssues
                    ? "bg-rose-500/5 border-rose-500/20 shadow-lg shadow-rose-950/10"
                    : "bg-zinc-900/50 border-zinc-800"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border flex-shrink-0 ${
                      isAllGood ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                      hasIssues ? "bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse" :
                      "bg-zinc-800 border-zinc-700 text-zinc-400"
                    }`}>
                      {isAllGood ? (
                        <CheckCircle className="w-4.5 h-4.5" />
                      ) : hasIssues ? (
                        <AlertTriangle className="w-4.5 h-4.5" />
                      ) : (
                        <Activity className="w-4.5 h-4.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${
                        isAllGood ? "text-emerald-400" : hasIssues ? "text-rose-400" : "text-zinc-400"
                      }`}>
                        {isAllGood ? "Jaringan Normal" : hasIssues ? "Gangguan Terdeteksi" : "Memuat Status..."}
                      </h4>
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5 font-medium">
                        {isAllGood
                          ? "Semua perangkat jaringan beroperasi penuh."
                          : hasIssues
                          ? `${status?.network?.offline} perangkat offline saat ini.`
                          : "Menghubungkan ke server..."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Log Gangguan */}
                <div className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-5 shadow-2xl">
                  <div className="flex items-center gap-2 pb-3 border-b border-white/5 mb-3">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Log Gangguan Terkini</h4>
                  </div>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                    {status && status.recentIssues && status.recentIssues.length > 0 ? (
                      status.recentIssues.map((issue, idx) => (
                        <div key={idx} className="p-3 rounded-2xl bg-zinc-900/50 border border-white/5 flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                              issue.type === 'critical' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {issue.type === 'critical' ? 'Gangguan' : 'Info'}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {new Date(issue.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-zinc-200">{issue.title}</p>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-xs text-zinc-500">
                        Tidak ada laporan gangguan aktif.
                      </div>
                    )}
                  </div>
                </div>

                {/* Panduan Bantuan */}
                <div className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-5 shadow-2xl text-xs space-y-3">
                  <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Panduan & Kontak</h4>
                  </div>
                  <div className="space-y-3 text-zinc-400 leading-relaxed">
                    <p>
                      <span className="inline-flex items-center gap-1 text-zinc-200 font-semibold"><MapPin className="w-3 h-3 text-cyan-400" /> Peta Interaktif:</span>{" "}
                      Tekan marker Wi-Fi pada peta untuk melihat detail kapasitas dan access point di setiap gedung secara real-time.
                    </p>
                    <p>
                      <span className="inline-flex items-center gap-1 text-zinc-200 font-semibold"><Users className="w-3 h-3 text-emerald-400" /> Status Keramaian:</span>{" "}
                      Warna marker menunjukkan tingkat keramaian pengguna (Hijau: Ringan, Kuning: Sedang/Ramai, Merah: Sangat Ramai, Abu-abu: Offline).
                    </p>
                    <p>
                      <span className="inline-flex items-center gap-1 text-zinc-200 font-semibold"><MessageSquare className="w-3 h-3 text-indigo-400" /> Pusat Bantuan UPT TI:</span>{" "}
                      Mengalami kendala koneksi? Hubungi UPT TI ITATS di Gedung Rektorat Lt. 2 atau buat laporan melalui tombol <strong>Lapor Gangguan</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside
            className={`rounded-[2rem] border border-white/10 bg-slate-950/90 shadow-2xl shadow-cyan-500/10 transition-all duration-300 hidden lg:block ${rightExpanded ? "w-96 lg:w-96" : "w-16"}`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
              {rightExpanded ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">
                    Detail Klik
                  </p>
                  <p className="text-sm font-semibold text-white">
                    Informasi Area
                  </p>
                </div>
              ) : null}
              <button
                onClick={() => setRightExpanded((prev) => !prev)}
                className="rounded-full border border-white/10 bg-zinc-900/80 p-2 text-zinc-300 hover:text-white transition"
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
                      className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition cursor-pointer pb-2"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Kembali ke Ringkasan Jaringan
                    </button>
                    <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Lokasi
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
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
                        <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-3.5 h-3.5 text-cyan-400" />
                            <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Pengguna WiFi</p>
                          </div>
                          <p className="mt-1 text-3xl font-bold text-white">
                            {selectedBuilding.user_count ?? 0}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-1">mahasiswa &amp; tamu</p>
                        </div>
                        <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Perangkat</p>
                          </div>
                          <p className="mt-1 text-3xl font-bold text-white">{selectedBuilding.device_count ?? 0}</p>
                          <p className="text-[10px] text-zinc-500 mt-1">milik kampus</p>
                        </div>
                      </div>
                      <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Keramaian</p>
                        <div className="flex items-center gap-3 mt-3">
                          <p className={`text-2xl font-bold ${
                            (selectedBuilding.density ?? 0) >= 70 ? "text-amber-300" :
                            (selectedBuilding.density ?? 0) >= 90 ? "text-rose-300" : "text-emerald-300"
                          }`}>
                            {selectedBuilding.density ?? 0}%
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            (selectedBuilding.density ?? 0) >= 90 ? "bg-rose-500/20 text-rose-300" :
                            (selectedBuilding.density ?? 0) >= 70 ? "bg-amber-500/20 text-amber-300" :
                            "bg-emerald-500/20 text-emerald-300"
                          }`}>{getDensityLabel(selectedBuilding)}</span>
                        </div>
                      </div>
                      {selectedBuilding.device_categories && selectedBuilding.device_categories.length > 0 && (
                        <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Detail Perangkat Kampus</p>
                          </div>
                          <div className="space-y-2">
                            {selectedBuilding.device_categories.map((cat) => (
                              <div key={cat.label} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                                <span className="text-xs text-zinc-300">{cat.label}</span>
                                <span className="text-xs font-bold text-white bg-zinc-700/60 px-2.5 py-0.5 rounded-full">{cat.count} unit</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedBuilding.online && (selectedBuilding.bandwidth_download || selectedBuilding.bandwidth_upload) && (
                        <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <ArrowDownUp className="w-3.5 h-3.5 text-cyan-400" />
                            <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Bandwidth Real-time</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">↓ Download</p>
                              <p className="text-base font-bold text-white mt-1">{selectedBuilding.bandwidth_download ?? "–"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">↑ Upload</p>
                              <p className="text-base font-bold text-white mt-1">{selectedBuilding.bandwidth_upload ?? "–"}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Kapasitas Total dihapus — selalu 0 karena tidak dikonfigurasi */}
                    {selectedBuilding.floors &&
                      selectedBuilding.floors.length > 0 && (
                        <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">
                            Titik Akses Wi-Fi / Sektor
                          </p>
                          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                            {selectedBuilding.floors.map((floor) => (
                              <div
                                key={floor.level}
                                className="rounded-2xl bg-slate-950/80 p-3"
                              >
                                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 font-semibold mb-2">
                                  {floor.level}
                                </p>
                                <div className="space-y-2">
                                  {floor.areas.map((area, aIdx) => (
                                    <div
                                      key={aIdx}
                                      className="flex items-center justify-between gap-2 text-xs bg-slate-900/50 rounded-lg p-2"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-white truncate">
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
                  <div className="space-y-4">
                    {/* Status Banner */}
                    <div className={`rounded-3xl border p-4 transition-all duration-300 ${
                      isAllGood
                        ? "bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-950/10"
                        : hasIssues
                        ? "bg-rose-500/5 border-rose-500/20 shadow-lg shadow-rose-950/10"
                        : "bg-zinc-900/50 border-zinc-800"
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border flex-shrink-0 ${
                          isAllGood ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                          hasIssues ? "bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse" :
                          "bg-zinc-800 border-zinc-700 text-zinc-400"
                        }`}>
                          {isAllGood ? (
                            <CheckCircle className="w-4.5 h-4.5" />
                          ) : hasIssues ? (
                            <AlertTriangle className="w-4.5 h-4.5" />
                          ) : (
                            <Activity className="w-4.5 h-4.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-xs font-bold uppercase tracking-wider ${
                            isAllGood ? "text-emerald-400" : hasIssues ? "text-rose-400" : "text-zinc-400"
                          }`}>
                            {isAllGood
                              ? "Jaringan Normal"
                              : hasIssues
                              ? "Gangguan Terdeteksi"
                              : "Memuat Status..."}
                          </h4>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5 font-medium">
                            {isAllGood
                              ? "Semua perangkat beroperasi penuh."
                              : hasIssues
                              ? `${status?.network?.offline} perangkat offline saat ini.`
                              : "Menghubungkan ke server..."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Riwayat Gangguan Terkini */}
                    <div className="rounded-3xl border border-zinc-800 bg-slate-900/50 p-4 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Log Gangguan Terkini</h4>
                      </div>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                        {status && status.recentIssues && status.recentIssues.length > 0 ? (
                          status.recentIssues.map((issue, idx) => (
                            <div key={idx} className="p-2.5 rounded-2xl bg-zinc-950/60 border border-white/5 flex flex-col gap-1 transition-all duration-200 hover:border-zinc-800">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                  issue.type === 'critical' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  {issue.type === 'critical' ? 'Gangguan' : 'Info'}
                                </span>
                                <span className="text-[9px] text-zinc-500 font-mono flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(issue.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-zinc-200 line-clamp-1">{issue.title}</p>
                            </div>
                          ))
                        ) : (
                          <div className="py-6 text-center text-[11px] text-zinc-500">
                            Tidak ada laporan gangguan aktif.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Panduan Peta & Bantuan */}
                    <div className="rounded-3xl border border-zinc-800 bg-slate-900/50 p-4 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Panduan & Bantuan</h4>
                      </div>
                      <div className="space-y-2 text-[11px] text-zinc-400 leading-relaxed">
                        <p>
                          📍 <strong className="text-zinc-200">Peta Interaktif:</strong> Klik marker Wi-Fi pada peta untuk melihat detail kapasitas dan access point di setiap gedung secara real-time.
                        </p>
                        <p>
                          🏢 <strong className="text-zinc-200">Status Keramaian:</strong> Warna marker menunjukkan tingkat keramaian pengguna (Hijau: Ringan, Kuning: Sedang/Ramai, Merah: Sangat Ramai, Abu-abu: Offline).
                        </p>
                        <p>
                          📞 <strong className="text-zinc-200">Pusat Bantuan UPT TI:</strong> Mengalami kendala koneksi? Hubungi UPT TI ITATS di Gedung Rektorat Lt. 2 atau buat laporan melalui tombol <strong>Lapor Gangguan</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="text-[10px] text-zinc-600 text-center pt-2 font-mono">
                      Terakhir diperbarui: {lastRefresh.toLocaleTimeString('id-ID')}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </aside>
        </div>
      </main>
    </div>
  );
}
