import React, { useState, useEffect } from 'react';
import { Wifi, Search, AlertCircle, ArrowLeft, Plus, MessageSquare, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicTickets();
  }, []);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = lookupCode.trim().toUpperCase();
    if (!formatted) {
      toast.error('Masukkan kode tiket terlebih dahulu');
      return;
    }
    if (!formatted.startsWith('TCK-')) {
      toast.error('Format kode tiket salah. Contoh: TCK-123456');
      return;
    }
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

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 font-sans flex flex-col justify-between relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="fixed top-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50 shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="p-2 hover:bg-zinc-800/50 rounded-xl text-zinc-400 hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Status Board Gangguan</h1>
              <p className="text-[10px] text-zinc-500">Institut Teknologi Adhi Tama Surabaya</p>
            </div>
          </div>
          <a
            href="/report"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all shadow-md shadow-rose-600/10"
          >
            <Plus className="w-3.5 h-3.5" /> Buat Laporan
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-8 shrink-0">
        
        {/* Ticket Lookup Card */}
        <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-3xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-400" /> Cek Status Tiket Anda
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Masukkan kode tiket <code>TCK-XXXXXX</code> yang didapatkan saat mengirim pengaduan untuk memantau status atau membalas pesan admin.
            </p>
          </div>
          <form onSubmit={handleLookup} className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value)}
              placeholder="Contoh: TCK-XYZ123"
              className="w-full sm:w-64 bg-zinc-950/80 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm font-mono text-white outline-none transition-all placeholder:text-zinc-600"
            />
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Search className="w-4 h-4" /> Cari Tiket
            </button>
          </form>
        </div>

        {/* Known Issues list */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-white text-base">Daftar Gangguan & Laporan Publik</h3>
              <p className="text-xs text-zinc-500">Kumpulan laporan dari sivitas akademika untuk transparansi sistem.</p>
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-2 outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="all">Semua Kategori</option>
                <option value="wifi">Wi-Fi</option>
                <option value="lan">LAN</option>
                <option value="slow_internet">Internet Lambat</option>
                <option value="portal_login">Login Portal</option>
                <option value="other">Lainnya</option>
              </select>

              <div className="relative flex-1 sm:flex-none">
                <input
                  type="text"
                  placeholder="Cari Laporan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-48 bg-zinc-900 border border-zinc-800 text-zinc-300 placeholder:text-zinc-600 text-xs rounded-xl pl-8 pr-3 py-2 outline-none focus:border-rose-500"
                />
                <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-12 text-center bg-zinc-900/20 border border-zinc-800/40 rounded-3xl">
              <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 font-medium">Tidak ada laporan gangguan yang aktif.</p>
              <p className="text-xs text-zinc-600 mt-1">Jaringan terpantau beroperasi secara normal.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTickets.map((t) => (
                <div
                  key={t.id}
                  className="p-6 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl flex flex-col justify-between gap-4 hover:border-zinc-700/60 transition-all group cursor-pointer"
                  onClick={() => navigate(`/ticket/${t.ticket_code}`)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] text-zinc-500 font-mono tracking-wider font-bold uppercase">{t.ticket_code}</span>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${getStatusBadge(t.status)}`}>
                        {t.status}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-white group-hover:text-rose-400 transition-colors text-sm truncate">{t.title}</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed mt-1 line-clamp-3">{t.description}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Wifi className="w-3.5 h-3.5 text-zinc-500" />
                      {getCategoryLabel(t.category)}
                    </span>
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

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 shrink-0 mt-8">
        <p className="text-center text-[10px] text-zinc-700">© {new Date().getFullYear()} ITATS Network Monitor — Sistem Tiket Pengaduan Gangguan</p>
      </footer>
    </div>
  );
}
