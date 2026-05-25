import React, { useState, useEffect } from 'react';
import {
  Wifi, Search, AlertCircle,
  Plus, Clock, MapPin, Sun, Moon,
  Lock, Globe, History, ExternalLink, Trash2, ChevronRight, Key,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePublicTheme } from '../hooks/usePublicTheme';
import PublicBottomBar from '../components/PublicBottomBar';

const LS_KEY = 'my_tickets';

interface SavedTicket {
  ticket_code: string;
  title: string;
  category: string;
  is_public: boolean;
  created_at: string;
}

interface Ticket {
  id: number;
  ticket_code: string;
  category: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
}

function loadMyTickets(): SavedTicket[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function removeMyTicket(code: string) {
  const list = loadMyTickets().filter(t => t.ticket_code !== code);
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export default function StatusBoardPage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = usePublicTheme();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupCode, setLookupCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [myTickets, setMyTickets] = useState<SavedTicket[]>([]);

  // (no verification modal state needed - public cards navigate directly)


  useEffect(() => {
    setMyTickets(loadMyTickets());
  }, []);

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
    // Direct navigation — works for both public and private tickets
    // Private tickets show locked UI on the chat page
    navigate(`/ticket/${formatted}`);
  };

  // Click on public ticket card → always navigate directly
  // Public tickets are viewable by anyone (read-only for non-owners)
  // The chat page itself handles who can send messages
  const handleCardClick = (t: Ticket) => {
    navigate(`/ticket/${t.ticket_code}`);
  };


  const handleRemoveMyTicket = (code: string) => {
    removeMyTicket(code);
    setMyTickets(loadMyTickets());
    toast.success('Tiket dihapus dari riwayat');
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'open') return 'badge-status-open';
    if (s === 'processing') return 'badge-status-processing';
    if (s === 'resolved') return 'badge-status-resolved';
    return 'badge-status-closed';
  };

  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'open') return 'Dibuka';
    if (s === 'processing') return 'Diproses';
    if (s === 'resolved') return 'Diselesaikan';
    return 'Ditutup';
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
  const cardHov = 'hover:border-indigo-500/40 cursor-pointer active:scale-[0.99]';
  const muted   = isDark ? 'text-zinc-400' : 'text-slate-700';
  const subtle  = isDark ? 'text-zinc-500' : 'text-slate-500';
  const inputCls = isDark
    ? 'bg-zinc-950/80 border-zinc-800 text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400';

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 ${page}`}>
      {/* Ambient glows */}
      <div className="fixed top-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Mobile bottom bar */}
      <PublicBottomBar isDark={isDark} active="ticket" />

      {/* Modal removed — public cards now navigate directly to chat */}

      {/* ── Header ── */}
      <header className={`sticky top-0 z-[500] border-b backdrop-blur-xl shrink-0 ${header}`}>
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
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

        {/* My Tickets Section */}
        {myTickets.length > 0 && (
          <div className={`rounded-3xl border overflow-hidden shadow-xl ${card}`}>
            <div className={`px-5 py-3.5 border-b flex items-center gap-3 ${isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-slate-100 bg-slate-50/60'}`}>
              <div className={`p-1.5 rounded-xl ${isDark ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-100'}`}>
                <History className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Tiket Saya</h3>
                <p className={`text-[10px] ${subtle}`}>Laporan yang Anda buat di perangkat ini</p>
              </div>
            </div>
            <div className={`divide-y ${isDark ? 'divide-zinc-800/50' : 'divide-slate-100'}`}>
              {myTickets.map(t => (
                <div key={t.ticket_code} className={`px-5 py-3.5 flex items-center gap-3 ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-slate-50'} transition-all`}>
                  <div className={`w-7 h-7 shrink-0 rounded-xl flex items-center justify-center border ${t.is_public
                    ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600')
                    : (isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600')
                  }`}>
                    {t.is_public ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>{t.title}</p>
                    <p className={`text-[10px] font-mono mt-0.5 ${subtle}`}>{t.ticket_code} · {new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`/ticket/${t.ticket_code}`}
                      className={`p-1.5 rounded-lg transition-all text-xs font-bold flex items-center gap-1 ${isDark ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20' : 'bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100'}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="hidden sm:inline">Buka</span>
                    </a>
                    <button
                      onClick={() => handleRemoveMyTicket(t.ticket_code)}
                      className={`p-1.5 rounded-lg transition-all ${isDark ? 'text-zinc-600 hover:bg-rose-500/20 hover:text-rose-400' : 'text-slate-300 hover:bg-rose-50 hover:text-rose-500'}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ticket Lookup Card */}
        <div className={`p-5 md:p-6 rounded-3xl border backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-5 shadow-xl ${card}`}>
          <div className="flex-1">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" /> Akses Tiket Privat / Cek Status
            </h2>
            <p className={`text-xs mt-1 ${muted}`}>
              Masukkan kode tiket <code className="font-mono">TCK-XXXXXX</code> untuk akses laporan privat atau tiket yang Anda buat.
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
              <p className={`text-xs ${subtle}`}>
                Kumpulan laporan publik sivitas akademika. Klik kartu untuk masuk ke obrolan (memerlukan kode tiket).
              </p>
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
                  className={`w-full sm:w-48 border text-xs rounded-xl pl-8 pr-3 py-2 outline-none transition-all ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 placeholder:text-zinc-600 focus:border-rose-500' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-500 focus:border-rose-400'}`}
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
              {filteredTickets.map((t) => {
                const isOwned = myTickets.some(s => s.ticket_code === t.ticket_code);
                return (
                  <div
                    key={t.id}
                    onClick={() => handleCardClick(t)}
                    className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all group select-none ${card} ${cardHov}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <Globe className={`w-3 h-3 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${subtle}`}>Laporan Publik</span>
                          {isOwned && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                              Tiket Anda
                            </span>
                          )}
                        </div>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${getStatusBadge(t.status)}`}>{getStatusLabel(t.status)}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm truncate">{t.title}</h4>
                        <p className={`text-xs leading-relaxed mt-1 line-clamp-2 ${muted}`}>{t.description}</p>
                      </div>
                    </div>

                    <div className={`pt-3 border-t flex items-center justify-between ${isDark ? 'border-zinc-800/60' : 'border-slate-200'}`}>
                      <div className={`flex items-center gap-3 text-[10px] ${subtle}`}>
                        <span className="flex items-center gap-1"><Wifi className="w-3.5 h-3.5" />{getCategoryLabel(t.category)}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {/* CTA hint */}
                      <div className={`flex items-center gap-1 text-[10px] font-bold transition-all ${isDark
                        ? 'text-indigo-500 group-hover:text-indigo-400'
                        : 'text-indigo-400 group-hover:text-indigo-600'
                      }`}>
                        {isOwned ? (
                          <><ExternalLink className="w-3 h-3" /> Buka</>
                        ) : (
                          <><Key className="w-3 h-3" /> Masuk</>
                        )}
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
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
