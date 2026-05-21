import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wifi, 
  Send, 
  ArrowLeft, 
  Image as ImageIcon, 
  X, 
  Clock, 
  MessageSquare, 
  Shield, 
  User, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Ticket {
  id: number;
  ticket_code: string;
  reporter_id: string;
  reporter_name: string;
  reporter_email: string;
  category: string;
  title: string;
  description: string;
  photo_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: number;
  sender_type: 'user' | 'admin';
  sender_name: string;
  message: string;
  photo_url: string | null;
  created_at: string;
}

export default function TicketChatPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTicketDetails = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/api/tickets/${code}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Tiket tidak ditemukan');
        }
        throw new Error('Gagal memuat detail tiket');
      }
      const data = await response.json();
      setTicket(data.ticket);
      setReplies(data.replies);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Terjadi kesalahan saat memuat tiket');
      if (err.message === 'Tiket tidak ditemukan') {
        navigate('/status-board');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Poll for new replies every 5 seconds
  useEffect(() => {
    fetchTicketDetails(true);
    
    const interval = setInterval(() => {
      fetchTicketDetails(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [code]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran foto maksimal 5MB');
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

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() && !photoFile) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('message', messageText.trim());
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/api/tickets/${code}/replies`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Gagal mengirim balasan');
      }

      setMessageText('');
      setPhotoFile(null);
      setPhotoPreview(null);
      await fetchTicketDetails(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  const copyTicketCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success('Kode tiket disalin ke clipboard');
    }
  };

  const getStatusBadgeClass = (status: string) => {
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

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading && !ticket) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 font-sans flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400 mt-4">Memuat obrolan tiket...</p>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 font-sans flex flex-col relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50 shrink-0">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/status-board')} 
              className="p-2 hover:bg-zinc-800/50 rounded-xl text-zinc-400 hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight">Obrolan Tiket</h1>
                <span className="text-[10px] text-zinc-500 font-mono">/</span>
                <span className="text-[11px] font-mono text-indigo-400 font-bold flex items-center gap-1">
                  {ticket.ticket_code}
                  <button onClick={copyTicketCode} className="hover:text-white transition-colors" title="Salin Kode">
                    <Copy className="w-3 h-3" />
                  </button>
                </span>
              </div>
              <p className="text-[10px] text-zinc-500">Gunakan halaman ini untuk berdiskusi dengan admin</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${getStatusBadgeClass(ticket.status)}`}>
              {ticket.status}
            </span>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-6 flex flex-col md:flex-row gap-6 overflow-hidden">
        
        {/* Left Side: Ticket Details Info Card (desktop only, collapses on mobile) */}
        <div className="w-full md:w-80 shrink-0 flex flex-col gap-4">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 backdrop-blur-xl shadow-xl space-y-4">
            <div>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Subjek Masalah</span>
              <h2 className="text-sm font-bold text-white leading-snug">{ticket.title}</h2>
            </div>

            <div className="h-[1px] bg-zinc-800/60" />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">Kategori</span>
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-rose-400" />
                  {getCategoryLabel(ticket.category)}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">Dilaporkan Pada</span>
                <span className="text-xs font-semibold text-zinc-300 font-mono">
                  {new Date(ticket.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            </div>

            <div className="h-[1px] bg-zinc-800/60" />

            <div>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Detail Laporan</span>
              <p className="text-xs text-zinc-400 leading-relaxed max-h-36 overflow-y-auto custom-scrollbar pr-1">{ticket.description}</p>
            </div>

            {ticket.photo_url && (
              <>
                <div className="h-[1px] bg-zinc-800/60" />
                <div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Foto Pendukung</span>
                  <a 
                    href={ticket.photo_url.startsWith('http') ? ticket.photo_url : `${import.meta.env.VITE_API_URL || ''}${ticket.photo_url}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="block group relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950"
                  >
                    <img 
                      src={ticket.photo_url.startsWith('http') ? ticket.photo_url : `${import.meta.env.VITE_API_URL || ''}${ticket.photo_url}`} 
                      alt="Attachment" 
                      className="w-full h-24 object-cover group-hover:scale-105 transition-all duration-300"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">Perbesar Foto</span>
                    </div>
                  </a>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Message Thread Area */}
        <div className="flex-1 flex flex-col bg-zinc-900/40 border border-zinc-800/60 rounded-3xl backdrop-blur-xl shadow-xl overflow-hidden h-[calc(100vh-140px)]">
          {/* Top Bar inside chat thread showing target agent status */}
          <div className="px-5 py-3.5 bg-zinc-950/40 border-b border-zinc-850 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Administrator ITATS</h3>
                <p className="text-[9px] text-zinc-500">Siap membantu mengatasi kendala Anda</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Aktif</span>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            {/* Initial systemic ticket creation bubble */}
            <div className="flex justify-center my-2">
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-4 py-2 text-center max-w-sm">
                <p className="text-[10px] text-zinc-500 leading-normal">
                  Tiket berhasil dibuat pada <span className="font-mono text-zinc-400">{formatDate(ticket.created_at)}</span> pukul <span className="font-mono text-zinc-400">{formatTime(ticket.created_at)}</span>.
                </p>
              </div>
            </div>

            {/* Conversation thread */}
            {replies.map((reply, index) => {
              const isAdmin = reply.sender_type === 'admin';
              
              // Helper to show date dividers between messages from different days
              const showDateDivider = index === 0 || 
                new Date(replies[index - 1].created_at).toDateString() !== new Date(reply.created_at).toDateString();

              return (
                <React.Fragment key={reply.id}>
                  {showDateDivider && (
                    <div className="flex justify-center my-4">
                      <span className="text-[9px] font-bold text-zinc-650 bg-zinc-900/40 px-3 py-1 rounded-full border border-zinc-800/30 uppercase tracking-widest">
                        {formatDate(reply.created_at)}
                      </span>
                    </div>
                  )}

                  <div className={`flex gap-3 max-w-[85%] ${isAdmin ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}>
                    {/* Sender Avatar Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-md ${
                      isAdmin 
                        ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 border border-indigo-400/20 text-white' 
                        : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                    }`}>
                      {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>

                    <div className="space-y-1">
                      {/* Name of sender */}
                      <span className={`text-[10px] font-bold block ${isAdmin ? 'text-indigo-400' : 'text-zinc-400 text-right'}`}>
                        {isAdmin ? reply.sender_name : 'Anda'}
                      </span>

                      {/* Message bubble */}
                      <div className={`rounded-2xl p-3.5 text-xs shadow-lg relative border ${
                        isAdmin 
                          ? 'bg-zinc-900 border-zinc-800 text-zinc-100 rounded-tl-none' 
                          : 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none'
                      }`}>
                        
                        {/* Reply image attachment */}
                        {reply.photo_url && (
                          <a 
                            href={reply.photo_url.startsWith('http') ? reply.photo_url : `${import.meta.env.VITE_API_URL || ''}${reply.photo_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-lg overflow-hidden border border-black/10 bg-black/20 mb-2 max-w-xs"
                          >
                            <img 
                              src={reply.photo_url.startsWith('http') ? reply.photo_url : `${import.meta.env.VITE_API_URL || ''}${reply.photo_url}`}
                              alt="Reply attachment" 
                              className="max-h-48 w-full object-cover"
                            />
                          </a>
                        )}

                        <p className="leading-relaxed whitespace-pre-wrap">{reply.message}</p>
                        
                        <span className={`text-[9px] font-mono block mt-1.5 text-right ${isAdmin ? 'text-zinc-500' : 'text-indigo-200'}`}>
                          {formatTime(reply.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Photo attachment preview above input */}
          <AnimatePresence>
            {photoPreview && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="px-5 py-3.5 bg-zinc-950/80 border-t border-zinc-850 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <img 
                    src={photoPreview} 
                    alt="Preview attachment" 
                    className="w-14 h-14 object-cover rounded-lg border border-white/10"
                  />
                  <div>
                    <p className="text-xs text-zinc-300 font-bold">Foto Siap Dikirim</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{(photoFile!.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>
                <button 
                  onClick={removePhoto} 
                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Footer Form */}
          <div className="p-4 bg-zinc-950/50 border-t border-zinc-850">
            <form onSubmit={handleSendReply} className="flex items-center gap-3">
              {/* Photo Upload Icon Button */}
              <label className="p-3 bg-zinc-905 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-xl cursor-pointer transition-all shrink-0">
                <ImageIcon className="w-4 h-4" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileChange}
                  disabled={sending}
                />
              </label>

              {/* Message Input text field */}
              <input 
                type="text" 
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Ketik pesan balasan ke admin di sini..."
                className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all placeholder:text-zinc-650"
                disabled={sending}
              />

              {/* Submit Button */}
              <button 
                type="submit"
                disabled={sending || (!messageText.trim() && !photoFile)}
                className="p-3 bg-indigo-650 hover:bg-indigo-550 disabled:bg-zinc-850 disabled:text-zinc-600 text-white rounded-xl transition-all shrink-0 shadow-lg shadow-indigo-650/15"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 shrink-0 mt-auto">
        <p className="text-center text-[10px] text-zinc-700">© {new Date().getFullYear()} ITATS Network Monitor — Sistem Tiket Pengaduan Gangguan</p>
      </footer>
    </div>
  );
}
