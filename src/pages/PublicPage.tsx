import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wifi, Server, CheckCircle, XCircle, AlertTriangle,
  Clock, Shield, RefreshCw, ChevronRight, Activity,
  Zap, Globe
} from 'lucide-react';

interface PublicStatus {
  devices: { total: number; online: number; offline: number; unknown: number };
  recentIssues: { device_name: string; type: string; title: string; created_at: string }[];
  criticalAlerts: number;
  lastUpdated: string;
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

interface PublicPageProps {
  onGoToLogin: () => void;
}

export default function PublicPage({ onGoToLogin }: PublicPageProps) {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/public/status');
      const data = await res.json();
      setStatus(data);
      setLastRefresh(new Date());
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const isAllGood = status && status.devices.offline === 0 && status.criticalAlerts === 0;
  const hasIssues = status && (status.devices.offline > 0 || status.criticalAlerts > 0);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 font-sans">
      {/* Ambient bg */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
              <Wifi className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">ITATS Network Status</h1>
              <p className="text-[10px] text-zinc-600">Institut Teknologi Adhi Tama Surabaya</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchStatus}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              title="Refresh"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-zinc-400", loading && "animate-spin")} />
            </button>
            <button
              onClick={onGoToLogin}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin Login
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        {/* Overall Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {loading && !status ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className={cn(
              "rounded-3xl border p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6",
              isAllGood
                ? "bg-emerald-500/5 border-emerald-500/20"
                : hasIssues
                ? "bg-red-500/5 border-red-500/20"
                : "bg-amber-500/5 border-amber-500/20"
            )}>
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center border flex-shrink-0",
                isAllGood ? "bg-emerald-500/10 border-emerald-500/20" :
                hasIssues ? "bg-red-500/10 border-red-500/20" :
                "bg-amber-500/10 border-amber-500/20"
              )}>
                {isAllGood
                  ? <CheckCircle className="w-8 h-8 text-emerald-400" />
                  : hasIssues
                  ? <XCircle className="w-8 h-8 text-red-400" />
                  : <AlertTriangle className="w-8 h-8 text-amber-400" />
                }
              </div>
              <div className="flex-1">
                <h2 className={cn(
                  "text-2xl font-bold mb-1",
                  isAllGood ? "text-emerald-400" : hasIssues ? "text-red-400" : "text-amber-400"
                )}>
                  {isAllGood
                    ? "✓ Semua Sistem Beroperasi Normal"
                    : hasIssues
                    ? "⚠ Terdeteksi Gangguan Jaringan"
                    : "Memuat Status Jaringan..."}
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {isAllGood
                    ? "Seluruh perangkat jaringan kampus ITATS berjalan dengan baik. Tidak ada gangguan yang terdeteksi."
                    : hasIssues
                    ? `${status?.devices.offline || 0} perangkat offline terdeteksi. Tim jaringan sedang menangani gangguan.`
                    : "Mengambil data status jaringan..."}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Clock className="w-3.5 h-3.5 text-zinc-600" />
                  <p className="text-xs text-zinc-600 font-mono">
                    Diperbarui: {lastRefresh.toLocaleTimeString('id-ID')} · Auto-refresh setiap 30 detik
                  </p>
                </div>
              </div>
              {status?.criticalAlerts ? (
                <div className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-center">
                  <p className="text-2xl font-bold text-red-400">{status.criticalAlerts}</p>
                  <p className="text-[10px] text-red-400/70 uppercase font-bold tracking-wider">Alert Kritis</p>
                </div>
              ) : null}
            </div>
          )}
        </motion.div>

        {/* Device Stats Grid */}
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            {[
              { label: 'Total Perangkat', value: status.devices.total, icon: Server, color: 'violet' },
              { label: 'Online', value: status.devices.online, icon: Activity, color: 'emerald' },
              { label: 'Offline', value: status.devices.offline, icon: WifiOff, color: 'red' },
              { label: 'Tidak Diketahui', value: status.devices.unknown, icon: AlertTriangle, color: 'amber' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className={cn(
                "p-5 rounded-3xl border",
                color === 'violet' ? "bg-violet-500/5 border-violet-500/20" :
                color === 'emerald' ? "bg-emerald-500/5 border-emerald-500/20" :
                color === 'red' ? "bg-red-500/5 border-red-500/20" :
                "bg-amber-500/5 border-amber-500/20"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center border mb-3",
                  color === 'violet' ? "bg-violet-500/10 border-violet-500/20 text-violet-400" :
                  color === 'emerald' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                  color === 'red' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                  "bg-amber-500/10 border-amber-500/20 text-amber-400"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xs text-zinc-500 font-medium mb-1">{label}</p>
                <p className={cn(
                  "text-3xl font-bold",
                  color === 'violet' ? "text-violet-300" :
                  color === 'emerald' ? "text-emerald-300" :
                  color === 'red' ? "text-red-300" : "text-amber-300"
                )}>{value}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Recent Issues */}
        {status && status.recentIssues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Riwayat Gangguan Terkini</h3>
                <p className="text-xs text-zinc-500">{status.recentIssues.length} kejadian terakhir</p>
              </div>
            </div>
            <div className="space-y-2">
              {status.recentIssues.map((issue, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-black/30 border border-white/5">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase flex-shrink-0",
                    issue.type === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  )}>{issue.type}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-300 truncate">{issue.title}</p>
                    <p className="text-[10px] text-zinc-600">{issue.device_name || 'Jaringan'}</p>
                  </div>
                  <p className="text-[10px] text-zinc-700 font-mono whitespace-nowrap flex-shrink-0">
                    {new Date(issue.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Info section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-blue-400" />
              <h4 className="font-bold text-sm">Cakupan Jaringan</h4>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Sistem monitoring ini mencakup seluruh perangkat jaringan aktif di lingkungan kampus ITATS, termasuk router, switch, dan access point.
            </p>
          </div>
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-400" />
              <h4 className="font-bold text-sm">Butuh Bantuan?</h4>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Jika Anda mengalami masalah koneksi, silakan hubungi <strong className="text-zinc-300">UPT Teknologi Informasi ITATS</strong> atau kunjungi Gedung Rektorat lantai 2.
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-16 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-700">
          <p>© {new Date().getFullYear()} ITATS — Sistem Monitoring Jaringan Terpusat</p>
          <button
            onClick={onGoToLogin}
            className="flex items-center gap-1.5 hover:text-zinc-500 transition-colors"
          >
            <Shield className="w-3 h-3" /> Login Admin <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function WifiOff({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  );
}
