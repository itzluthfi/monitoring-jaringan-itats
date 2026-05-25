import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi, Send, ArrowLeft, Upload, FileText,
  X, CheckCircle2, Clipboard, MapPin, Sun, Moon, Plus, MessageSquare,
  History, Trash2, ExternalLink, Lock, Globe, ChevronRight, Clock,
} from 'lucide-react';
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

function loadMyTickets(): SavedTicket[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveMyTicket(ticket: SavedTicket) {
  const list = loadMyTickets();
  const exists = list.find(t => t.ticket_code === ticket.ticket_code);
  if (!exists) {
    list.unshift(ticket);
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 20)));
  }
}

function removeMyTicket(code: string) {
  const list = loadMyTickets().filter(t => t.ticket_code !== code);
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export default function TicketForm() {
  const { isDark, toggleTheme } = usePublicTheme();

  const [formData, setFormData] = useState({
    reporter_id: '',
    reporter_name: '',
    reporter_email: '',
    category: 'wifi',
    title: '',
    description: '',
    is_public: true
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [myTickets, setMyTickets] = useState<SavedTicket[]>([]);

  useEffect(() => {
    setMyTickets(loadMyTickets());
  }, []);

  const categories = [
    { value: 'wifi', label: 'Wi-Fi / Hotspot' },
    { value: 'lan', label: 'Koneksi Kabel (LAN)' },
    { value: 'slow_internet', label: 'Internet Lambat' },
    { value: 'portal_login', label: 'Login Portal / Akun' },
    { value: 'other', label: 'Masalah Lainnya' }
  ];

  const getCategoryLabel = (val: string) => categories.find(c => c.value === val)?.label ?? 'Lainnya';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran file maksimal 5MB'); return; }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => { setPhotoFile(null); setPhotoPreview(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      data.append('reporter_id', formData.reporter_id);
      data.append('reporter_name', formData.reporter_name);
      data.append('reporter_email', formData.reporter_email);
      data.append('category', formData.category);
      data.append('title', formData.title);
      data.append('description', formData.description);
      data.append('is_public', formData.is_public ? '1' : '0');
      if (photoFile) data.append('photo', photoFile);

      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/api/tickets`, { method: 'POST', body: data });
      if (!response.ok) { const t = await response.text(); throw new Error(t || 'Gagal mengirim laporan'); }
      const resData = await response.json();
      const code = resData.ticket_code;
      setTicketCode(code);

      // Save to LocalStorage
      const newSaved: SavedTicket = {
        ticket_code: code,
        title: formData.title,
        category: formData.category,
        is_public: formData.is_public,
        created_at: new Date().toISOString(),
      };
      saveMyTicket(newSaved);
      setMyTickets(loadMyTickets());

      toast.success('Laporan berhasil dikirim!');
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan saat mengirim laporan');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (ticketCode) { navigator.clipboard.writeText(ticketCode); toast.success('Kode tiket disalin!'); }
  };

  const handleRemoveTicket = (code: string) => {
    removeMyTicket(code);
    setMyTickets(loadMyTickets());
    toast.success('Tiket dihapus dari riwayat');
  };

  const page   = isDark ? 'bg-[#08111f] text-zinc-100' : 'bg-[#eef2f9] text-slate-900 pub-light';
  const header = isDark ? 'border-white/10 bg-slate-950/80' : 'border-black/8 bg-white/92';
  const card   = isDark ? 'bg-slate-900/70 border-zinc-800' : 'bg-white/90 border-black/8';
  const input  = isDark
    ? 'bg-zinc-950/60 border-zinc-800 focus:border-rose-500 focus:ring-rose-500/10 text-white placeholder:text-zinc-600'
    : 'bg-white border-slate-200 focus:border-rose-400 focus:ring-rose-400/10 text-slate-900 placeholder:text-slate-400';
  const label  = isDark ? 'text-zinc-500' : 'text-slate-500';
  const muted  = isDark ? 'text-zinc-400' : 'text-slate-500';
  const subtle = isDark ? 'text-zinc-500' : 'text-slate-400';

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-300 ${page}`}>
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Mobile bottom bar */}
      <PublicBottomBar isDark={isDark} active="report" />

      {/* ── Header ── */}
      <header className={`sticky top-0 z-[500] border-b backdrop-blur-xl shrink-0 ${header}`}>
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <p className={`text-[9px] uppercase tracking-[0.3em] font-semibold leading-none ${isDark ? 'text-rose-400/70' : 'text-rose-500/70'}`}>ITATS Portal</p>
                <h1 className="text-sm font-bold tracking-tight leading-tight">Form Pengaduan Jaringan</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/status-board"
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${isDark ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20' : 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Status Tiket
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

      {/* ── Content ── */}
      <main className="flex-1 flex flex-col items-center p-4 md:p-8 pb-28 lg:pb-12 gap-6">
        {/* Form Card */}
        <div className={`w-full max-w-lg rounded-3xl border p-6 md:p-8 shadow-2xl relative ${card}`}>
          <AnimatePresence mode="wait">
            {!ticketCode ? (
              <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
                    <Wifi className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Laporkan Masalah Jaringan</h2>
                    <p className={`text-xs ${muted}`}>Silakan lengkapi form berikut untuk mengirim tiket kendala.</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${label}`}>NPM / NIP</label>
                      <input required type="text" name="reporter_id" value={formData.reporter_id} onChange={handleInputChange}
                        className={`w-full border focus:ring-2 rounded-xl px-4 py-3 text-sm outline-none transition-all ${input}`}
                        placeholder="Contoh: 06.2023.1.90123" />
                    </div>
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${label}`}>Nama Lengkap</label>
                      <input required type="text" name="reporter_name" value={formData.reporter_name} onChange={handleInputChange}
                        className={`w-full border focus:ring-2 rounded-xl px-4 py-3 text-sm outline-none transition-all ${input}`}
                        placeholder="Contoh: Ahmad Fauzi" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${label}`}>Kategori Masalah</label>
                      <select name="category" value={formData.category} onChange={handleInputChange}
                        className={`w-full border focus:ring-2 rounded-xl px-4 py-3 text-sm outline-none transition-all ${input}`}>
                        {categories.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${label}`}>Judul Laporan</label>
                      <input required type="text" name="title" value={formData.title} onChange={handleInputChange}
                        className={`w-full border focus:ring-2 rounded-xl px-4 py-3 text-sm outline-none transition-all ${input}`}
                        placeholder="Contoh: Wifi Gedung F Putus-putus" />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${label}`}>Visibilitas Laporan</label>
                    <select name="is_public" value={formData.is_public ? "true" : "false"}
                      onChange={(e) => setFormData({ ...formData, is_public: e.target.value === "true" })}
                      className={`w-full border focus:ring-2 rounded-xl px-4 py-3 text-sm outline-none transition-all ${input}`}>
                      <option value="true">🌐 Publik — muncul di Status Board</option>
                      <option value="false">🔒 Privat — hanya bisa diakses dengan kode tiket</option>
                    </select>
                    <p className={`text-[10px] mt-1.5 flex items-center gap-1 ${subtle}`}>
                      {formData.is_public
                        ? <><Globe className="w-3 h-3 text-emerald-500" /> Laporan Anda akan tampil di daftar publik, pesan hanya bisa dikirim oleh pemilik kode tiket.</>
                        : <><Lock className="w-3 h-3 text-amber-500" /> Laporan ini tersembunyi. Hanya orang yang punya kode tiket yang bisa mengaksesnya.</>
                      }
                    </p>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${label}`}>Detail Kerusakan / Kronologi</label>
                    <textarea required name="description" rows={4} value={formData.description} onChange={handleInputChange}
                      className={`w-full border focus:ring-2 rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none ${input}`}
                      placeholder="Jelaskan secara rinci lokasi, nama Wi-Fi, dan detail kendala Anda..." />
                  </div>

                  {/* Photo Upload */}
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${label}`}>Foto Pendukung (Opsional)</label>
                    {!photoPreview ? (
                      <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-all ${isDark ? 'border-zinc-800 hover:border-rose-500/50 bg-zinc-950/30 hover:bg-rose-500/[0.02]' : 'border-slate-200 hover:border-rose-400/50 bg-slate-50 hover:bg-rose-50/30'}`}>
                        <Upload className={`w-8 h-8 mb-2 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`} />
                        <span className={`text-xs font-medium ${muted}`}>Klik untuk upload gambar</span>
                        <span className={`text-[10px] mt-1 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>PNG, JPG, JPEG (Max 5MB)</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                      </label>
                    ) : (
                      <div className={`relative rounded-2xl overflow-hidden border p-2 flex items-center justify-between ${isDark ? 'border-zinc-800 bg-zinc-950/50' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center gap-3">
                          <img src={photoPreview} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-white/10" />
                          <div className="min-w-0">
                            <p className={`text-xs font-medium truncate ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{photoFile?.name}</p>
                            <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{(photoFile!.size / (1024 * 1024)).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button type="button" onClick={removePhoto} className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/15">
                    {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Kirim Laporan Pengaduan</>}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Laporan Terkirim!</h3>
                <p className={`text-sm max-w-md mx-auto mb-8 ${muted}`}>
                  Terima kasih. Laporan Anda telah diterima dan disimpan di perangkat ini. Gunakan kode tiket berikut untuk mengakses obrolan tiket.
                </p>

                {/* Ticket Code Card */}
                <div className={`rounded-2xl p-5 mb-4 border ${isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-left w-full sm:w-auto">
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${label}`}>Kode Tiket Anda</p>
                      <p className="text-2xl font-bold font-mono text-emerald-400 tracking-wider">{ticketCode}</p>
                      <p className={`text-[10px] mt-1.5 flex items-center gap-1 ${subtle}`}>
                        {formData.is_public
                          ? <><Globe className="w-3 h-3 text-emerald-400" /> Laporan Publik — tetap simpan kode ini untuk kirim pesan</>
                          : <><Lock className="w-3 h-3 text-amber-400" /> Laporan Privat — kode ini wajib untuk mengakses tiket</>
                        }
                      </p>
                    </div>
                    <button onClick={copyToClipboard}
                      className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all border ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <Clipboard className="w-4 h-4" /> Salin Kode
                    </button>
                  </div>
                </div>

                <div className={`rounded-2xl p-4 mb-6 border text-left ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                    ⚠️ <strong>Simpan kode ini!</strong> Kode tiket diperlukan untuk mengirim pesan ke admin atau mengakses laporan Anda di lain waktu. Kode tiket juga tersimpan otomatis di <strong>riwayat di bawah halaman ini</strong>.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a href={`/ticket/${ticketCode}`}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15">
                    <FileText className="w-4 h-4" /> Buka Obrolan Tiket
                  </a>
                  <button
                    onClick={() => { setTicketCode(null); setPhotoFile(null); setPhotoPreview(null); setFormData({ reporter_id: '', reporter_name: '', reporter_email: '', category: 'wifi', title: '', description: '', is_public: true }); }}
                    className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all border ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'}`}>
                    Buat Laporan Baru
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── "Tiket Saya" History Section ── */}
        {myTickets.length > 0 && (
          <motion.div
            className="w-full max-w-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className={`rounded-3xl border overflow-hidden shadow-xl ${card}`}>
              {/* Header */}
              <div className={`px-6 py-4 border-b flex items-center gap-3 ${isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-slate-100 bg-slate-50/60'}`}>
                <div className={`p-2 rounded-xl ${isDark ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-100'}`}>
                  <History className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Tiket Saya</h3>
                  <p className={`text-[10px] ${subtle}`}>Riwayat laporan yang Anda buat di perangkat ini</p>
                </div>
              </div>

              {/* Ticket List */}
              <div className="divide-y divide-zinc-800/40">
                {myTickets.map((t) => (
                  <div key={t.ticket_code} className={`px-5 py-4 flex items-center gap-3 group ${isDark ? 'hover:bg-zinc-800/30' : 'hover:bg-slate-50'} transition-all`}>
                    {/* Icon */}
                    <div className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center border ${t.is_public
                      ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600')
                      : (isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600')
                    }`}>
                      {t.is_public ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>{t.title}</p>
                      <div className={`flex items-center gap-2 mt-0.5 text-[10px] ${subtle}`}>
                        <span className="font-mono">{t.ticket_code}</span>
                        <span>·</span>
                        <span>{getCategoryLabel(t.category)}</span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`/ticket/${t.ticket_code}`}
                        title="Buka Obrolan"
                        className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-indigo-500/20 text-zinc-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleRemoveTicket(t.ticket_code)}
                        title="Hapus dari riwayat"
                        className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-rose-500/20 text-zinc-600 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-300 hover:text-rose-500'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      <footer className={`border-t py-5 shrink-0 ${isDark ? 'border-white/5' : 'border-black/5'}`}>
        <p className={`text-center text-[10px] ${isDark ? 'text-zinc-700' : 'text-slate-400'}`}>
          © {new Date().getFullYear()} ITATS Network Monitor — Sistem Tiket Pengaduan Gangguan
        </p>
      </footer>
    </div>
  );
}
