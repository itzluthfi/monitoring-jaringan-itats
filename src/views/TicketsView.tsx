import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Mail,
  Hash,
  Wifi,
  CheckCircle2,
  AlertCircle,
  Send,
  Image as ImageIcon,
  X,
  ChevronRight,
  ChevronLeft,
  Copy,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '../lib/authFetch';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
  is_public: number;
  is_read: number;
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

export default function TicketsView() {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Admin Reply Form State
  const [replyText, setReplyText] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);

  // Draft state for status & visibility (explicit save)
  const [draftStatus, setDraftStatus] = useState<string>('');
  const [draftIsPublic, setDraftIsPublic] = useState<string>('');
  const [savingChanges, setSavingChanges] = useState(false);

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const openLightbox = (src: string) => setLightboxSrc(src);
  const closeLightbox = () => setLightboxSrc(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all tickets
  const fetchTickets = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await authFetch('/api/tickets/admin/list');
      const data = await response.json();
      setTickets(data);
      
      // If a ticket is currently selected, refresh its details in the list state too
      if (selectedTicket) {
        const updated = data.find((t: Ticket) => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal mengambil daftar tiket');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Fetch replies for a specific ticket
  const fetchReplies = async (ticketId: number, showLoading = false) => {
    if (showLoading) setRepliesLoading(true);
    try {
      const ticketCode = tickets.find(t => t.id === ticketId)?.ticket_code;
      if (!ticketCode) return;

      const response = await authFetch(`/api/tickets/${ticketCode}`);
      const data = await response.json();
      setReplies(data.replies);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setRepliesLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets(true);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Set up polling when a ticket is selected
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (selectedTicket) {
      fetchReplies(selectedTicket.id, true);
      
      // If the ticket is currently unread, mark it as read on server
      if (selectedTicket.is_read === 0) {
        authFetch(`/api/tickets/admin/${selectedTicket.id}/read`, { method: 'PUT' })
          .then(res => {
            if (res.ok) {
              // Dispatch event to update sidebar count immediately
              window.dispatchEvent(new CustomEvent('tickets-changed'));
              // Update local state in the list
              setTickets(prev => prev.map(tick => tick.id === selectedTicket.id ? { ...tick, is_read: 1 } : tick));
            }
          })
          .catch(err => console.error(err));
      }
      
      pollingRef.current = setInterval(() => {
        fetchReplies(selectedTicket.id, false);
      }, 4000);
    } else {
      setReplies([]);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedTicket?.id]);

  // Sync draft values whenever a different ticket is selected
  useEffect(() => {
    if (selectedTicket) {
      setDraftStatus(selectedTicket.status);
      setDraftIsPublic(selectedTicket.is_public ? 'true' : 'false');
    }
  }, [selectedTicket?.id]);

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  // Save both status and visibility in one request
  const handleSaveChanges = async () => {
    if (!selectedTicket) return;
    const statusChanged = draftStatus !== selectedTicket.status;
    const visibilityChanged = (draftIsPublic === 'true') !== Boolean(selectedTicket.is_public);
    if (!statusChanged && !visibilityChanged) {
      toast('Tidak ada perubahan.', { icon: 'ℹ️' });
      return;
    }
    setSavingChanges(true);
    try {
      const body: Record<string, any> = {};
      if (statusChanged) body.status = draftStatus;
      if (visibilityChanged) body.is_public = draftIsPublic === 'true' ? 1 : 0;

      const response = await authFetch(`/api/tickets/admin/${selectedTicket.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error();

      toast.success('Perubahan tiket berhasil disimpan!');

      // Update local selected ticket state
      setSelectedTicket({
        ...selectedTicket,
        status: draftStatus,
        is_public: draftIsPublic === 'true' ? 1 : 0,
      });
      fetchTickets(false);
    } catch {
      toast.error('Gagal menyimpan perubahan.');
    } finally {
      setSavingChanges(false);
    }
  };

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
    if (!selectedTicket || (!replyText.trim() && !photoFile)) return;

    setSendingReply(true);
    try {
      const formData = new FormData();
      formData.append('message', replyText.trim());
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const response = await authFetch(`/api/tickets/admin/${selectedTicket.id}/replies`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Gagal mengirim balasan');

      setReplyText('');
      setPhotoFile(null);
      setPhotoPreview(null);
      
      // Fetch latest replies
      await fetchReplies(selectedTicket.id, false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal mengirim pesan');
    } finally {
      setSendingReply(false);
    }
  };

  const copyTicketCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Kode tiket disalin ke clipboard');
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'open') return 'badge-status-open';
    if (s === 'processing') return 'badge-status-processing';
    if (s === 'resolved') return 'badge-status-resolved';
    return 'badge-status-closed';
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
    const query = searchTerm.toLowerCase();
    const matchesSearch = 
      t.ticket_code.toLowerCase().includes(query) ||
      t.reporter_name.toLowerCase().includes(query) ||
      t.reporter_id.toLowerCase().includes(query) ||
      t.title.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query);
      
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <>
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-indigo-400" /> {t('tickets.title')}
          </h2>
          <p className="text-zinc-300 text-xs mt-1">
            Kelola pengaduan jaringan dari mahasiswa & staff kampus ITATS.
          </p>
        </div>
        
        <button
          onClick={() => fetchTickets(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl border border-zinc-800 text-xs font-bold transition-all shadow-md"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Perbarui
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-2">
          <input
            type="text"
            placeholder="Cari berdasarkan Kode, Nama, NIM, atau Judul..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 placeholder:text-zinc-400 text-xs rounded-xl pl-9 pr-4 py-3 outline-none focus:border-indigo-500 transition-all"
          />
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-3 outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all" className="bg-zinc-900 text-zinc-300">{t('common.all')}</option>
            <option value="open" className="bg-zinc-900 text-zinc-300">{t('tickets.open')}</option>
            <option value="processing" className="bg-zinc-900 text-zinc-300">{t('tickets.inProgress')}</option>
            <option value="resolved" className="bg-zinc-900 text-zinc-300">{t('tickets.resolved')}</option>
            <option value="closed" className="bg-zinc-900 text-zinc-300">{t('tickets.closed')}</option>
          </select>
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-3 outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">{t('common.all')}</option>
            <option value="wifi">Wi-Fi</option>
            <option value="lan">LAN</option>
            <option value="slow_internet">Internet Lambat</option>
            <option value="portal_login">Login Portal</option>
            <option value="other">Lainnya</option>
          </select>
        </div>
      </div>

      {/* Master-Detail Split Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-250px)] min-h-[500px]">
        
        {/* Left Column: Tickets List (4/12 width) */}
        <div className={`lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-sm ${selectedTicket ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Daftar Tiket ({filteredTickets.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800 custom-scrollbar">
            {loading && tickets.length === 0 ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-10 text-center">
                <AlertCircle className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
                <p className="text-zinc-400 text-xs">Tidak ada tiket yang cocok dengan filter.</p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-4 flex flex-col gap-2 hover:bg-zinc-900/30 cursor-pointer transition-all ${
                      isSelected ? 'bg-indigo-500/5 border-l-2 border-indigo-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {t.is_read === 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" title="Belum dibaca" />
                        )}
                        <span className="text-[10px] font-mono text-zinc-300 font-bold uppercase tracking-wider truncate">{t.ticket_code}</span>
                      </div>
                      <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadge(t.status)}`}>
                        {t.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-white text-xs truncate">{t.title}</h4>
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5">{t.description}</p>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-zinc-500 font-mono mt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {t.reporter_name.split(' ')[0]} ({t.reporter_id})
                      </span>
                      <span>
                        {new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Ticket Detailed Chat Thread & Status Actions (7/12 width) */}
        <div className={`lg:col-span-7 flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden relative shadow-sm ${selectedTicket ? 'flex' : 'hidden lg:flex'}`}>
          
          {selectedTicket ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Back button for mobile view */}
              <div className="p-5 bg-zinc-900 border-b border-zinc-800 flex flex-col gap-4">
                <button 
                  onClick={() => setSelectedTicket(null)}
                  className="lg:hidden flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar
                </button>

                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm truncate leading-snug">{selectedTicket.title}</h3>
                      <button 
                        onClick={() => window.open(`/ticket/${selectedTicket.ticket_code}`, '_blank')}
                        className="text-zinc-400 hover:text-white transition-colors"
                        title="Buka link publik tiket"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-zinc-400 font-mono">
                      <span className="text-indigo-400 font-bold flex items-center gap-1.5">
                        {selectedTicket.ticket_code}
                        <Copy className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => copyTicketCode(selectedTicket.ticket_code)} />
                      </span>
                      <span>•</span>
                      <span className="text-zinc-300">{selectedTicket.reporter_name} ({selectedTicket.reporter_id})</span>
                      {selectedTicket.reporter_email && selectedTicket.reporter_email !== "" && selectedTicket.reporter_email.includes('@') && (
                        <>
                          <span>•</span>
                          <span className="text-zinc-400">{selectedTicket.reporter_email}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Controls Dropdown selectors */}
                  <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    {/* Visibility Dropdown selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Visibilitas:</span>
                      <select
                        value={draftIsPublic}
                        onChange={(e) => setDraftIsPublic(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 text-[10px] font-bold uppercase rounded-lg px-2 py-1 outline-none cursor-pointer text-zinc-300"
                      >
                        <option value="true" className="bg-zinc-900 text-zinc-300">Publik</option>
                        <option value="false" className="bg-zinc-900 text-zinc-300">Privat</option>
                      </select>
                    </div>

                    {/* Status Dropdown selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status:</span>
                      <select
                        value={draftStatus}
                        onChange={(e) => setDraftStatus(e.target.value)}
                        className={`bg-zinc-900 border text-[10px] font-bold uppercase rounded-lg px-2.5 py-1 outline-none cursor-pointer ${
                          draftStatus === 'open' ? 'status-select-open' :
                          draftStatus === 'processing' ? 'status-select-processing' :
                          draftStatus === 'resolved' ? 'status-select-resolved' :
                          'status-select-closed'
                        }`}
                      >
                        <option value="open" className="bg-zinc-900 text-rose-500">{t('tickets.open')}</option>
                        <option value="processing" className="bg-zinc-900 text-amber-500">{t('tickets.inProgress')}</option>
                        <option value="resolved" className="bg-zinc-900 text-emerald-500">{t('tickets.resolved')}</option>
                        <option value="closed" className="bg-zinc-900 text-zinc-500">{t('tickets.closed')}</option>
                      </select>
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={handleSaveChanges}
                      disabled={savingChanges}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        (draftStatus !== selectedTicket.status || (draftIsPublic === 'true') !== Boolean(selectedTicket.is_public))
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      {savingChanges ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      {savingChanges ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </div>
              </div>


              {/* Chat Thread Messages Box */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-zinc-950">
                {/* Initial Reporter description card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">{t('tickets.description')}</p>
                  <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
                  
                  {selectedTicket.photo_url && (
                    <div className="mt-3">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Attached Photo:</p>
                      <button
                        type="button"
                        onClick={() => openLightbox(selectedTicket.photo_url!.startsWith('http') ? selectedTicket.photo_url! : `${import.meta.env.VITE_API_URL || ''}${selectedTicket.photo_url!}`)}
                        className="inline-block rounded-lg overflow-hidden border border-zinc-800 bg-black/40 group relative cursor-zoom-in"
                      >
                        <img 
                          src={selectedTicket.photo_url.startsWith('http') ? selectedTicket.photo_url : `${import.meta.env.VITE_API_URL || ''}${selectedTicket.photo_url}`} 
                          alt="Ticket original attachment" 
                          className="max-h-36 object-cover group-hover:brightness-90 transition-all"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-lg">
                          <span className="text-[10px] font-bold text-white">🔍 Perbesar</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {repliesLoading && replies.length === 0 ? (
                  <div className="flex justify-center items-center py-10">
                    <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  replies.map((reply) => {
                    const isAdmin = reply.sender_type === 'admin';
                    return (
                      <div key={reply.id} className={`flex gap-3 max-w-[85%] ${isAdmin ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                        {/* Avatar */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                          isAdmin 
                            ? 'bg-indigo-600 border-indigo-500 text-white' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}>
                          <User className="w-3.5 h-3.5" />
                        </div>
                        
                        <div className="space-y-0.5">
                          <span className={`text-[9px] font-bold block ${isAdmin ? 'text-indigo-400 text-right' : 'text-zinc-500'}`}>
                            {reply.sender_name} {isAdmin && '(Admin)'}
                          </span>
                          
                          <div className={`rounded-xl p-3 text-xs border ${
                            isAdmin 
                              ? 'bg-indigo-600/10 border-indigo-500/25 text-zinc-100 rounded-tr-none' 
                              : 'bg-zinc-900 border-zinc-800 text-zinc-300 rounded-tl-none'
                          }`}>
                            {reply.photo_url && (
                              <button
                                type="button"
                                onClick={() => openLightbox(reply.photo_url!.startsWith('http') ? reply.photo_url! : `${import.meta.env.VITE_API_URL || ''}${reply.photo_url!}`)}
                                className="block rounded-lg overflow-hidden border border-black/10 bg-black/20 mb-2 max-w-xs group relative cursor-zoom-in"
                              >
                                <img 
                                  src={reply.photo_url.startsWith('http') ? reply.photo_url : `${import.meta.env.VITE_API_URL || ''}${reply.photo_url}`}
                                  alt="Reply attachment" 
                                  className="max-h-40 w-full object-cover group-hover:brightness-90 transition-all"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-lg">
                                  <span className="text-[10px] font-bold text-white">🔍 Perbesar</span>
                                </div>
                              </button>
                            )}
                            <p className="leading-relaxed whitespace-pre-wrap">{reply.message}</p>
                            <span className="text-[8px] text-zinc-500 block mt-1 text-right font-mono">
                              {new Date(reply.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Photo attachment preview above input */}
              {photoPreview && (
                <div className="px-5 py-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img 
                      src={photoPreview} 
                      alt="Attachment Preview" 
                      className="w-12 h-12 object-cover rounded-lg border border-white/10"
                    />
                    <div>
                      <p className="text-[11px] text-zinc-300 font-bold">Foto Balasan Siap Dikirim</p>
                      <p className="text-[9px] text-zinc-500 font-mono">{(photoFile!.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button 
                    onClick={removePhoto} 
                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Input Footer for Admin Replies */}
              <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                <form onSubmit={handleSendReply} className="flex items-center gap-3">
                  {/* Photo Upload Icon */}
                  <label className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-xl cursor-pointer transition-all shrink-0">
                    <ImageIcon className="w-4 h-4" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange}
                      disabled={sendingReply}
                    />
                  </label>

                  {/* Input field */}
                  <input 
                    type="text" 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Tulis balasan Anda sebagai Administrator..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all placeholder:text-zinc-400"
                    disabled={sendingReply}
                  />

                  {/* Send Button */}
                  <button 
                    type="submit"
                    disabled={sendingReply || (!replyText.trim() && !photoFile)}
                    className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl transition-all shrink-0 shadow-lg shadow-indigo-600/15"
                  >
                    {sendingReply ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center p-10 text-center">
              <MessageSquare className="w-12 h-12 text-zinc-800 mb-4 animate-bounce" />
              <h3 className="font-bold text-zinc-300 text-sm">Pilih Laporan Tiket</h3>
              <p className="text-zinc-500 text-xs max-w-sm mt-1">
                Silakan pilih salah satu tiket dari panel daftar di sebelah kiri untuk melihat detail, riwayat obrolan, dan membalas pesan.
              </p>
            </div>
          )}

        </div>

      </div>

    </div>

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
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all backdrop-blur-sm"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] text-white/40 font-mono select-none pointer-events-none">
            Klik di luar gambar atau tekan Esc untuk menutup
          </p>
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
    </>
  );
}
