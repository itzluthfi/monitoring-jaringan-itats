import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Send, ArrowLeft, Upload, FileText, Image as ImageIcon, X, CheckCircle2, Clipboard } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TicketForm() {
  const [formData, setFormData] = useState({
    reporter_id: '',
    reporter_name: '',
    reporter_email: '',
    category: 'wifi',
    title: '',
    description: ''
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticketCode, setTicketCode] = useState<string | null>(null);

  const categories = [
    { value: 'wifi', label: 'Wi-Fi / Hotspot' },
    { value: 'lan', label: 'Koneksi Kabel (LAN)' },
    { value: 'slow_internet', label: 'Internet Lambat' },
    { value: 'portal_login', label: 'Login Portal / Akun' },
    { value: 'other', label: 'Masalah Lainnya' }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 5MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

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
      if (photoFile) {
        data.append('photo', photoFile);
      }

      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST',
        body: data
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Gagal mengirim laporan');
      }

      const resData = await response.json();
      setTicketCode(resData.ticket_code);
      toast.success('Laporan berhasil dikirim!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Terjadi kesalahan saat mengirim laporan');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (ticketCode) {
      navigator.clipboard.writeText(ticketCode);
      toast.success('Kode tiket disalin ke clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 font-sans flex flex-col justify-between relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50 shrink-0">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/public" className="p-2 hover:bg-zinc-800/50 rounded-xl text-zinc-400 hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Form Pengaduan Jaringan</h1>
              <p className="text-[10px] text-zinc-500">Institut Teknologi Adhi Tama Surabaya</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/status-board" className="text-xs font-bold text-zinc-400 hover:text-white px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl transition-all">
              Status Board
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 shrink-0">
        <div className="w-full max-w-lg bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative">
          <AnimatePresence mode="wait">
            {!ticketCode ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
                    <Wifi className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Laporkan Masalah Jaringan</h2>
                    <p className="text-xs text-zinc-400">Silakan lengkapi form berikut untuk mengirim tiket kendala.</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">NIM / NIP / Kode Pegawai</label>
                      <input
                        required
                        type="text"
                        name="reporter_id"
                        value={formData.reporter_id}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                        placeholder="Contoh: 06.2023.1.90123"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Nama Lengkap</label>
                      <input
                        required
                        type="text"
                        name="reporter_name"
                        value={formData.reporter_name}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                        placeholder="Contoh: Ahmad Fauzi"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Email Aktif</label>
                    <input
                      required
                      type="email"
                      name="reporter_email"
                      value={formData.reporter_email}
                      onChange={handleInputChange}
                      className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                      placeholder="Contoh: ahmad@gmail.com"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Kategori Masalah</label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                      >
                        {categories.map(cat => (
                          <option key={cat.value} value={cat.value} className="bg-zinc-900">{cat.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Judul Laporan / Subjek</label>
                      <input
                        required
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                        placeholder="Contoh: Wifi Gedung F Putus-putus"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Detail Kerusakan / Kronologi</label>
                    <textarea
                      required
                      name="description"
                      rows={4}
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all resize-none"
                      placeholder="Jelaskan secara rinci lokasi, nama Wi-Fi, dan detail kendala Anda..."
                    />
                  </div>

                  {/* Photo Upload Area */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Upload Foto Pendukung (Opsional)</label>
                    
                    {!photoPreview ? (
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 hover:border-rose-500/50 bg-zinc-950/30 hover:bg-rose-500/[0.02] rounded-2xl p-6 cursor-pointer transition-all">
                        <Upload className="w-8 h-8 text-zinc-600 mb-2" />
                        <span className="text-xs text-zinc-400 font-medium">Klik untuk upload gambar</span>
                        <span className="text-[10px] text-zinc-600 mt-1">PNG, JPG, JPEG (Max 5MB)</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    ) : (
                      <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950/50 p-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={photoPreview}
                            alt="Preview"
                            className="w-12 h-12 object-cover rounded-lg border border-white/10"
                          />
                          <div className="min-w-0">
                            <p className="text-xs text-zinc-300 font-medium truncate">{photoFile?.name}</p>
                            <p className="text-[10px] text-zinc-500">{(photoFile!.size / (1024 * 1024)).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/15"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Kirim Laporan Pengaduan
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-6"
              >
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Laporan Terkirim!</h3>
                <p className="text-sm text-zinc-400 max-w-md mx-auto mb-8">
                  Terima kasih, laporan Anda telah diterima oleh administrator. Gunakan kode tiket di bawah ini untuk memantau status atau melakukan obrolan dengan tim teknis.
                </p>

                <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-left w-full sm:w-auto">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Kode Tiket Anda</p>
                    <p className="text-2xl font-bold font-mono text-emerald-400 tracking-wider">{ticketCode}</p>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 hover:text-white font-bold text-sm transition-all"
                  >
                    <Clipboard className="w-4 h-4" /> Salin Kode
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={`/ticket/${ticketCode}`}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15"
                  >
                    <FileText className="w-4 h-4" /> Buka Obrolan Tiket
                  </a>
                  <button
                    onClick={() => {
                      setTicketCode(null);
                      setPhotoFile(null);
                      setPhotoPreview(null);
                      setFormData({
                        reporter_id: '',
                        reporter_name: '',
                        reporter_email: '',
                        category: 'wifi',
                        title: '',
                        description: ''
                      });
                    }}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3.5 rounded-xl font-bold text-sm transition-all"
                  >
                    Buat Laporan Baru
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 shrink-0 mt-8">
        <p className="text-center text-[10px] text-zinc-700">© {new Date().getFullYear()} ITATS Network Monitor — Sistem Tiket Pengaduan Gangguan</p>
      </footer>
    </div>
  );
}
