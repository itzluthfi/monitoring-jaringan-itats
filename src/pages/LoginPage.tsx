import React, { useState } from 'react';
import { Wifi, Lock, User, AlertCircle, Eye, EyeOff, Shield, Clock, LogOut, AlertTriangle, Settings, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';

interface LoginPageProps {
  onLogin: (token: string, username: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');
  
  // ── Mobile Server Configuration ──
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [manualApiUrl, setManualApiUrl] = useState(localStorage.getItem('API_SERVER_URL') || '');

  const reasonBanner = reason === 'session_expired'
    ? { icon: Clock, color: 'amber', text: 'Sesi Anda telah berakhir. Silakan login kembali.' }
    : reason === 'logout'
    ? { icon: LogOut, color: 'zinc', text: 'Anda telah berhasil logout.' }
    : reason === 'unauthorized'
    ? { icon: AlertTriangle, color: 'rose', text: 'Akses ditolak. Token tidak valid, silakan login ulang.' }
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const baseUrl = localStorage.getItem('API_SERVER_URL') || import.meta.env.VITE_API_URL || '';
      const finalUrl = baseUrl ? `${baseUrl}/api/auth/login` : '/api/auth/login';

      const res = await fetch(finalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setError(data.error || 'Login gagal. Coba lagi.');
      } else {
        onLogin(data.token, data.user?.username || data.username || username);
      }
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Reason banner */}
        {reasonBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 p-3 mb-6 rounded-2xl ${
              reasonBanner.color === 'amber' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
              : reasonBanner.color === 'rose'  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              : 'bg-zinc-800/60 border border-zinc-700/50 text-zinc-400'
            }`}
          >
            <reasonBanner.icon className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs">{reasonBanner.text}</p>
          </motion.div>
        )}

        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Wifi className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ITATS Network Monitor</h1>
          <p className="text-sm text-zinc-500 mt-1">Portal Admin — Sistem Monitoring Jaringan</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-4 h-4 text-emerald-400" />
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Admin Access Only</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="admin"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-12 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/20"
              >
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all text-sm tracking-wide mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memverifikasi...
                </>
              ) : 'Masuk ke Dashboard Admin'}
            </button>
          </form>
        </div>

        {/* Back to public */}
        <div className="flex flex-col items-center gap-3 mt-6">
          <button
            onClick={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors underline underline-offset-4"
          >
            ← Kembali ke Halaman Publik
          </button>
          <button
            onClick={() => setShowServerSettings(!showServerSettings)}
            className="flex flex-row items-center gap-1.5 text-xs text-emerald-600/70 hover:text-emerald-500 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" /> Konfigurasi Server (Mobile)
          </button>
        </div>

        {/* Server Settings Modal/Section */}
        {showServerSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 p-4 bg-black/40 border border-emerald-500/20 rounded-2xl"
          >
            <p className="text-[10px] text-zinc-400 mb-2 leading-relaxed">
              Jika menggunakan aplikasi HP (.APK), masukkan IP laptop server Anda agar HP bisa terhubung. Contoh: <code className="text-emerald-400">http://172.41.1.10:3000</code>
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualApiUrl}
                onChange={e => setManualApiUrl(e.target.value)}
                placeholder="http://ip-server:3000"
                className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                onClick={() => {
                  if (manualApiUrl) {
                    // hapus slash terakhir jika ada
                    // Pastikan awali dengan http://
                    let url = manualApiUrl.trim().replace(/\/$/, '');
                    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                      url = `http://${url}`;
                    }
                    localStorage.setItem('API_SERVER_URL', url);
                    setManualApiUrl(url);
                  } else {
                    localStorage.removeItem('API_SERVER_URL');
                  }
                  setShowServerSettings(false);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-3 py-2 flex items-center justify-center transition-colors"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
