import React, { useEffect, useState, useCallback } from 'react';
import {
  Settings as SettingsIcon, Save, Shield, BrainCircuit, Trash2, Clock, Globe, Moon, Sun,
  Volume2, Play, MessageSquare, Plus, Check, Activity, Link2, User, UserPlus, Eye, EyeOff,
  MailCheck, KeyRound, Pencil, UserX, RefreshCw, Lock, BookOpen, Smartphone
} from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { Loader } from '../components/common/Loader';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  role: 'admin' | 'viewer';
  is_active: 0 | 1;
  last_login: string | null;
  created_at: string;
}

interface SoundEntry {
  id: number;
  name: string;
  url: string;
  isActive: boolean;
}

// ─── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'general',      label: 'General',      icon: SettingsIcon },
  { id: 'monitoring',   label: 'Monitoring',   icon: Activity },
  { id: 'audio',        label: 'Audio',        icon: Volume2 },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'security',     label: 'Security',     icon: Shield },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const maskSecret = (val: string) =>
  val.length > 8 ? `${val.slice(0, 4)}${'•'.repeat(val.length - 8)}${val.slice(-4)}` : '••••••••';

// ─── Main Component ────────────────────────────────────────────────────────────
export function SettingsView() {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(
    () => (localStorage.getItem('settings_tab') as TabId) || 'general'
  );

  // ── General state ──
  const [pollingRate, setPollingRate]   = useState(10);
  const [theme, setTheme]               = useState(localStorage.getItem('theme') || 'dark');

  // ── Monitoring state ──
  const [aiEnabled, setAiEnabled]         = useState(true);
  const [retentionDays, setRetentionDays] = useState(30);
  const [simulationMode, setSimulationMode] = useState(false);

  // ── Audio state ──
  const [notificationSounds, setNotificationSounds] = useState<SoundEntry[]>([]);
  const [newSoundName, setNewSoundName] = useState('');
  const [newSoundUrl, setNewSoundUrl]   = useState('');

  // ── Integration state ──
  const [telegramToken, setTelegramToken]   = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [revealToken, setRevealToken]       = useState(false);
  const [manualApiUrl, setManualApiUrl]     = useState(localStorage.getItem('API_SERVER_URL') || '');

  // ── Security: Change my password ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [changingPwd, setChangingPwd]         = useState(false);

  // ── Security: Admin CRUD ──
  const [admins, setAdmins]           = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin]         = useState({ username: '', password: '', email: '', role: 'admin' as 'admin' | 'viewer' });
  const [addingAdmin, setAddingAdmin]   = useState(false);
  const [editAdmin, setEditAdmin]       = useState<AdminUser | null>(null);

  // ── Security: Forgot/Reset password ──
  const [fpUsername, setFpUsername]   = useState('');
  const [fpOtp, setFpOtp]             = useState('');
  const [fpNewPwd, setFpNewPwd]       = useState('');
  const [fpMaskedEmail, setFpMaskedEmail] = useState('');
  const [fpSent, setFpSent]           = useState(false);
  const [fpLoading, setFpLoading]     = useState(false);

  // ─── Fetch all settings ─────────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    try {
      const [aiRes, retRes, soundRes, teleTokenRes, teleChatRes, simRes] = await Promise.all([
        authFetch('/api/settings/ai_analysis_enabled'),
        authFetch('/api/settings/log_retention_days'),
        authFetch('/api/settings/notification_sounds'),
        authFetch('/api/settings/telegram_bot_token'),
        authFetch('/api/settings/telegram_chat_id'),
        authFetch('/api/settings/simulation_mode'),
      ]);
      if (aiRes.ok)        setAiEnabled((await aiRes.json()).value !== 'false');
      if (retRes.ok)       setRetentionDays(parseInt((await retRes.json()).value || '30'));
      if (soundRes.ok)     { const d = await soundRes.json(); if (d.value) setNotificationSounds(JSON.parse(d.value)); }
      if (teleTokenRes.ok) setTelegramToken((await teleTokenRes.json()).value || '');
      if (teleChatRes.ok)  setTelegramChatId((await teleChatRes.json()).value || '');
      if (simRes.ok)       setSimulationMode((await simRes.json()).value === 'true');
      const lp = localStorage.getItem('notification_polling');
      if (lp) setPollingRate(parseInt(lp));
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdmins = useCallback(async () => {
    setLoadingAdmins(true);
    try {
      const res = await authFetch('/api/admins');
      if (res.ok) setAdmins(await res.json());
    } catch { /* handled */ } finally {
      setLoadingAdmins(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { if (activeTab === 'security') fetchAdmins(); }, [activeTab, fetchAdmins]);

  const switchTab = (id: TabId) => {
    setActiveTab(id);
    localStorage.setItem('settings_tab', id);
  };

  // ─── Save general/monitoring/audio/integrations ─────────────────────────────
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('notification_polling', String(pollingRate));
      
      if (manualApiUrl) {
        // Validasi format URL sederhana
        if (!manualApiUrl.startsWith('http')) {
           toast.error('URL Backend harus diawali dengan http:// atau https://');
           setSaving(false);
           return;
        }
        localStorage.setItem('API_SERVER_URL', manualApiUrl);
      } else {
        localStorage.removeItem('API_SERVER_URL');
      }

      const post = (key: string, value: string) =>
        authFetch(`/api/settings/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }) });

      await Promise.all([
        post('ai_analysis_enabled', String(aiEnabled)),
        post('log_retention_days', String(retentionDays)),
        post('notification_sounds', JSON.stringify(notificationSounds)),
        post('telegram_bot_token', telegramToken),
        post('telegram_chat_id', telegramChatId),
        post('simulation_mode', String(simulationMode)),
      ]);
      toast.success('Pengaturan berhasil disimpan!');
    } catch { toast.error('Gagal menyimpan pengaturan'); }
    finally { setSaving(false); }
  };

  // ─── Audio handlers ─────────────────────────────────────────────────────────
  const handleAddSound = () => {
    if (!newSoundName || !newSoundUrl) return toast.error('Isi nama dan URL audio');
    setNotificationSounds(prev => [...prev, { id: Date.now(), name: newSoundName, url: newSoundUrl, isActive: prev.length === 0 }]);
    setNewSoundName(''); setNewSoundUrl('');
  };
  const playPreview = (url: string) => new Audio(url).play().catch(() => toast.error('Gagal memutar audio'));
  const setActiveSound = (id: number) => setNotificationSounds(prev => prev.map(s => ({ ...s, isActive: s.id === id })));
  const deleteSound = (id: number) => setNotificationSounds(prev => prev.filter(s => s.id !== id));

  // ─── Password handlers ───────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return toast.error('Isi semua field password');
    if (newPassword.length < 6) return toast.error('Password baru minimal 6 karakter');
    setChangingPwd(true);
    try {
      const res = await authFetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Password berhasil diubah!');
      setCurrentPassword(''); setNewPassword('');
    } catch (e: any) { toast.error(e.message); } finally { setChangingPwd(false); }
  };

  // ─── Admin CRUD handlers ─────────────────────────────────────────────────────
  const handleAddAdmin = async () => {
    if (!newAdmin.username || !newAdmin.password) return toast.error('Username dan password wajib');
    setAddingAdmin(true);
    try {
      const res = await authFetch('/api/admins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAdmin) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Admin "${newAdmin.username}" berhasil ditambahkan`);
      setNewAdmin({ username: '', password: '', email: '', role: 'admin' });
      setShowAddAdmin(false);
      fetchAdmins();
    } catch (e: any) { toast.error(e.message); } finally { setAddingAdmin(false); }
  };

  const handleToggleActive = async (admin: AdminUser) => {
    try {
      const res = await authFetch(`/api/admins/${admin.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: admin.is_active ? 0 : 1 }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      fetchAdmins();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSaveEditAdmin = async () => {
    if (!editAdmin) return;
    try {
      const res = await authFetch(`/api/admins/${editAdmin.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: editAdmin.email, role: editAdmin.role }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success('Admin diperbarui');
      setEditAdmin(null);
      fetchAdmins();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteAdmin = async (admin: AdminUser) => {
    const result = await Swal.fire({ title: `Hapus admin "${admin.username}"?`, text: 'Tindakan ini tidak bisa dibatalkan.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#3f3f46', confirmButtonText: 'Hapus', background: '#18181b', color: '#fff' });
    if (!result.isConfirmed) return;
    try {
      const res = await authFetch(`/api/admins/${admin.id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(`Admin "${admin.username}" dihapus`);
      fetchAdmins();
    } catch (e: any) { toast.error(e.message); }
  };

  // ─── Forgot password flow ────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!fpUsername) return toast.error('Masukkan username');
    setFpLoading(true);
    try {
      const res = await authFetch('/api/admins/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: fpUsername }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setFpMaskedEmail(d.maskedEmail || '');
      setFpSent(true);
      toast.success('OTP dikirim ke email!');
    } catch (e: any) { toast.error(e.message); } finally { setFpLoading(false); }
  };

  const handleResetPassword = async () => {
    if (!fpOtp || !fpNewPwd) return toast.error('Isi OTP dan password baru');
    if (fpNewPwd.length < 6) return toast.error('Password minimal 6 karakter');
    setFpLoading(true);
    try {
      const res = await authFetch('/api/admins/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: fpUsername, otp: fpOtp, newPassword: fpNewPwd }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success('Password berhasil direset!');
      setFpSent(false); setFpUsername(''); setFpOtp(''); setFpNewPwd(''); setFpMaskedEmail('');
    } catch (e: any) { toast.error(e.message); } finally { setFpLoading(false); }
  };

  // ─── Danger ─────────────────────────────────────────────────────────────────
  const flushNotifications = async () => {
    const res = await Swal.fire({ title: 'Flush Notifications?', text: 'Semua riwayat notifikasi akan dihapus permanen.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#3f3f46', confirmButtonText: 'Ya, hapus', background: '#18181b', color: '#fff' });
    if (res.isConfirmed) {
      try { const d = await authFetch('/api/notifications', { method: 'DELETE' }); if (d.ok) toast.success('Notifikasi dibersihkan'); else throw new Error(); } catch { toast.error('Gagal'); }
    }
  };
  const flushLogs = async () => {
    const res = await Swal.fire({ title: 'Flush Telemetry Logs?', text: 'Semua log dari semua perangkat akan dihapus.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#3f3f46', confirmButtonText: 'Bersihkan', background: '#18181b', color: '#fff' });
    if (res.isConfirmed) {
      try { const d = await authFetch('/api/logs', { method: 'DELETE' }); if (d.ok) toast.success('Log telemetri dihapus'); else throw new Error(); } catch { toast.error('Gagal'); }
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <div className="flex-1 flex items-center justify-center p-8"><Loader message="Memuat konfigurasi sistem..." /></div>;

  const SaveButton = () => (
    <button onClick={handleSaveAll} disabled={saving} className="group flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm">
      {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4 group-hover:rotate-12 transition-transform" />}
      {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
    </button>
  );

  const SectionTitle = ({ icon: Icon, color, label }: { icon: any; color: string; label: string }) => (
    <h3 className={`text-base font-bold text-white mb-5 flex items-center gap-2 pt-5 border-t border-white/5 first:pt-0 first:border-t-0`}>
      <Icon className={`w-4 h-4 ${color}`} /> {label}
    </h3>
  );

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange} className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${value ? 'bg-indigo-600' : 'bg-zinc-700'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  const inputCls = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-zinc-600";

  return (
    <div className="p-6 md:p-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white tracking-tight">Settings & Preferences</h2>
        <p className="text-zinc-400 mt-1 text-sm">Kelola konfigurasi portal dan kebijakan sistem secara menyeluruh.</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-zinc-900/70 border border-white/5 rounded-2xl p-1 mb-8 overflow-x-auto scrollbar-hide">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex-shrink-0
              ${activeTab === id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <Icon className="w-4 h-4" /> {label}
            {id === 'security' && admins.length > 0 && (
              <span className="ml-1 bg-white/20 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{admins.filter(a => a.is_active).length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="max-w-3xl">
        {/* ── TAB: GENERAL ─────────────────────────────────────────────────────── */}
        {activeTab === 'general' && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
            <SectionTitle icon={Globe} color="text-indigo-400" label="Interface & Polling" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Notification Polling</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input type="number" value={pollingRate} onChange={e => setPollingRate(parseInt(e.target.value))} className={`${inputCls} pl-10`} placeholder="Interval seconds" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-bold">SEC</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Visual Theme</label>
                <div className="relative">
                  {theme === 'dark' ? <Moon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" /> : <Sun className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />}
                  <select value={theme} onChange={e => setTheme(e.target.value)} className={`${inputCls} pl-10 appearance-none`}>
                    <option value="dark">Deep Space (Dark)</option>
                    <option value="light">Pure Arctic (Light)</option>
                  </select>
                </div>
              </div>
            </div>
            <SaveButton />
          </div>
        )}

        {/* ── TAB: MONITORING ───────────────────────────────────────────────────── */}
        {activeTab === 'monitoring' && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
            <SectionTitle icon={BrainCircuit} color="text-purple-400" label="AI Monitoring Engine" />
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
              <div>
                <p className="text-sm font-bold text-white">Nexus Intelligence Analytics</p>
                <p className="text-xs text-zinc-500 mt-0.5">Prediksi kemacetan trafik & generate insight.</p>
              </div>
              <Toggle value={aiEnabled} onChange={() => setAiEnabled(!aiEnabled)} />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Telemetry Retention Policy</label>
              <div className="flex items-center gap-4">
                <input type="range" min="1" max="180" value={retentionDays} onChange={e => setRetentionDays(parseInt(e.target.value))} className="flex-1 accent-indigo-500" />
                <div className="bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-xl border border-indigo-500/20 text-sm font-bold min-w-[90px] text-center">{retentionDays} Hari</div>
              </div>
              <p className="text-[10px] text-zinc-600 mt-2 italic">Log lebih dari {retentionDays} hari akan otomatis dipangkas oleh background worker.</p>
            </div>

            <SectionTitle icon={SettingsIcon} color="text-emerald-400" label="Platform Modifiers" />
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 gap-4">
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Simulation Mode (Demo)</p>
                <p className="text-xs text-zinc-500 mt-0.5">Aktifkan data telemetri tiruan untuk kebutuhan presentasi. Membutuhkan restart server.</p>
              </div>
              <Toggle value={simulationMode} onChange={() => setSimulationMode(!simulationMode)} />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <SaveButton />
              <button onClick={flushNotifications} className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 border border-rose-500/20 font-bold text-xs">
                <Trash2 className="w-4 h-4" /> Flush Notifications
              </button>
              <button onClick={flushLogs} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 text-zinc-400 rounded-xl hover:bg-rose-500 hover:text-white border border-white/5 font-bold text-xs transition-all">
                <Trash2 className="w-4 h-4" /> Flush MikroTik Logs
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: AUDIO ────────────────────────────────────────────────────────── */}
        {activeTab === 'audio' && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
            <SectionTitle icon={Volume2} color="text-pink-400" label="Notification Audio" />
            <p className="text-xs text-zinc-400">Atur suara notifikasi kustom. Jika kosong, sistem pakai suara default bawaan.</p>

            {notificationSounds.length === 0 && (
              <div className="text-center p-8 border border-dashed border-white/10 rounded-2xl text-zinc-600 text-sm">
                Belum ada suara kustom. Tambahkan di bawah.
              </div>
            )}

            <div className="space-y-2">
              {notificationSounds.map(s => (
                <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border ${s.isActive ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-black/20 border-white/5'} transition-all`}>
                  <button onClick={() => playPreview(s.url)} className="p-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-lg transition-colors flex-shrink-0"><Play className="w-3.5 h-3.5 fill-current" /></button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{s.name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{s.url}</p>
                  </div>
                  <div className="flex items-center gap-2 pl-2">
                    <button onClick={() => setActiveSound(s.id)} className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all ${s.isActive ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}>
                      {s.isActive && <Check className="w-3 h-3" />} {s.isActive ? 'Aktif' : 'Set Aktif'}
                    </button>
                    <button onClick={() => deleteSound(s.id)} className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
              <h4 className="text-xs font-bold text-zinc-500 uppercase mb-3">Tambah Suara Baru</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="text" value={newSoundName} onChange={e => setNewSoundName(e.target.value)} placeholder="Nama (mis. Sirine)" className={`${inputCls} flex-1`} />
                <input type="url" value={newSoundUrl} onChange={e => setNewSoundUrl(e.target.value)} placeholder="URL Audio (mp3/wav)" className={`${inputCls} flex-[2]`} />
                <button onClick={handleAddSound} className="flex items-center justify-center gap-2 bg-zinc-700 hover:bg-indigo-600 text-white font-bold rounded-xl px-4 py-2 transition-colors text-sm">
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              </div>
            </div>
            <SaveButton />
          </div>
        )}

        {/* ── TAB: INTEGRATIONS ─────────────────────────────────────────────────── */}
        {activeTab === 'integrations' && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
            <SectionTitle icon={MessageSquare} color="text-sky-400" label="Telegram Integration" />
            <p className="text-xs text-zinc-400">Terima peringatan status jaringan langsung ke bot Telegram Anda saat perangkat offline/online.</p>

            <div>
              <label className="text-xs font-bold text-zinc-500 block mb-1.5">Bot Token</label>
              <div className="relative">
                <input type={revealToken ? 'text' : 'password'} value={telegramToken} onChange={e => setTelegramToken(e.target.value)} placeholder="1234567:ABC-DEF..." className={`${inputCls} pr-12`} />
                <button type="button" onClick={() => setRevealToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                  {revealToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {telegramToken && !revealToken && <p className="text-[10px] text-zinc-600 mt-1">Tersimpan: {maskSecret(telegramToken)}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 block mb-1.5">Chat ID Tujuan</label>
              <input type="text" value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} placeholder="ID Pribadi / Grup (mis. -1001234567)" className={inputCls} />
            </div>

            <SectionTitle icon={Smartphone} color="text-emerald-400" label="Mobile Connectivity (Capacitor)" />
            <p className="text-xs text-zinc-400">Gunakan ini jika Anda membuka dashboard dari Aplikasi Android/iOS agar bisa terhubung ke server laptop Anda.</p>
            
            <div>
              <label className="text-xs font-bold text-zinc-500 block mb-1.5">Backend Server URL</label>
              <input 
                type="text" 
                value={manualApiUrl} 
                onChange={e => setManualApiUrl(e.target.value)} 
                placeholder="http://172.18.xxx.xxx:3000" 
                className={inputCls} 
              />
              <p className="text-[10px] text-zinc-600 mt-2 italic">
                * Kosongkan jika hanya menggunakan Browser di laptop yang sama (otomatis pakai localhost).
              </p>
            </div>
            <SaveButton />
          </div>
        )}

        {/* ── TAB: SECURITY ─────────────────────────────────────────────────────── */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Admin Users Table */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-violet-400" /> Admin Users
                  <span className="text-xs font-normal text-zinc-500 ml-1">— {admins.filter(a => a.is_active).length} aktif dari {admins.length}</span>
                </h3>
                <button onClick={() => setShowAddAdmin(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-violet-600/20">
                  <UserPlus className="w-3.5 h-3.5" /> Tambah Admin
                </button>
              </div>

              {/* Add admin form */}
              {showAddAdmin && (
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 mb-4 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase">Form Admin Baru</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" value={newAdmin.username} onChange={e => setNewAdmin(p => ({...p, username: e.target.value}))} placeholder="Username" className={inputCls} />
                    <input type="password" value={newAdmin.password} onChange={e => setNewAdmin(p => ({...p, password: e.target.value}))} placeholder="Password (min. 6 karakter)" className={inputCls} />
                    <input type="email" value={newAdmin.email} onChange={e => setNewAdmin(p => ({...p, email: e.target.value}))} placeholder="Email (opsional)" className={inputCls} />
                    <select value={newAdmin.role} onChange={e => setNewAdmin(p => ({...p, role: e.target.value as any}))} className={`${inputCls} appearance-none`}>
                      <option value="admin">Admin (Full Access)</option>
                      <option value="viewer">Viewer (Read Only)</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddAdmin} disabled={addingAdmin} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-xs disabled:opacity-50">
                      {addingAdmin ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Simpan Admin
                    </button>
                    <button onClick={() => setShowAddAdmin(false)} className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold hover:bg-zinc-700">Batal</button>
                  </div>
                </div>
              )}

              {/* Edit admin form */}
              {editAdmin && (
                <div className="bg-indigo-500/5 rounded-2xl p-4 border border-indigo-500/20 mb-4 space-y-3">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase">Edit Admin: {editAdmin.username}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="email" value={editAdmin.email || ''} onChange={e => setEditAdmin(p => p ? {...p, email: e.target.value} : null)} placeholder="Email" className={inputCls} />
                    <select value={editAdmin.role} onChange={e => setEditAdmin(p => p ? {...p, role: e.target.value as any} : null)} className={`${inputCls} appearance-none`}>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveEditAdmin} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs">
                      <Save className="w-3.5 h-3.5" /> Simpan
                    </button>
                    <button onClick={() => setEditAdmin(null)} className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold hover:bg-zinc-700">Batal</button>
                  </div>
                </div>
              )}

              {/* Admins list */}
              {loadingAdmins ? (
                <div className="flex justify-center py-8"><Loader message="Memuat daftar admin..." /></div>
              ) : (
                <div className="space-y-2">
                  {admins.map(admin => (
                    <div key={admin.id} className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${admin.is_active ? 'bg-violet-500/20 text-violet-400' : 'bg-zinc-800 text-zinc-600'}`}>
                        {admin.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white">{admin.username}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${admin.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-700 text-zinc-400'}`}>{admin.role}</span>
                          {!admin.is_active && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/20 text-rose-400">NONAKTIF</span>}
                        </div>
                        <p className="text-[10px] text-zinc-600">{admin.email || 'Tidak ada email'}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => handleToggleActive(admin)} className={`p-1.5 rounded-lg transition-colors ${admin.is_active ? 'text-emerald-500 hover:bg-rose-500/10 hover:text-rose-400' : 'text-zinc-600 hover:bg-emerald-500/10 hover:text-emerald-400'}`} title={admin.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditAdmin(admin)} className="p-1.5 text-zinc-600 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteAdmin(admin)} className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Change My Password */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6 shadow-xl">
              <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2"><Lock className="w-4 h-4 text-amber-400" /> Ubah Password Saya</h3>
              <div className="space-y-3">
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Password saat ini" className={inputCls} />
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password baru (min. 6 karakter)" className={inputCls} />
                <button onClick={handleChangePassword} disabled={changingPwd} className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all">
                  {changingPwd ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Perbarui Password
                </button>
              </div>
            </div>

            {/* Forgot Password (OTP) */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6 shadow-xl">
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2"><MailCheck className="w-4 h-4 text-sky-400" /> Reset Password via Email</h3>
              <p className="text-xs text-zinc-500 mb-5">Kirim kode OTP ke email yang terdaftar. Gunakan jika Anda lupa password.</p>

              {!fpSent ? (
                <div className="flex gap-2">
                  <input type="text" value={fpUsername} onChange={e => setFpUsername(e.target.value)} placeholder="Username admin" className={`${inputCls} flex-1`} />
                  <button onClick={handleSendOtp} disabled={fpLoading} className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all flex-shrink-0">
                    {fpLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MailCheck className="w-4 h-4" />} Kirim OTP
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {fpMaskedEmail && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">✓ OTP dikirim ke {fpMaskedEmail}</p>}
                  <input type="text" value={fpOtp} onChange={e => setFpOtp(e.target.value)} placeholder="Masukkan kode OTP (6 digit)" className={inputCls} maxLength={6} />
                  <input type="password" value={fpNewPwd} onChange={e => setFpNewPwd(e.target.value)} placeholder="Password baru (min. 6 karakter)" className={inputCls} />
                  <div className="flex gap-2">
                    <button onClick={handleResetPassword} disabled={fpLoading} className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm">
                      {fpLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Reset Password
                    </button>
                    <button onClick={() => { setFpSent(false); setFpOtp(''); setFpNewPwd(''); }} className="px-4 py-2.5 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 rounded-xl font-bold text-sm">Kirim Ulang</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documentation sidebar equivalent — shown on all tabs */}
        <div className="mt-6 bg-zinc-900/30 border border-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between text-[10px] text-zinc-600">
            <div className="flex items-center gap-2">
              <BookOpen className="w-3 h-3" />
              <span>Portal Build v1.4.3-stable · ITATS Monitoring Group</span>
            </div>
            <span>© 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
