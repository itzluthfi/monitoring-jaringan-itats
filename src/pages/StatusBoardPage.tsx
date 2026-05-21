import React, { useState, useEffect } from 'react';
import {
  Wifi, Search, AlertCircle, ArrowLeft,
  Plus, MessageSquare, Clock, MapPin, Sun, Moon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePublicTheme } from '../hooks/usePublicTheme';
import PublicBottomBar from '../components/PublicBottomBar';

interface Ticket {
  id: number;
  ticket_code: string;
  category: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
}

export default function StatusBoardPage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = usePublicTheme();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupCode, setLookupCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const fetchPublicTickets = async () => {
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/api/tickets/public`);
      if (response.ok) setTickets(await response.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPublicTickets(); }, []);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = lookupCode.trim().toUpperCase();
    if (!formatted) { toast.error('Masukkan kode tiket terlebih dahulu'); return; }
    if (!formatted.startsWith('TCK-')) { toast.error('Format kode tiket salah. Contoh: TCK-123456'); return; }
    navigate(`/ticket/${formatted}`);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'open') return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
    if (s === 'processing') return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    if (s === 'resolved') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    return 'bg-zinc-800 border-zinc-700 text-zinc-400';
  };

  const getCategoryLabel = (category: string) => {
    const c = category.toLowerCase();
    if (c === 'wifi') return 'Wi-Fi / Hotspot';
    if (c === 'lan') return 'Koneksi Kabel (LAN)';
    if (c === 'slow_internet') return 'Internet Lambat';
    if (c === 'portal_login') return 'Login Portal / Akun';
    return 'Lainnya';
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  /* ── Theming helpers ── */
  const page    = isDark ? 'bg-[#08111f] text-zinc-100' : 'bg-[#eef2f9] text-slate-900 pub-light';
  const header  = isDark ? 'border-white/10 bg-slate-950/80' : 'border-black/8 bg-white/92';
  const card    = isDark ? 'bg-slate-900/60 border-zinc-800' : 'bg-white/90 border-black/8';
  const cardHov = isDark ? 'hover:border-zinc-700/60' : 'hover:border-slate-300';
  const muted   = isDark ? 'text-zinc-400' : 'text-slate-500';
  const subtle  = isDark ? 'text-zinc-500' : 'text-slate-400';
  const inputCls = isDark
    ? 'bg-zinc-950/80 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400';

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 ${page}`}>
      {/* Ambient glows */}
      <div className="fixed top-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Mobile bottom bar */}
      <PublicBottomBar isDark={isDark} active="ticket" />

      {/* ── Header ── */}
      <header className={`sticky top-0 z-[500] border-b backdrop-blur-xl shrink-0 ${header}`}>
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          {/* Left: back + title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className={`text-[9px] uppercase tracking-[0.3em] font-semibold leading-none ${isDark ? 'text-indigo-400/70' : 'text-indigo-500/70'}`}>ITATS Portal</p>
                <h1 className="text-sm font-bold tracking-tight leading-tight">Status Board Gangguan</h1>
              </div>
            </div>
          </div>
          {/* Right: Lapor + theme toggle */}
          <div className="flex items-center gap-2">
            <a
              href="/report"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/10"
            >
              <Plus className="w-3.5 h-3.5" />
              Buat Laporan
            </a>
            <button
              onClick={toggleTheme}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border transition ${isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20' : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-white'}`}
              title={isDark ? 'Mode Terang' : 'Mode Gelap'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-8 space-y-8 shrink-0 pb-28 lg:pb-8">

        {/* Ticket Lookup Card */}
        <div className={`p-5 md:p-6 rounded-3xl border backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-5 shadow-xl ${card}`}>
          <div className="flex-1">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-400" /> Cek Status Tiket Anda
            </h2>
            <p className={`text-xs mt-1 ${muted}`}>
              Masukkan kode tiket <code className="font-mono">TCK-XXXXXX</code> untuk memantau status atau membalas pesan admin.
            </p>
          </div>
          <form onSubmit={handleLookup} className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value)}
              placeholder="Contoh: TCK-XYZ123"
              className={`w-full sm:w-64 border rounded-xl px-4 py-2.5 text-sm font-mono outline-none transition-all ${inputCls}`}
            />
            <button type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 whitespace-nowrap">
              <Search className="w-4 h-4" /> Cari Tiket
            </button>
          </form>
        </div>

        {/* Ticket List */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base">Daftar Gangguan &amp; Laporan Publik</h3>
              <p className={`text-xs ${subtle}`}>Kumpulan laporan dari sivitas akademika untuk transparansi sistem.</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                className={`border text-xs rounded-xl px-3 py-2 outline-none cursor-pointer transition-all ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 focus:border-rose-500' : 'bg-white border-slate-200 text-slate-600 focus:border-rose-400'}`}>
                <option value="all">Semua Kategori</option>
                <option value="wifi">Wi-Fi</option>
                <option value="lan">LAN</option>
                <option value="slow_internet">Internet Lambat</option>
                <option value="portal_login">Login Portal</option>
                <option value="other">Lainnya</option>
              </select>
              <div className="relative flex-1 sm:flex-none">
                <input type="text" placeholder="Cari Laporan..."
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full sm:w-48 border text-xs rounded-xl pl-8 pr-3 py-2 outline-none transition-all ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 placeholder:text-zinc-600 focus:border-rose-500' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-rose-400'}`}
                />
                <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${subtle}`} />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className={`p-12 text-center rounded-3xl border ${isDark ? 'bg-zinc-900/20 border-zinc-800/40' : 'bg-white/50 border-slate-200'}`}>
              <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${subtle}`} />
              <p className={`font-medium ${muted}`}>Tidak ada laporan gangguan yang aktif.</p>
              <p className={`text-xs mt-1 ${subtle}`}>Jaringan terpantau beroperasi secara normal.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTickets.map((t) => (
                <div key={t.id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all group cursor-pointer ${card} ${cardHov}`}
                  onClick={() => navigate(`/ticket/${t.ticket_code}`)}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-[10px] font-mono tracking-wider font-bold uppercase ${subtle}`}>{t.ticket_code}</span>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${getStatusBadge(t.status)}`}>{t.status}</span>
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm truncate group-hover:text-rose-400 transition-colors`}>{t.title}</h4>
                      <p className={`text-xs leading-relaxed mt-1 line-clamp-3 ${muted}`}>{t.description}</p>
                    </div>
                  </div>
                  <div className={`pt-3 border-t flex items-center justify-between text-[10px] ${subtle} ${isDark ? 'border-zinc-800/60' : 'border-slate-200'}`}>
                    <span className="flex items-center gap-1"><Wifi className="w-3.5 h-3.5" />{getCategoryLabel(t.category)}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className={`border-t py-5 shrink-0 mt-8 ${isDark ? 'border-white/5' : 'border-black/5'}`}>
        <p className={`text-center text-[10px] ${isDark ? 'text-zinc-700' : 'text-slate-400'}`}>
          © {new Date().getFullYear()} ITATS Network Monitor — Sistem Tiket Pengaduan Gangguan
        </p>
      </footer>
    </div>
  );
}
