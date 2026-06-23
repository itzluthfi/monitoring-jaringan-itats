import React, { useEffect, useState, useCallback } from 'react';
import {
  Settings as SettingsIcon, Save, Shield, BrainCircuit, Trash2, Clock, Globe, Moon, Sun,
  Volume2, Play, MessageSquare, Plus, Check, Activity, Link2, User, UserPlus, Eye, EyeOff,
  MailCheck, KeyRound, Pencil, UserX, RefreshCw, Lock, BookOpen, Smartphone, X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../lib/authFetch';
import { Loader } from '../components/common/Loader';
import { useLanguage } from '../i18n/LanguageContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';

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
  { id: 'general',      label: 'General',      icon: SettingsIcon }, // Will be translated in render
  { id: 'monitoring',   label: 'Monitoring',   icon: Activity },
  { id: 'ai',           label: 'AI Settings',  icon: BrainCircuit },
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
  const { t } = useTranslation();
  const { language, changeLanguage } = useLanguage();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(
    () => (localStorage.getItem('settings_tab') as TabId) || 'general'
  );

  // ── General state ──
  const [pollingRate, setPollingRate]   = useState(10);
  const [theme, setTheme]               = useState(localStorage.getItem('theme') || 'dark');
  const [appLanguage, setAppLanguage]   = useState(language);

  // ── Monitoring state ──
  const [aiEnabled, setAiEnabled]         = useState(true);
  const [aiMode, setAiMode]               = useState('llm');
  const [aiLlmModel, setAiLlmModel]       = useState('meta/llama-3.3-70b-instruct');
  const [nvidiaApiKey, setNvidiaApiKey]   = useState('');
  const [retentionDays, setRetentionDays] = useState(30);
  const [simulationMode, setSimulationMode] = useState(false);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [loadingAiLogs, setLoadingAiLogs] = useState(false);
  const [selectedAiLog, setSelectedAiLog] = useState<any | null>(null);

  const PRESET_MODELS = [
    'meta/llama-3.3-70b-instruct',
    'deepseek-ai/deepseek-v4-flash',
    'google/gemma-3-12b-it',
    'meta/llama-3.1-8b-instruct',
    'meta/llama-3.1-70b-instruct',
    'microsoft/phi-4-mini-instruct'
  ];
  const [modelSelect, setModelSelect] = useState('meta/llama-3.3-70b-instruct');



  // ── Audio state ──
  const [notificationSounds, setNotificationSounds] = useState<SoundEntry[]>([]);
  const [newSoundName, setNewSoundName] = useState('');
  const [newSoundUrl, setNewSoundUrl]   = useState('');

  // ── Integration state ──
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramToken, setTelegramToken]   = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [revealToken, setRevealToken]       = useState(false);
  const [waEnabled, setWaEnabled]           = useState(false);
  const [sources, setSources]               = useState<any[]>([]);
  const [targets, setTargets]               = useState<any[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [showAddSource, setShowAddSource]   = useState(false);
  const [newSourceName, setNewSourceName]   = useState('');
  const [showAddTarget, setShowAddTarget]   = useState(false);
  const [newTarget, setNewTarget]           = useState({ name: '', phone_number: '' });
  const [editingTarget, setEditingTarget]   = useState<any | null>(null);
  const [activeQrSource, setActiveQrSource] = useState<any | null>(null);
  const [testSourceId, setTestSourceId]     = useState('');
  const [testTargetNum, setTestTargetNum]   = useState('');
  const [testMsgContent, setTestMsgContent] = useState('');
  const [testingWa, setTestingWa]           = useState(false);
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

  const fetchSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const res = await authFetch('/api/whatsapp/sources');
      if (res.ok) {
        const data = await res.json();
        setSources(data);
        if (activeQrSource) {
          const updated = data.find((s: any) => s.id === activeQrSource.id);
          if (updated) {
            setActiveQrSource(updated);
          }
        }
      }
    } catch (err) {
      console.error('Gagal memuat nomor sumber:', err);
    } finally {
      setLoadingSources(false);
    }
  }, [activeQrSource]);

  const fetchTargets = useCallback(async () => {
    setLoadingTargets(true);
    try {
      const res = await authFetch('/api/whatsapp/targets');
      if (res.ok) {
        setTargets(await res.json());
      }
    } catch (err) {
      console.error('Gagal memuat nomor tujuan:', err);
    } finally {
      setLoadingTargets(false);
    }
  }, []);

  useEffect(() => {
    if (waEnabled && activeTab === 'integrations') {
      fetchSources();
      fetchTargets();
      const interval = setInterval(fetchSources, 5000);
      return () => clearInterval(interval);
    }
  }, [waEnabled, activeTab, fetchSources, fetchTargets]);

  const handleAddSource = async () => {
    if (!newSourceName.trim()) return;
    try {
      const res = await authFetch('/api/whatsapp/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSourceName })
      });
      if (res.ok) {
        toast.success('Sumber WhatsApp berhasil ditambahkan!');
        setNewSourceName('');
        setShowAddSource(false);
        fetchSources();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Gagal menambahkan sumber.');
      }
    } catch {
      toast.error('Gagal menghubungi server.');
    }
  };

  const handleDeleteSource = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus sumber WhatsApp ini beserta seluruh sesinya?')) return;
    try {
      const res = await authFetch(`/api/whatsapp/sources/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Sumber WhatsApp dihapus.');
        if (activeQrSource && activeQrSource.id === id) {
          setActiveQrSource(null);
        }
        fetchSources();
      } else {
        toast.error('Gagal menghapus sumber.');
      }
    } catch {
      toast.error('Gagal menghubungi server.');
    }
  };

  const handleToggleSource = async (id: number) => {
    try {
      const res = await authFetch(`/api/whatsapp/sources/${id}/toggle`, { method: 'PUT' });
      if (res.ok) {
        toast.success('Status sumber diperbarui.');
        fetchSources();
      } else {
        toast.error('Gagal memperbarui status sumber.');
      }
    } catch {
      toast.error('Gagal menghubungi server.');
    }
  };

  const handleConnectSource = async (id: number) => {
    try {
      const res = await authFetch(`/api/whatsapp/sources/${id}/connect`, { method: 'POST' });
      if (res.ok) {
        toast.success('Menghubungkan ke WhatsApp Web...');
        fetchSources();
        const src = sources.find(s => s.id === id);
        if (src) setActiveQrSource(src);
      } else {
        toast.error('Gagal memproses koneksi.');
      }
    } catch {
      toast.error('Gagal menghubungi server.');
    }
  };

  const handleDisconnectSource = async (id: number) => {
    try {
      const res = await authFetch(`/api/whatsapp/sources/${id}/disconnect`, { method: 'POST' });
      if (res.ok) {
        toast.success('WhatsApp diputuskan.');
        if (activeQrSource && activeQrSource.id === id) {
          setActiveQrSource(null);
        }
        fetchSources();
      } else {
        toast.error('Gagal memutuskan WhatsApp.');
      }
    } catch {
      toast.error('Gagal menghubungi server.');
    }
  };

  const handleAddTarget = async () => {
    if (!newTarget.name.trim() || !newTarget.phone_number.trim()) {
      toast.error('Nama dan Nomor Telepon diperlukan.');
      return;
    }
    try {
      const res = await authFetch('/api/whatsapp/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTarget)
      });
      if (res.ok) {
        toast.success('Nomor tujuan berhasil ditambahkan!');
        setNewTarget({ name: '', phone_number: '' });
        setShowAddTarget(false);
        fetchTargets();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Gagal menambahkan nomor tujuan.');
      }
    } catch {
      toast.error('Gagal menghubungi server.');
    }
  };

  const handleUpdateTarget = async () => {
    if (!editingTarget.name.trim() || !editingTarget.phone_number.trim()) {
      toast.error('Nama dan Nomor Telepon diperlukan.');
      return;
    }
    try {
      const res = await authFetch(`/api/whatsapp/targets/${editingTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTarget)
      });
      if (res.ok) {
        toast.success('Nomor tujuan berhasil diperbarui!');
        setEditingTarget(null);
        fetchTargets();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Gagal memperbarui nomor tujuan.');
      }
    } catch {
      toast.error('Gagal menghubungi server.');
    }
  };

  const handleToggleTarget = async (id: number) => {
    try {
      const res = await authFetch(`/api/whatsapp/targets/${id}/toggle`, { method: 'PUT' });
      if (res.ok) {
        toast.success('Status penerima diperbarui.');
        fetchTargets();
      } else {
        toast.error('Gagal memperbarui status penerima.');
      }
    } catch {
      toast.error('Gagal menghubungi server.');
    }
  };

  const handleDeleteTarget = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus nomor tujuan ini?')) return;
    try {
      const res = await authFetch(`/api/whatsapp/targets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Nomor tujuan berhasil dihapus.');
        fetchTargets();
      } else {
        toast.error('Gagal menghapus nomor tujuan.');
      }
    } catch {
      toast.error('Gagal menghapus nomor tujuan.');
    }
  };

  const handleTestWhatsAppCustom = async () => {
    if (!testTargetNum.trim()) {
      toast.error('Tentukan nomor tujuan uji coba.');
      return;
    }
    setTestingWa(true);
    try {
      const res = await authFetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: testSourceId || undefined,
          target: testTargetNum,
          message: testMsgContent || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Pesan uji coba berhasil dikirim!');
        setTestMsgContent('');
      } else {
        toast.error(data.error || 'Gagal mengirim pesan uji coba.');
      }
    } catch {
      toast.error('Gagal menghubungi backend.');
    } finally {
      setTestingWa(false);
    }
  };

  // ─── Fetch all settings ─────────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    try {
      const [aiRes, retRes, soundRes, teleEnabledRes, teleTokenRes, teleChatRes, waEnabledRes, simRes, aiModeRes, aiLlmRes, nvKeyRes] = await Promise.all([
        authFetch('/api/settings/ai_analysis_enabled'),
        authFetch('/api/settings/log_retention_days'),
        authFetch('/api/settings/notification_sounds'),
        authFetch('/api/settings/telegram_enabled'),
        authFetch('/api/settings/telegram_bot_token'),
        authFetch('/api/settings/telegram_chat_id'),
        authFetch('/api/settings/wa_enabled'),
        authFetch('/api/settings/simulation_mode'),
        authFetch('/api/settings/ai_mode'),
        authFetch('/api/settings/ai_llm_model'),
        authFetch('/api/settings/nvidia_api_key'),
      ]);
      if (aiRes.ok)          setAiEnabled((await aiRes.json()).value !== 'false');
      if (retRes.ok)         setRetentionDays(parseInt((await retRes.json()).value || '30'));
      if (soundRes.ok)       { const d = await soundRes.json(); if (d.value) setNotificationSounds(JSON.parse(d.value)); }
      if (teleEnabledRes.ok) setTelegramEnabled((await teleEnabledRes.json()).value === 'true');
      if (teleTokenRes.ok)   setTelegramToken((await teleTokenRes.json()).value || '');
      if (teleChatRes.ok)    setTelegramChatId((await teleChatRes.json()).value || '');
      if (waEnabledRes.ok)   setWaEnabled((await waEnabledRes.json()).value === 'true');
      if (simRes.ok)         setSimulationMode((await simRes.json()).value === 'true');
      if (aiModeRes.ok)      setAiMode((await aiModeRes.json()).value || 'llm');
      if (aiLlmRes.ok) {
        const m = (await aiLlmRes.json()).value || 'meta/llama-3.3-70b-instruct';
        setAiLlmModel(m);
        setModelSelect(PRESET_MODELS.includes(m) ? m : 'custom');
      }
      if (nvKeyRes.ok)       setNvidiaApiKey((await nvKeyRes.json()).value || '');
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

  const fetchAiLogs = useCallback(async () => {
    setLoadingAiLogs(true);
    try {
      const res = await authFetch('/api/ai-logs');
      if (res.ok) setAiLogs(await res.json());
    } catch { /* handled */ } finally {
      setLoadingAiLogs(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { if (activeTab === 'security') fetchAdmins(); }, [activeTab, fetchAdmins]);
  useEffect(() => { if (activeTab === 'ai' && aiEnabled) fetchAiLogs(); }, [activeTab, aiEnabled, fetchAiLogs]);


  const switchTab = (id: TabId) => {
    setActiveTab(id);
    localStorage.setItem('settings_tab', id);
  };

  const handleToggleWhatsApp = async (checked: boolean) => {
    setWaEnabled(checked);
    try {
      await authFetch('/api/settings/wa_enabled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: String(checked) })
      });
      if (checked) {
        toast.success('Integrasi WhatsApp diaktifkan secara global.');
        fetchSources();
        fetchTargets();
      } else {
        toast.success('Integrasi WhatsApp dinonaktifkan secara global.');
      }
    } catch (err) {
      toast.error('Gagal mengubah status WhatsApp');
    }
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
        post('telegram_enabled', String(telegramEnabled)),
        post('telegram_bot_token', telegramToken),
        post('telegram_chat_id', telegramChatId),
        post('wa_enabled', String(waEnabled)),
        post('simulation_mode', String(simulationMode)),
        post('app_language', appLanguage),
        post('ai_mode', aiMode),
        post('ai_llm_model', aiLlmModel),
        post('nvidia_api_key', nvidiaApiKey),
      ]);
      // Apply language change
      await changeLanguage(appLanguage);
      toast.success(t('settings.saved'));
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
    <button onClick={handleSaveAll} disabled={saving} className="group force-white-text flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm">
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
                ? 'bg-indigo-600 text-white force-white-text shadow-lg shadow-indigo-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <Icon className="w-4 h-4" /> {id === 'general' ? t('settings.general') : id === 'monitoring' ? t('settings.monitoring') : id === 'ai' ? 'Nexus AI' : id === 'audio' ? t('settings.audio') : id === 'integrations' ? t('settings.integrations') : t('settings.security')}
            {id === 'security' && admins.length > 0 && (
              <span className="ml-1 bg-white/20 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{admins.filter(a => a.is_active).length}</span>
            )}
          </button>
        ))}
      </div>

      <div className={activeTab === 'ai' ? "w-full max-w-7xl" : "max-w-3xl"}>
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
                    <option value="dark">{t('settings.generalTab.darkTheme')}</option>
                    <option value="light">{t('settings.generalTab.lightTheme')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">{t('settings.generalTab.language')}</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  <select value={appLanguage} onChange={e => setAppLanguage(e.target.value)} className={`${inputCls} pl-10 appearance-none`}>
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English</option>
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

        {/* ── TAB: NEXUS AI ──────────────────────────────────────────────────────── */}
        {activeTab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: AI Monitoring Engine configuration (5 cols) */}
            <div className="lg:col-span-5 bg-zinc-900/50 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
              <SectionTitle icon={BrainCircuit} color="text-purple-400" label="AI Monitoring Engine" />
              
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div>
                  <p className="text-sm font-bold text-white">Nexus Intelligence Analytics</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Prediksi kemacetan trafik & generate insight.</p>
                </div>
                <Toggle value={aiEnabled} onChange={() => setAiEnabled(!aiEnabled)} />
              </div>

              {aiEnabled && (
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Model Mode</label>
                    <div className="relative">
                      <select
                        value={aiMode}
                        onChange={(e) => setAiMode(e.target.value)}
                        className={`${inputCls} appearance-none`}
                      >
                        <option value="llm">LLM AI (Cloud / DeepSeek NVIDIA NIM)</option>
                        <option value="tensorflow">Local AI (TensorFlow.js CNN-1D Model)</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed font-semibold">
                      {aiMode === 'llm' 
                        ? 'Menggunakan model LLM di cloud (NVIDIA NIM DeepSeek) untuk menganalisis data telemetri secara deskriptif.' 
                        : 'Menggunakan model CNN-1D lokal yang dilatih secara dinamis pada browser/server Anda.'}
                    </p>
                  </div>

                  {aiMode === 'llm' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-4 border-t border-white/5"
                    >
                      <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">NVIDIA NIM Model</label>
                        <div className="relative mb-3">
                          <select
                            value={modelSelect}
                            onChange={(e) => {
                              const val = e.target.value;
                              setModelSelect(val);
                              if (val !== 'custom') {
                                setAiLlmModel(val);
                              }
                            }}
                            className={`${inputCls} appearance-none`}
                          >
                            <option value="meta/llama-3.3-70b-instruct">Llama 3.3 70B Instruct (General - Fast & Free tier)</option>
                            <option value="deepseek-ai/deepseek-v4-flash">DeepSeek V4 Flash (Very Fast & Efficient - Free tier)</option>
                            <option value="google/gemma-3-12b-it">Gemma 3 12B Instruct (Smart & Free tier)</option>
                            <option value="meta/llama-3.1-8b-instruct">Llama 3.1 8B Instruct (Lightweight & Low Credit Cost)</option>
                            <option value="meta/llama-3.1-70b-instruct">Llama 3.1 70B Instruct (Stable & Free tier)</option>
                            <option value="microsoft/phi-4-mini-instruct">Phi 4 Mini Instruct (Lightweight & Fast - Free tier)</option>
                            <option value="custom">Model Lain / Kustom (Tulis Manual)</option>
                          </select>
                        </div>

                        {modelSelect === 'custom' && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <input
                              type="text"
                              value={aiLlmModel}
                              onChange={(e) => setAiLlmModel(e.target.value)}
                              placeholder="Ketik nama model NVIDIA NIM..."
                              className={inputCls}
                            />
                          </motion.div>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">NVIDIA API Key</label>
                        <input
                          type="password"
                          value={nvidiaApiKey}
                          onChange={(e) => setNvidiaApiKey(e.target.value)}
                          placeholder="nvapi-..."
                          className={inputCls}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              <div className="pt-2">
                <SaveButton />
              </div>
            </div>

            {/* Right Column: Riwayat Aktivitas & Log AI (7 cols) */}
            <div className="lg:col-span-7 bg-zinc-900/50 border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                  <h3 className="text-base font-bold text-white">Riwayat Aktivitas & Log AI</h3>
                </div>
                <button 
                  type="button" 
                  onClick={fetchAiLogs}
                  disabled={loadingAiLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 rounded-xl border border-indigo-500/20 text-[10px] font-bold uppercase transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAiLogs ? 'animate-spin' : ''}`} />
                  {loadingAiLogs ? 'Memuat...' : 'Refresh Log'}
                </button>
              </div>

              {!aiEnabled ? (
                <div className="p-8 text-center bg-black/10 border border-white/5 rounded-2xl">
                  <BrainCircuit className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500 font-semibold">Aktifkan Nexus Intelligence Analytics terlebih dahulu untuk mencatat log aktivitas.</p>
                </div>
              ) : aiLogs.length === 0 ? (
                <div className="p-8 text-center bg-black/10 border border-white/5 rounded-2xl">
                  <Activity className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500 font-semibold">Belum ada riwayat aktivitas prediksi AI yang tercatat.</p>
                </div>
              ) : (
                <div className="border border-white/5 rounded-2xl overflow-hidden bg-zinc-950/20 shadow-inner">
                  <div className="max-h-[460px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-950/60 border-b border-white/5 text-zinc-500 font-mono text-[9px] uppercase tracking-wider">
                          <th className="p-3 w-28">Waktu</th>
                          <th className="p-3">Model Engine</th>
                          <th className="p-3 w-16 text-center">Status</th>
                          <th className="p-3 text-center w-20">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {aiLogs.map((log: any, idx: number) => (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="p-3 text-zinc-500 font-mono text-[10px]">
                              {new Date(log.created_at).toLocaleString('id-ID', {
                                hour: '2-digit', minute: '2-digit', second: '2-digit',
                                day: '2-digit', month: '2-digit'
                              })}
                            </td>
                            <td className="p-3 font-mono text-zinc-300 truncate max-w-[150px] text-[11px]" title={log.model}>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold mr-1.5 uppercase ${
                                log.mode === 'llm' 
                                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {log.mode}
                              </span>
                              {log.model}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold ${
                                log.status === 'success' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {log.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedAiLog(log)}
                                className="px-2.5 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 font-bold rounded-lg border border-indigo-500/10 text-[10px] transition-all cursor-pointer"
                              >
                                Detail
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
            
            {/* Telegram Integration header & toggle */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="space-y-1 pr-4">
                <SectionTitle icon={MessageSquare} color="text-sky-400" label="Telegram Integration" />
                <p className="text-xs text-zinc-400">Terima peringatan status jaringan langsung ke bot Telegram Anda saat perangkat offline/online.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={telegramEnabled} 
                  onChange={e => setTelegramEnabled(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>

            {telegramEnabled && (
              <div className="space-y-4 pl-2 border-l border-sky-500/20">
                <div>
                  <label className="text-xs font-bold text-zinc-500 block mb-1.5">Bot Token</label>
                  <div className="relative">
                    <input type={revealToken ? 'text' : 'password'} value={telegramToken} onChange={e => setTelegramToken(e.target.value)} placeholder="1234567:ABC-DEF..." className={`${inputCls} pr-12`} />
                    <button type="button" onClick={() => setRevealToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                      {revealToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {telegramToken && !revealToken && <p className="text-[10px] text-zinc-650 mt-1">Tersimpan: {maskSecret(telegramToken)}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 block mb-1.5">Chat ID Tujuan</label>
                  <input type="text" value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} placeholder="ID Pribadi / Grup (mis. -1001234567)" className={inputCls} />
                </div>
              </div>
            )}

            {/* WhatsApp Integration header & toggle */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 pt-4">
              <div className="space-y-1 pr-4">
                <SectionTitle icon={MessageSquare} color="text-emerald-400" label="WhatsApp Integration" />
                <p className="text-xs text-zinc-400">Kirim notifikasi peringatan status jaringan langsung ke nomor WhatsApp Anda saat terjadi gangguan.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={waEnabled} 
                  onChange={e => handleToggleWhatsApp(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {waEnabled && (
              <div className="space-y-8 pl-2 border-l border-emerald-500/20">
                
                {/* ========================================== */}
                {/* NOMOR SUMBER (SENDER GATEWAYS)             */}
                {/* ========================================== */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Nomor Sumber (Gateways)</h4>
                      <p className="text-xs text-zinc-400">Hubungkan satu atau beberapa nomor WhatsApp pengirim untuk siaran alert.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddSource(v => !v)}
                      className="force-white-text flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg active:scale-95"
                    >
                      Tambah Pengirim
                    </button>
                  </div>

                  {showAddSource && (
                    <div className="bg-black/30 p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={newSourceName}
                        onChange={e => setNewSourceName(e.target.value)}
                        placeholder="Nama sumber (misal: Gateway Utama)"
                        className={`${inputCls} flex-1`}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAddSource}
                          className="px-4 py-2 bg-emerald-600 text-white-fixed font-semibold rounded-xl text-xs hover:bg-emerald-500 transition-all active:scale-95"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddSource(false)}
                          className="px-4 py-2 bg-zinc-800 text-zinc-400 font-semibold rounded-xl text-xs hover:bg-zinc-700 transition-all"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sources Table */}
                  <div className="overflow-x-auto border border-white/5 rounded-2xl bg-zinc-950/40">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-zinc-950/60 text-zinc-400 font-bold uppercase tracking-wider">
                          <th className="p-3">Nama</th>
                          <th className="p-3">Nomor Terhubung</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-center">Aktif</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-zinc-300">
                        {loadingSources && sources.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-zinc-500 animate-pulse">Memuat nomor sumber...</td>
                          </tr>
                        ) : sources.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-zinc-500">Belum ada nomor sumber pengirim.</td>
                          </tr>
                        ) : (
                          sources.map((src: any) => {
                            const isConnected = src.status === 'connected';
                            const isQr = src.status === 'qrcode';
                            const isConnecting = src.status === 'connecting';
                            
                            return (
                              <tr key={src.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-3 font-semibold text-white">{src.name}</td>
                                <td className="p-3 font-mono">{src.phone_number || '-'}</td>
                                <td className="p-3">
                                  <div className="flex items-center gap-1.5">
                                    {isConnected && (
                                      <>
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-emerald-400 font-semibold">Terhubung</span>
                                      </>
                                    )}
                                    {isQr && (
                                      <>
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                        <span className="text-amber-400 font-semibold">Butuh Scan QR</span>
                                      </>
                                    )}
                                    {isConnecting && (
                                      <>
                                        <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                                        <span className="text-sky-400 font-semibold">Menghubungkan...</span>
                                      </>
                                    )}
                                    {src.status === 'disconnected' && (
                                      <>
                                        <div className="w-2 h-2 rounded-full bg-zinc-650" />
                                        <span className="text-zinc-500">Terputus</span>
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <label className="relative inline-flex items-center cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={src.is_active === 1}
                                      onChange={() => handleToggleSource(src.id)}
                                      className="sr-only peer"
                                    />
                                    <div className="w-7 h-4 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                                  </label>
                                </td>
                                <td className="p-3 text-right space-x-2">
                                  {isConnected ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDisconnectSource(src.id)}
                                      className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 active:scale-95 transition-all"
                                    >
                                      Putuskan
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={src.is_active === 0}
                                      onClick={() => handleConnectSource(src.id)}
                                      className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/10 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                      {isQr ? 'Scan QR' : 'Hubungkan'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSource(src.id)}
                                    className="px-2 py-1 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
                                  >
                                    Hapus
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* QR Code Scan Modal */}
                  {activeQrSource && (activeQrSource.status === 'qrcode' || activeQrSource.status === 'connecting') && (
                    <div className="bg-zinc-800/80 border border-amber-500/30 rounded-2xl p-5 space-y-4 max-w-md mx-auto text-center shadow-lg relative overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setActiveQrSource(null)}
                        className="absolute top-3 right-3 text-zinc-400 hover:text-white transition-colors"
                      >
                        ✕
                      </button>
                      <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Scan QR Code — {activeQrSource.name}</h5>
                      
                      {activeQrSource.status === 'qrcode' && activeQrSource.qr ? (
                        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl w-fit mx-auto shadow-md">
                          <img src={activeQrSource.qr} alt="WhatsApp QR Code" className="w-44 h-44 select-none" />
                          <span className="text-[10px] text-zinc-500 font-medium mt-2 max-w-[200px]">
                            Buka WhatsApp → Perangkat Tertaut → Tautkan Perangkat lalu scan QR.
                          </span>
                        </div>
                      ) : (
                        <div className="py-10 flex flex-col items-center justify-center text-zinc-500">
                          <div className="w-8 h-8 rounded-full border-2 border-t-sky-500 border-zinc-700 animate-spin mb-3" />
                          <p className="text-xs">Menghubungkan Baileys & memuat QR code...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ========================================== */}
                {/* NOMOR TUJUAN (RECIPIENTS)                  */}
                {/* ========================================== */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Nomor Tujuan (Penerima)</h4>
                      <p className="text-xs text-zinc-400">Pengiriman alert jaringan akan disiarkan ke seluruh nomor tujuan aktif di bawah ini.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTarget(null);
                        setShowAddTarget(v => !v);
                      }}
                      className="force-white-text flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg active:scale-95"
                    >
                      Tambah Penerima
                    </button>
                  </div>

                  {showAddTarget && (
                    <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3">
                      <h5 className="text-xs font-bold text-zinc-400 uppercase">Tambah Penerima Baru</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={newTarget.name}
                          onChange={e => setNewTarget(p => ({ ...p, name: e.target.value }))}
                          placeholder="Nama Penerima (misal: Admin IT)"
                          className={inputCls}
                        />
                        <input
                          type="text"
                          value={newTarget.phone_number}
                          onChange={e => setNewTarget(p => ({ ...p, phone_number: e.target.value }))}
                          placeholder="Nomor HP WhatsApp (misal: 6285607846889)"
                          className={inputCls}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAddTarget}
                          className="px-4 py-2 bg-emerald-600 text-white-fixed font-semibold rounded-xl text-xs hover:bg-emerald-500 transition-all active:scale-95"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddTarget(false)}
                          className="px-4 py-2 bg-zinc-800 text-zinc-400 font-semibold rounded-xl text-xs hover:bg-zinc-700 transition-all"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}

                  {editingTarget && (
                    <div className="bg-zinc-800/40 p-4 rounded-2xl border border-white/5 space-y-3">
                      <h5 className="text-xs font-bold text-amber-400 uppercase">Edit Penerima</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editingTarget.name}
                          onChange={e => setEditingTarget(p => ({ ...p, name: e.target.value }))}
                          placeholder="Nama Penerima"
                          className={inputCls}
                        />
                        <input
                          type="text"
                          value={editingTarget.phone_number}
                          onChange={e => setEditingTarget(p => ({ ...p, phone_number: e.target.value }))}
                          placeholder="Nomor HP"
                          className={inputCls}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleUpdateTarget}
                          className="px-4 py-2 bg-emerald-600 text-white-fixed font-semibold rounded-xl text-xs hover:bg-emerald-500 transition-all active:scale-95"
                        >
                          Perbarui
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTarget(null)}
                          className="px-4 py-2 bg-zinc-800 text-zinc-400 font-semibold rounded-xl text-xs hover:bg-zinc-700 transition-all"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Targets Table */}
                  <div className="overflow-x-auto border border-white/5 rounded-2xl bg-zinc-950/40">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-zinc-950/60 text-zinc-400 font-bold uppercase tracking-wider">
                          <th className="p-3">Nama</th>
                          <th className="p-3">Nomor Tujuan</th>
                          <th className="p-3 text-center">Aktif</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-zinc-300">
                        {loadingTargets && targets.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-6 text-center text-zinc-500 animate-pulse">Memuat nomor tujuan...</td>
                          </tr>
                        ) : targets.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-6 text-center text-zinc-500">Belum ada nomor tujuan penerima.</td>
                          </tr>
                        ) : (
                          targets.map((tgt: any) => (
                            <tr key={tgt.id} className="hover:bg-white/5 transition-colors">
                              <td className="p-3 font-semibold text-white">{tgt.name}</td>
                              <td className="p-3 font-mono">{tgt.phone_number}</td>
                              <td className="p-3 text-center">
                                <label className="relative inline-flex items-center cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={tgt.is_active === 1}
                                    onChange={() => handleToggleTarget(tgt.id)}
                                    className="sr-only peer"
                                  />
                                  <div className="w-7 h-4 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                              </td>
                              <td className="p-3 text-right space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAddTarget(false);
                                    setEditingTarget(tgt);
                                  }}
                                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTarget(tgt.id)}
                                  className="px-2 py-1 rounded bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ========================================== */}
                {/* UJI COBA PESAN (TEST PIPELINE)             */}
                {/* ========================================== */}
                <div className="bg-zinc-800/30 border border-white/5 rounded-2xl p-4 space-y-4 pt-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Kirim Pesan Uji Coba (Kustom)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 block mb-1">Pilih Pengirim (Source)</label>
                      <select
                        value={testSourceId}
                        onChange={e => setTestSourceId(e.target.value)}
                        className={`${inputCls} appearance-none`}
                      >
                        <option value="">-- Gunakan Sumber Pertama Terhubung --</option>
                        {sources.filter(s => s.status === 'connected').map(s => (
                          <option key={s.id} value={s.session_id}>{s.name} ({s.phone_number})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 block mb-1">Nomor Penerima Uji Coba</label>
                      <input
                        type="text"
                        value={testTargetNum}
                        onChange={e => setTestTargetNum(e.target.value)}
                        placeholder="Masukkan nomor HP (misal: 6285607846889)"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 block mb-1">Isi Pesan Uji Coba</label>
                    <textarea
                      value={testMsgContent}
                      onChange={e => setTestMsgContent(e.target.value)}
                      placeholder="Masukkan isi pesan tes kustom (opsional)"
                      className={`${inputCls} min-h-[60px]`}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={testingWa}
                    onClick={handleTestWhatsAppCustom}
                    className="flex items-center justify-center gap-2 w-full text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-2.5 rounded-xl border border-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {testingWa ? 'Mengirim...' : 'Kirim Pesan Uji Coba'}
                  </button>
                </div>

              </div>
            )}

            <div className="border-t border-white/5 pt-4">
              <SectionTitle icon={Smartphone} color="text-indigo-400" label="Mobile Connectivity (Capacitor)" />
              <p className="text-xs text-zinc-400 mt-1">Gunakan ini jika Anda membuka dashboard dari Aplikasi Android/iOS agar bisa terhubung ke server laptop Anda.</p>
            </div>
            
            <div>
              <label className="text-xs font-bold text-zinc-500 block mb-1.5">Backend Server URL</label>
              <input 
                type="text" 
                value={manualApiUrl} 
                onChange={e => setManualApiUrl(e.target.value)} 
                placeholder="http://172.18.xxx.xxx:3000" 
                className={inputCls} 
              />
              <p className="text-[10px] text-zinc-650 mt-2 italic">
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
                <button onClick={() => setShowAddAdmin(v => !v)} className="force-white-text flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-violet-600/20">
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

      {/* AI Log Detail Modal */}
      <AnimatePresence>
        {selectedAiLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold font-mono ${selectedAiLog.mode === 'llm' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                      {selectedAiLog.mode.toUpperCase()}
                    </span>
                    Detail Aktivitas & Log AI
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-1 font-mono">{new Date(selectedAiLog.created_at).toLocaleString('id-ID')}</p>
                </div>
                <button
                  onClick={() => setSelectedAiLog(null)}
                  className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/80 rounded-xl">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Model Engine</p>
                    <p className="text-sm font-semibold text-zinc-200 mt-0.5 font-mono">{selectedAiLog.model}</p>
                  </div>
                  <div className="p-3 bg-zinc-950/40 border border-zinc-800/80 rounded-xl">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Status Eksekusi</p>
                    <span className={`inline-block px-2 py-0.5 mt-1 rounded-full font-mono text-[10px] font-bold ${selectedAiLog.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {selectedAiLog.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1.5">Prompt / Request Input</p>
                  <pre className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-2xl font-mono text-[10px] text-zinc-300 whitespace-pre-wrap max-h-[160px] overflow-y-auto custom-scrollbar">
                    {selectedAiLog.prompt || '-'}
                  </pre>
                </div>

                {selectedAiLog.status === 'success' ? (
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1.5">Model Response / Output</p>
                    <pre className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-2xl font-mono text-[10px] text-indigo-300 whitespace-pre-wrap max-h-[220px] overflow-y-auto custom-scrollbar">
                      {selectedAiLog.response || '-'}
                    </pre>
                  </div>
                ) : (
                  <div>
                    <p className="text-[10px] text-rose-400 uppercase tracking-wider font-bold mb-1.5">Error Message</p>
                    <div className="p-3.5 bg-rose-500/5 border border-rose-500/20 rounded-2xl font-mono text-[10px] text-rose-400 whitespace-pre-wrap">
                      {selectedAiLog.error_message || '-'}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-zinc-950/40 border-t border-zinc-800 flex justify-end">
                <button
                  onClick={() => setSelectedAiLog(null)}
                  className="px-5 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
