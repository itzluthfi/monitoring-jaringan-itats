import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
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
  hasWifi: boolean;
  online?: boolean;
  status?: string;
  total_clients?: number;
  total_capacity?: number;
  density?: number;
  load_label?: string;
  floors: Array<{
    level: string;
    rooms: Array<{
      id: string;
      name: string;
      cap: number;
      current: number;
      status?: string;
    }>;
  }>;
}

interface PublicStatus {
  devices: { total: number; online: number; offline: number; unknown: number };
  criticalAlerts: number;
  recentIssues: Array<{
    device_name: string;
    type: string;
    title: string;
    created_at: string;
  }>;
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
  const [leftExpanded, setLeftExpanded] = useState(true);
  const [rightExpanded, setRightExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  const baseUrl = import.meta.env.VITE_API_URL || "";

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
      setRightExpanded(false);
      return;
    }
    const found = buildings.find((b) => b.id === selectedId);
    setSelectedBuilding(found || null);
    setRightExpanded(true);
  }, [selectedId, buildings]);

  const filteredBuildings = buildings.filter(
    (b) =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.floors.some((floor) =>
        floor.rooms.some((room) =>
          room.name.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      ),
  );

  const sortedBuildings = [...filteredBuildings].sort((a, b) => {
    const aDensity = a.density ?? 0;
    const bDensity = b.density ?? 0;
    return (
      bDensity - aDensity || (b.total_clients ?? 0) - (a.total_clients ?? 0)
    );
  });

  const totalCapacity = buildings.reduce(
    (acc, building) =>
      acc +
      building.floors.reduce(
        (fa, floor) => fa + floor.rooms.reduce((ra, room) => ra + room.cap, 0),
        0,
      ),
    0,
  );
  const totalCurrent = buildings.reduce(
    (acc, building) =>
      acc +
      building.floors.reduce(
        (fa, floor) =>
          fa + floor.rooms.reduce((ra, room) => ra + room.current, 0),
        0,
      ),
    0,
  );

  const getDensityColor = (building: PublicMapBuilding) => {
    if (!building.online) return "#9ca3af"; // gray for offline
    const density = building.density ?? 0;
    if (density >= 90) return "#dc2626";
    if (density >= 70) return "#f59e0b";
    return "#22c55e";
  };

  const getDensityLabel = (building: PublicMapBuilding) => {
    if (!building.online) return "Offline";
    return building.load_label || (building.density ?? 0) >= 90
      ? "Sangat Ramai"
      : (building.density ?? 0) >= 70
        ? "Ramai"
        : (building.density ?? 0) >= 40
          ? "Sedang"
          : "Ringan";
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
    const label = building.name || "Wi-Fi";
    const clients = building.total_clients ?? 0;
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

  return (
    <div className="min-h-screen bg-[#08111f] text-zinc-100 font-sans">
      {/* Mobile Search Drawer */}
      {leftExpanded && isMobile && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-xl lg:hidden">
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
                        {building.name}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {building.density ?? 0}% • {building.total_clients ?? 0}{" "}
                        klien
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
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-xl lg:hidden">
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
                {selectedBuilding.name}
              </p>
              <p
                className={`mt-1 text-xs uppercase tracking-[0.2em] ${getStatusLabelClass(selectedBuilding)}`}
              >
                {selectedBuilding.online ? "Online" : "Offline"}
              </p>
            </div>
            <div className="grid gap-3">
              <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Klien Saat Ini
                </p>
                <p className="mt-3 text-3xl font-bold text-white">
                  {selectedBuilding.total_clients ?? 0}
                </p>
              </div>
              <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Kepadatan
                </p>
                <p className="mt-3 text-3xl font-bold text-white">
                  {selectedBuilding.density ?? 0}%
                </p>
                <p className="text-xs text-zinc-500 mt-2">
                  {getDensityLabel(selectedBuilding)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
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
            <button
              onClick={() => (window.location.href = "/login")}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 md:px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
            >
              <Shield className="w-4 h-4" />
              Admin
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/80 px-3 md:px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-4 md:px-6 md:py-8">
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
                <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Status Umum
                  </p>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-3xl bg-zinc-950/90 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                        Online
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-300">
                        {status?.devices.online ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-zinc-950/90 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                        Offline
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-rose-300">
                        {status?.devices.offline ?? "-"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Kapasitas Sekarang
                  </p>
                  <p className="mt-3 text-3xl font-bold text-white">
                    {totalCurrent}/{totalCapacity}
                  </p>
                </div>
                <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Gedung Tercatat
                  </p>
                  <p className="mt-3 text-3xl font-bold text-cyan-300">
                    {buildings.length}
                  </p>
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
                            {building.name}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {building.density ?? 0}% •{" "}
                            {building.total_clients ?? 0} klien
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
                    {status?.devices.online ?? "-"}
                  </p>
                </div>
                <div className="rounded-3xl border border-zinc-800 bg-slate-900/90 p-3 md:p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 line-clamp-1">
                    Offline
                  </p>
                  <p className="mt-2 md:mt-3 text-2xl md:text-3xl font-bold text-amber-300">
                    {status?.devices.offline ?? "-"}
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

            <div className="rounded-[2rem] border border-white/10 bg-slate-950/90 overflow-hidden shadow-2xl shadow-cyan-500/10">
              <div className="h-[50vh] min-h-[320px] md:h-[76vh] md:min-h-[560px] relative">
                {mapLoading ? (
                  <div className="flex h-full items-center justify-center bg-slate-950 text-zinc-400">
                    Memuat peta...
                  </div>
                ) : (
                  <MapContainer
                    center={[-7.2908, 112.779]}
                    zoom={17}
                    scrollWheelZoom={true}
                    style={{ height: "100%", width: "100%" }}
                  >
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
                    <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Lokasi
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {selectedBuilding.name}
                      </p>
                      <p
                        className={`mt-1 text-xs uppercase tracking-[0.2em] ${getStatusLabelClass(selectedBuilding)}`}
                      >
                        {selectedBuilding.online ? "Online" : "Offline"}
                      </p>
                    </div>
                    <div className="grid gap-3">
                      <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                          Klien Saat Ini
                        </p>
                        <p className="mt-3 text-3xl font-bold text-white">
                          {selectedBuilding.total_clients ?? 0}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                          Kepadatan
                        </p>
                        <p className="mt-3 text-3xl font-bold text-white">
                          {selectedBuilding.density ?? 0}%
                        </p>
                        <p className="text-xs text-zinc-500 mt-2">
                          {getDensityLabel(selectedBuilding)}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Kapasitas Total
                      </p>
                      <p className="mt-3 text-2xl font-bold text-white">
                        {selectedBuilding.total_capacity ?? 0}
                      </p>
                    </div>
                    {selectedBuilding.floors &&
                      selectedBuilding.floors.length > 0 && (
                        <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">
                            Access Point / Segment
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
                                  {floor.rooms.map((room) => (
                                    <div
                                      key={room.id}
                                      className="flex items-center justify-between gap-2 text-xs bg-slate-900/50 rounded-lg p-2"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-white truncate">
                                          {room.name}
                                        </p>
                                        <p className="text-zinc-500 text-[10px]">
                                          {room.current} / {room.cap} klien
                                        </p>
                                      </div>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                                          room.status === "online"
                                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                        }`}
                                      >
                                        {room.status === "online"
                                          ? "Online"
                                          : "Offline"}
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
                  <div className="rounded-3xl border border-zinc-800 bg-slate-900/80 p-4">
                    <p className="text-sm font-semibold text-white">
                      Klik icon Wi-Fi untuk melihat detail.
                    </p>
                    <p className="mt-2 text-sm text-zinc-400">
                      Panel ini akan menampilkan status, kepadatan, dan jumlah
                      klien per area.
                    </p>
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
