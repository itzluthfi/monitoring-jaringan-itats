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
  Copy, 
  ExternalLink
} from 'lucide-react';
import { authFetch } from '../lib/authFetch';
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

export default function TicketsView() {
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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const handleUpdateStatus = async (ticketId: number, newStatus: string) => {
    try {
      const response = await authFetch(`/api/tickets/admin/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error();

      toast.success(`Status tiket diubah menjadi ${newStatus.toUpperCase()}`);
      
      // Update selected ticket status locally
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
      
      // Refresh list
      fetchTickets(false);
    } catch (err) {
      toast.error('Gagal memperbarui status tiket');
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
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-indigo-400" /> Trouble Reports & Tickets
          </h2>
          <p className="text-zinc-400 text-xs mt-1">
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
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 placeholder:text-zinc-650 text-xs rounded-xl pl-9 pr-4 py-3 outline-none focus:border-indigo-500 transition-all"
          />
          <Search className="w-4 h-4 text-zinc-650 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-3 outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="open">Open</option>
            <option value="processing">Processing</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-3 outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">Semua Kategori</option>
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
        <div className="lg:col-span-5 bg-zinc-950/40 border border-zinc-900 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 bg-zinc-950/60 border-b border-zinc-900 flex justify-between items-center">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Daftar Tiket ({filteredTickets.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-900 custom-scrollbar">
            {loading && tickets.length === 0 ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-10 text-center">
                <AlertCircle className="w-8 h-8 text-zinc-650 mx-auto mb-3" />
                <p className="text-zinc-500 text-xs">Tidak ada tiket yang cocok dengan filter.</p>
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
                      <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">{t.ticket_code}</span>
                      <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border ${getStatusBadge(t.status)}`}>
                        {t.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-white text-xs truncate">{t.title}</h4>
                      <p className="text-[10px] text-zinc-500 truncate mt-0.5">{t.description}</p>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-zinc-600 font-mono mt-1">
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
        <div className="lg:col-span-7 flex flex-col bg-zinc-950/40 border border-zinc-900 rounded-2xl overflow-hidden relative">
          
          {selectedTicket ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Ticket Details Panel Header */}
              <div className="p-5 bg-zinc-950/60 border-b border-zinc-900 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm truncate leading-snug">{selectedTicket.title}</h3>
                    <button 
                      onClick={() => window.open(`/ticket/${selectedTicket.ticket_code}`, '_blank')}
                      className="text-zinc-500 hover:text-white transition-colors"
                      title="Buka link publik tiket"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-zinc-500 font-mono">
                    <span className="text-indigo-400 font-bold flex items-center gap-1.5">
                      {selectedTicket.ticket_code}
                      <Copy className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => copyTicketCode(selectedTicket.ticket_code)} />
                    </span>
                    <span>•</span>
                    <span className="text-zinc-400">{selectedTicket.reporter_name} ({selectedTicket.reporter_id})</span>
                    <span>•</span>
                    <span className="text-zinc-450">{selectedTicket.reporter_email}</span>
                  </div>
                </div>

                {/* Status Dropdown selector */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status:</span>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleUpdateStatus(selectedTicket.id, e.target.value)}
                    className={`bg-zinc-900 border text-[10px] font-bold uppercase rounded-lg px-2.5 py-1.5 outline-none cursor-pointer ${
                      selectedTicket.status === 'open' ? 'border-rose-500/40 text-rose-400' :
                      selectedTicket.status === 'processing' ? 'border-amber-500/40 text-amber-400' :
                      selectedTicket.status === 'resolved' ? 'border-emerald-500/40 text-emerald-400' :
                      'border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <option value="open" className="bg-zinc-950 text-rose-450">Open</option>
                    <option value="processing" className="bg-zinc-950 text-amber-450">Processing</option>
                    <option value="resolved" className="bg-zinc-950 text-emerald-450">Resolved</option>
                    <option value="closed" className="bg-zinc-950 text-zinc-450">Closed</option>
                  </select>
                </div>
              </div>

              {/* Chat Thread Messages Box */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-zinc-950/10">
                {/* Initial Reporter description card */}
                <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-4 mb-4">
                  <p className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest mb-1.5">Original Issue Description</p>
                  <p className="text-xs text-zinc-350 leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
                  
                  {selectedTicket.photo_url && (
                    <div className="mt-3">
                      <p className="text-[9px] font-bold text-zinc-650 uppercase tracking-wider mb-2">Attached Photo:</p>
                      <a 
                        href={selectedTicket.photo_url.startsWith('http') ? selectedTicket.photo_url : `${import.meta.env.VITE_API_URL || ''}${selectedTicket.photo_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block rounded-lg overflow-hidden border border-zinc-800 bg-black/40"
                      >
                        <img 
                          src={selectedTicket.photo_url.startsWith('http') ? selectedTicket.photo_url : `${import.meta.env.VITE_API_URL || ''}${selectedTicket.photo_url}`} 
                          alt="Ticket original attachment" 
                          className="max-h-36 object-cover"
                        />
                      </a>
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
                            ? 'bg-indigo-650 border-indigo-500 text-white' 
                            : 'bg-zinc-850 border-zinc-800 text-zinc-400'
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
                              <a 
                                href={reply.photo_url.startsWith('http') ? reply.photo_url : `${import.meta.env.VITE_API_URL || ''}${reply.photo_url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg overflow-hidden border border-black/10 bg-black/20 mb-2 max-w-xs"
                              >
                                <img 
                                  src={reply.photo_url.startsWith('http') ? reply.photo_url : `${import.meta.env.VITE_API_URL || ''}${reply.photo_url}`}
                                  alt="Reply attachment" 
                                  className="max-h-40 w-full object-cover"
                                />
                              </a>
                            )}
                            <p className="leading-relaxed whitespace-pre-wrap">{reply.message}</p>
                            <span className="text-[8px] text-zinc-550 block mt-1 text-right font-mono">
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
                <div className="px-5 py-3 bg-zinc-950/80 border-t border-zinc-900 flex items-center justify-between gap-3">
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
              <div className="p-4 bg-zinc-950/50 border-t border-zinc-900">
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
                    className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all placeholder:text-zinc-650"
                    disabled={sendingReply}
                  />

                  {/* Send Button */}
                  <button 
                    type="submit"
                    disabled={sendingReply || (!replyText.trim() && !photoFile)}
                    className="p-3 bg-indigo-650 hover:bg-indigo-550 disabled:bg-zinc-850 disabled:text-zinc-600 text-white rounded-xl transition-all shrink-0 shadow-lg shadow-indigo-650/15"
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
              <h3 className="font-bold text-zinc-400 text-sm">Pilih Laporan Tiket</h3>
              <p className="text-zinc-600 text-xs max-w-sm mt-1">
                Silakan pilih salah satu tiket dari panel daftar di sebelah kiri untuk melihat detail, riwayat obrolan, dan membalas pesan.
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
