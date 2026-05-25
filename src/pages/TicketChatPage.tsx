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
  Sun,
  Moon,
  Lock,
  Globe,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePublicTheme } from '../hooks/usePublicTheme';

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
  is_public: number; // 1 = public, 0 = private
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
  const { isDark, toggleTheme } = usePublicTheme();
  
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Access control
  // isOwner = user has this ticket saved in localStorage = full send access
  const [isOwner, setIsOwner] = useState(false);
  // For public tickets: user can unlock send by entering the ticket code
  const [unlockCode, setUnlockCode] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [showUnlockPanel, setShowUnlockPanel] = useState(false);
  const [showUnlockInput, setShowUnlockInput] = useState(false);

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const openLightbox = (src: string) => setLightboxSrc(src);
  const closeLightbox = () => setLightboxSrc(null);

  const fetchTicketDetails = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/api/tickets/${code}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Tiket tidak ditemukan');
        throw new Error('Gagal memuat detail tiket');
      }
      const data = await response.json();
      setTicket(data.ticket);
      setReplies(data.replies);

      // Check ownership from localStorage
      const saved = loadMyTickets();
      const owned = saved.find(t => t.ticket_code === data.ticket.ticket_code);
      if (owned) {
        setIsOwner(true);
      } else {
        setIsOwner(false);
      }
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

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLightbox(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

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
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => { setPhotoFile(null); setPhotoPreview(null); };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() && !photoFile) return;
    if (!isOwner) {
      toast.error('Masukkan kode tiket Anda untuk mengirim pesan');
      setShowUnlockPanel(true);
      return;
    }
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('message', messageText.trim());
      if (photoFile) formData.append('photo', photoFile);

      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/api/tickets/${code}/replies`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Gagal mengirim balasan');

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

  // Unlock send with ticket code
  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = unlockCode.trim().toUpperCase();
    if (!ticket) return;

    if (entered === ticket.ticket_code) {
      // Save to localStorage then become owner
      saveMyTicket({
        ticket_code: ticket.ticket_code,
        title: ticket.title,
        category: ticket.category,
        is_public: ticket.is_public === 1,
        created_at: ticket.created_at,
      });
      setIsOwner(true);
      setShowUnlockPanel(false);
      setUnlockCode('');
      setUnlockError('');
      toast.success('Kode tiket terverifikasi! Anda dapat mengirim pesan.');
    } else {
      setUnlockError('Kode tiket tidak sesuai. Silakan periksa kembali.');
    }
  };

  const copyTicketCode = () => {
    if (code) { navigator.clipboard.writeText(code); toast.success('Kode tiket disalin'); }
  };

  const getStatusBadgeClass = (status: string) => {
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

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading && !ticket) {
    return (
      <div className={`min-h-screen font-sans flex flex-col justify-center items-center ${isDark ? 'bg-[#08111f] text-zinc-100' : 'bg-[#eef2f9] text-slate-900 pub-light'}`}>
        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
        <p className={`text-sm mt-4 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>Memuat obrolan tiket...</p>
      </div>
    );
  }

  if (!ticket) return null;

  const isPublicTicket = ticket.is_public === 1;

  /* ── Theme Styling ── */
  const page          = isDark ? 'bg-[#08111f] text-zinc-100' : 'bg-[#eef2f9] text-slate-900 pub-light';
  const headerCls     = isDark ? 'border-white/5 bg-black/40' : 'border-black/8 bg-white/92';
  const cardCls       = isDark ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-white/90 border-slate-200';
  const chatBoxCls    = isDark ? 'bg-zinc-900/40 border-zinc-800/60' : 'bg-white/70 border-slate-200';
  const chatHeaderCls = isDark ? 'bg-zinc-950/40 border-zinc-800' : 'bg-slate-100 border-slate-200';
  const chatInputCls  = isDark ? 'bg-zinc-950/50 border-t border-zinc-800' : 'bg-slate-50 border-t border-slate-200';
  const dividerCls    = isDark ? 'bg-zinc-800/60' : 'bg-slate-200';
  const textTitle     = isDark ? 'text-white' : 'text-slate-900';
  const textMuted     = isDark ? 'text-zinc-400' : 'text-slate-600';
  const textSubtle    = isDark ? 'text-zinc-500' : 'text-slate-500';
  const textInfoVal   = isDark ? 'text-zinc-300' : 'text-slate-800';

  return (
    <div className={`min-h-screen font-sans flex flex-col relative overflow-hidden transition-colors duration-300 ${page}`}>
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className={`border-b backdrop-blur-xl sticky top-0 z-50 shrink-0 ${headerCls}`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/status-board')} 
              className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-zinc-800/50 text-zinc-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight">Obrolan Tiket</h1>
                <span className={`text-[10px] ${textSubtle} font-mono`}>/</span>
                <button 
                  onClick={copyTicketCode} 
                  className={`text-[11px] font-mono font-bold flex items-center gap-1 transition-colors ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'}`}
                  title="Salin Kode"
                >
                  {ticket.ticket_code}
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {isPublicTicket ? (
                  <span className={`text-[9px] flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    <Globe className="w-2.5 h-2.5" /> Laporan Publik
                  </span>
                ) : (
                  <span className={`text-[9px] flex items-center gap-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                    <Lock className="w-2.5 h-2.5" /> Laporan Privat
                  </span>
                )}
                {isOwner && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                    ✓ Tiket Anda
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${getStatusBadgeClass(ticket.status)}`}>
              {getStatusLabel(ticket.status)}
            </span>
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

      {/* Chat Container */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-6 flex flex-col md:flex-row gap-6 overflow-hidden">
        
        {/* Left Side: Ticket Details Info Card */}
        <div className="w-full md:w-80 shrink-0 flex flex-col gap-4">
          <div className={`rounded-2xl p-5 backdrop-blur-xl shadow-xl space-y-4 border ${cardCls}`}>
            <div>
              <span className={`text-[9px] font-bold uppercase tracking-widest block mb-1 ${textSubtle}`}>Subjek Masalah</span>
              <h2 className={`text-sm font-bold leading-snug ${textTitle}`}>{ticket.title}</h2>
            </div>

            <div className={`h-[1px] ${dividerCls}`} />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className={`text-[9px] font-bold uppercase tracking-widest block mb-0.5 ${textSubtle}`}>Kategori</span>
                <span className={`text-xs font-semibold flex items-center gap-1.5 ${textInfoVal}`}>
                  <Wifi className="w-3.5 h-3.5 text-rose-500" />
                  {getCategoryLabel(ticket.category)}
                </span>
              </div>
              <div>
                <span className={`text-[9px] font-bold uppercase tracking-widest block mb-0.5 ${textSubtle}`}>Dilaporkan Pada</span>
                <span className={`text-xs font-semibold font-mono ${textInfoVal}`}>
                  {new Date(ticket.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            </div>

            <div className={`h-[1px] ${dividerCls}`} />

            <div>
              <span className={`text-[9px] font-bold uppercase tracking-widest block mb-1 ${textSubtle}`}>Detail Laporan</span>
              <p className={`text-xs leading-relaxed max-h-36 overflow-y-auto custom-scrollbar pr-1 ${textMuted}`}>{ticket.description}</p>
            </div>

            {ticket.photo_url && (
              <>
                <div className={`h-[1px] ${dividerCls}`} />
                <div>
                  <span className={`text-[9px] font-bold uppercase tracking-widest block mb-2 ${textSubtle}`}>Foto Pendukung</span>
                  <button
                    type="button"
                    onClick={() => openLightbox(ticket.photo_url!.startsWith('http') ? ticket.photo_url! : `${import.meta.env.VITE_API_URL || ''}${ticket.photo_url!}`)}
                    className={`block w-full group relative rounded-lg overflow-hidden border cursor-zoom-in ${isDark ? 'border-zinc-800 bg-zinc-950' : 'border-slate-200 bg-slate-100'}`}
                  >
                    <img 
                      src={ticket.photo_url!.startsWith('http') ? ticket.photo_url! : `${import.meta.env.VITE_API_URL || ''}${ticket.photo_url!}`} 
                      alt="Attachment" 
                      className="w-full h-24 object-cover group-hover:scale-105 transition-all duration-300"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">🔍 Perbesar</span>
                    </div>
                  </button>
                </div>
              </>
            )}

            {/* Visibility notice */}
            <div className={`h-[1px] ${dividerCls}`} />
            <div className={`rounded-xl p-3 text-[10px] leading-relaxed flex items-start gap-2 ${
              isPublicTicket
                ? (isDark ? 'bg-emerald-500/5 border border-emerald-500/15 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-700')
                : (isDark ? 'bg-amber-500/5 border border-amber-500/15 text-amber-300' : 'bg-amber-50 border border-amber-200 text-amber-700')
            }`}>
              {isPublicTicket ? <Globe className="w-3 h-3 mt-0.5 shrink-0" /> : <Lock className="w-3 h-3 mt-0.5 shrink-0" />}
              <span>
                {isPublicTicket
                  ? 'Laporan ini bersifat publik dan dapat dilihat semua orang. Untuk mengirim pesan, masukkan kode tiket Anda.'
                  : 'Laporan ini bersifat privat. Hanya pemilik kode tiket yang dapat mengakses dan mengirim pesan.'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Message Thread Area */}
        <div className={`flex-1 flex flex-col rounded-3xl backdrop-blur-xl shadow-xl overflow-hidden h-[calc(100vh-140px)] border ${chatBoxCls}`}>
          {/* Top Bar inside chat thread */}
          <div className={`px-5 py-3.5 border-b flex items-center justify-between ${chatHeaderCls}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className={`text-xs font-bold ${textTitle}`}>Administrator ITATS</h3>
                <p className={`text-[9px] ${textSubtle}`}>Siap membantu mengatasi kendala Anda</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Aktif</span>
            </div>
          </div>

          {/* Messages Area */}
          <div className={`flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar ${isDark ? 'bg-transparent' : 'bg-slate-50/30'}`}>
            {/* Ticket creation system bubble */}
            <div className="flex justify-center my-2">
              <div className={`rounded-xl px-4 py-2 text-center max-w-sm border ${isDark ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
                <p className={`text-[10px] leading-normal ${textSubtle}`}>
                  Tiket dibuat pada <span className="font-mono">{formatDate(ticket.created_at)}</span> pukul <span className="font-mono">{formatTime(ticket.created_at)}</span>
                </p>
              </div>
            </div>

            {/* Conversation thread */}
            {replies.map((reply, index) => {
              const isAdmin = reply.sender_type === 'admin';
              const showDateDivider = index === 0 || 
                new Date(replies[index - 1].created_at).toDateString() !== new Date(reply.created_at).toDateString();

              return (
                <React.Fragment key={reply.id}>
                  {showDateDivider && (
                    <div className="flex justify-center my-4">
                      <span className={`text-[9px] font-bold px-3 py-1 rounded-full border uppercase tracking-widest ${isDark ? 'text-zinc-500 bg-zinc-900/40 border-zinc-800/30' : 'text-slate-600 bg-slate-200 border-slate-300'}`}>
                        {formatDate(reply.created_at)}
                      </span>
                    </div>
                  )}

                  <div className={`flex gap-3 max-w-[85%] ${isAdmin ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-md ${
                      isAdmin 
                        ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 border border-indigo-400/20 text-white' 
                        : (isDark ? 'bg-zinc-800 border border-zinc-700 text-zinc-400' : 'bg-slate-200 border border-slate-300 text-slate-600')
                    }`}>
                      {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>

                    <div className="space-y-1">
                      <span className={`text-[10px] font-bold block ${isAdmin ? 'text-indigo-500' : `${isDark ? 'text-zinc-400' : 'text-slate-600'} text-right`}`}>
                        {isAdmin ? reply.sender_name : 'Anda'}
                      </span>

                      <div className={`rounded-2xl p-3.5 text-xs shadow-sm relative border ${
                        isAdmin 
                          ? (isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100 rounded-tl-none' : 'bg-white border-slate-200 text-slate-800 rounded-tl-none') 
                          : 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none'
                      }`}>
                        {reply.photo_url && (
                          <button
                            type="button"
                            onClick={() => openLightbox(reply.photo_url!.startsWith('http') ? reply.photo_url! : `${import.meta.env.VITE_API_URL || ''}${reply.photo_url!}`)}
                            className="block rounded-lg overflow-hidden border border-black/10 bg-black/10 mb-2 max-w-xs group relative cursor-zoom-in"
                          >
                            <img 
                              src={reply.photo_url.startsWith('http') ? reply.photo_url : `${import.meta.env.VITE_API_URL || ''}${reply.photo_url}`}
                              alt="Reply attachment" 
                              className="max-h-48 w-full object-cover group-hover:brightness-90 transition-all"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-lg">
                              <span className="text-[10px] font-bold text-white">🔍 Perbesar</span>
                            </div>
                          </button>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap">{reply.message}</p>
                        <span className={`text-[9px] font-mono block mt-1.5 text-right ${isAdmin ? (isDark ? 'text-zinc-500' : 'text-slate-400') : 'text-indigo-200'}`}>
                          {formatTime(reply.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Empty state for 0 replies */}
            {replies.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <MessageSquare className={`w-10 h-10 mb-3 ${isDark ? 'text-zinc-700' : 'text-slate-300'}`} />
                <p className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Belum ada pesan</p>
                <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>Admin akan segera merespons laporan Anda</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Unlock Panel for public tickets (non-owner) */}
          <AnimatePresence>
            {showUnlockPanel && !isOwner && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`border-t overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}
              >
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Key className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                    <p className={`text-xs font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                      Masukkan Kode Tiket untuk Mengirim Pesan
                    </p>
                    <button onClick={() => setShowUnlockPanel(false)} className={`ml-auto p-1 rounded-lg ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600'}`}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <form onSubmit={handleUnlockSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={unlockCode}
                      onChange={(e) => { setUnlockCode(e.target.value); setUnlockError(''); }}
                      placeholder="Masukkan TCK-XXXXXX..."
                      autoFocus
                      className={`flex-1 border rounded-xl px-3 py-2.5 text-xs font-mono outline-none transition-all ${isDark
                        ? 'bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-indigo-500'
                        : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-400'
                      } ${unlockError ? 'border-rose-500' : ''}`}
                    />
                    <button
                      type="submit"
                      disabled={!unlockCode.trim()}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verifikasi
                    </button>
                  </form>
                  {unlockError && (
                    <p className="text-[10px] text-rose-500 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {unlockError}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Photo preview above input */}
          <AnimatePresence>
            {photoPreview && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className={`px-5 py-3.5 border-t flex items-center justify-between gap-3 ${isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-slate-100 border-slate-200'}`}
              >
                <div className="flex items-center gap-3">
                  <img src={photoPreview} alt="Preview attachment" className="w-14 h-14 object-cover rounded-lg border border-white/10" />
                  <div>
                    <p className={`text-xs font-bold ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>Foto Siap Dikirim</p>
                    <p className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{(photoFile!.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>
                <button onClick={removePhoto} className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Footer */}
          <div className={`p-4 ${chatInputCls}`}>
            {!isOwner ? (
              /* Non-owner: locked footer for public tickets, read-only */
              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all ${isDark
                  ? 'bg-zinc-900/50 border-zinc-800 hover:border-amber-500/40'
                  : 'bg-slate-100 border-slate-200 hover:border-amber-400/60'
                }`}
                onClick={() => setShowUnlockPanel(v => !v)}
              >
                <Key className={`w-4 h-4 shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
                <span className={`text-xs flex-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                  {isPublicTicket
                    ? 'Laporan publik dapat dibaca siapa saja. Masukkan kode tiket Anda untuk mengirim pesan →'
                    : 'Laporan privat. Masukkan kode tiket untuk mengakses obrolan →'
                  }
                </span>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                  {showUnlockPanel ? 'Tutup' : 'Masukkan Kode'}
                </span>
              </div>
            ) : (
              /* Owner: full message input */
              <form onSubmit={handleSendReply} className="flex items-center gap-3">
                {/* Photo Upload */}
                <label className={`p-3 border rounded-xl cursor-pointer transition-all shrink-0 ${isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'}`}>
                  <ImageIcon className="w-4 h-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={sending} />
                </label>

                {/* Message Input */}
                <input 
                  type="text" 
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Ketik pesan balasan ke admin di sini..."
                  className={`flex-1 border focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-xs outline-none transition-all ${isDark ? 'bg-zinc-900 border-zinc-800 focus:border-indigo-500 text-white placeholder:text-zinc-500' : 'bg-white border-slate-200 focus:border-indigo-400 text-slate-800 placeholder:text-slate-400'}`}
                  disabled={sending}
                />

                {/* Submit */}
                <button 
                  type="submit"
                  disabled={sending || (!messageText.trim() && !photoFile)}
                  className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl transition-all shrink-0 shadow-lg shadow-indigo-600/15"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={`border-t py-4 shrink-0 mt-auto ${isDark ? 'border-white/5' : 'border-black/5'}`}>
        <p className={`text-center text-[10px] ${isDark ? 'text-zinc-700' : 'text-slate-400'}`}>
          © {new Date().getFullYear()} ITATS Network Monitor — Sistem Tiket Pengaduan Gangguan
        </p>
      </footer>

      {/* ── Lightbox Modal ── */}
      <AnimatePresence>
        {lightboxSrc && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/88 backdrop-blur-md cursor-zoom-out"
            onClick={closeLightbox}
          >
            {/* X close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all backdrop-blur-sm"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Hint text */}
            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] text-white/40 font-mono select-none pointer-events-none">
              Klik di luar gambar atau tekan Esc untuk menutup
            </p>

            {/* Image (stop click propagation so clicking image doesn't close) */}
            <motion.img
              key={lightboxSrc}
              src={lightboxSrc}
              alt="Preview"
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="max-w-full max-h-[88vh] object-contain rounded-2xl shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
