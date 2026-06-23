import React, { useState, useEffect } from 'react';
import { Wifi, Lock, User, AlertCircle, Eye, EyeOff, Shield, Clock, LogOut, AlertTriangle, Settings, Save, X, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';

interface LoginPageProps {
  onLogin: (token: string, username: string) => void;
}

const slides = [
  {
    url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&q=80&w=1200',
    title: 'Sentralisasi Jaringan Kampus',
    desc: 'Memantau performa router, core switch, dan access point heterogen secara terpadu di ITATS.'
  },
  {
    url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&q=80&w=1200',
    title: 'Trafik & Bandwidth Real-Time',
    desc: 'Analisis visual throughput data dan utilisasi beban bandwidth secara instan.'
  },
  {
    url: 'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&q=80&w=1200',
    title: 'Alerting & Tiket Pengaduan',
    desc: 'Notifikasi otomatis asinkronus ke WhatsApp/Telegram dan manajemen tiket aduan publik.'
  }
];

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

  // ── Theme State (Synchronized with localStorage) ──
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return true; // default dark
  });

  useEffect(() => {
    const activeTheme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', activeTheme);
    localStorage.setItem('theme', activeTheme);
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  // ── Reason Banner State with Auto-Dismiss & Manual Dismiss ──
  const [showBanner, setShowBanner] = useState(!!reason);

  useEffect(() => {
    if (reason) {
      setShowBanner(true);
      // Auto dismiss after 6 seconds
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [reason]);

  // ── Slideshow State ──
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

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
    <div className="min-h-screen bg-zinc-950 flex flex-col md:flex-row relative overflow-hidden transition-colors duration-200 font-sans">
      
      {/* Floating Theme Toggle (Top Right) */}
      <div className="absolute top-6 right-6 z-30">
        <button
          onClick={toggleTheme}
          className={`inline-flex items-center justify-center w-9 h-9 rounded-2xl border transition-all duration-200 cursor-pointer ${
            isDark 
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-350 hover:bg-amber-500/20 shadow-lg shadow-amber-500/5' 
              : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 shadow-sm'
          }`}
          title={isDark ? 'Mode Terang' : 'Mode Gelap'}
        >
          {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>
      </div>

      {/* LEFT PANEL: Slideshow (Visible on Desktop / md screens and up) */}
      {/* Note: bg-[#09090b] is used here to avoid light theme conversion and keep high contrast */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 relative overflow-hidden bg-[#09090b] border-r border-[#1f2937]/30">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <img
              src={slides[currentSlide].url}
              alt={slides[currentSlide].title}
              className="w-full h-full object-cover filter brightness-[0.35]"
            />
            {/* Elegant Radial + Vertical Gradient Overlay (uses hardcoded dark colors to prevent light mode wash out) */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#09090b] via-[#09090b]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-[#09090b]/20" />
            
            {/* Visual floating neon highlights to match ITATS theme */}
            <div className="absolute top-1/4 left-1/4 w-[250px] h-[250px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-1/3 right-1/4 w-[250px] h-[250px] bg-orange-500/5 rounded-full blur-[90px] pointer-events-none" />

            {/* Slide Text Content */}
            <div className="absolute bottom-20 left-16 right-16 z-20">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400" /> NetMon ITATS Gateway
              </motion.div>
              
              <motion.h2 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-3xl lg:text-4xl font-extrabold text-slate-100 mt-5 tracking-tight leading-tight"
              >
                {slides[currentSlide].title}
              </motion.h2>
              
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-sm lg:text-base text-slate-300 mt-3 max-w-lg leading-relaxed font-medium"
              >
                {slides[currentSlide].desc}
              </motion.p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Slide Indicators */}
        <div className="absolute bottom-8 left-16 z-20 flex gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentSlide ? 'bg-emerald-500 w-6' : 'bg-slate-700 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: Login Form Content */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-16 z-10 relative">
        {/* Background ambient glow (Visible on all screens, especially mobile) */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[450px] h-[450px] bg-emerald-500/[0.04] rounded-full blur-[100px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 left-1/3 w-[350px] h-[350px] bg-orange-500/[0.02] rounded-full blur-[90px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md relative z-10"
        >
          {/* Reason banner (Dismissable) */}
          <AnimatePresence>
            {showBanner && reasonBanner && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.3 }}
                className={`flex items-center justify-between gap-3 p-3.5 mb-6 rounded-2xl shadow-sm ${
                  reasonBanner.color === 'amber' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-650'
                  : reasonBanner.color === 'rose'  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-650'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <reasonBanner.icon className="w-4 h-4 flex-shrink-0" />
                  <p className="text-xs font-bold leading-relaxed">{reasonBanner.text}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBanner(false)}
                  className="text-current opacity-55 hover:opacity-100 p-0.5 rounded-lg hover:bg-zinc-500/10 transition-all cursor-pointer flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Title Header */}
          <div className="text-center mb-8 md:text-left">
            <div className="flex justify-center md:justify-start mb-4">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/5">
                <Wifi className="w-7 h-7 text-emerald-500" />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight">NetMon ITATS</h1>
            <p className="text-xs font-semibold text-zinc-500 mt-1 uppercase tracking-wider">Sistem Monitoring Jaringan Multi-Vendor</p>
          </div>

          {/* Form Card */}
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="w-4 h-4 text-emerald-500" />
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Akses Portal Admin</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
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
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-12 py-3 text-sm text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-400 transition-colors cursor-pointer"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/20"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs font-medium text-red-500">{error}</p>
                </motion.div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all text-sm tracking-wide mt-2 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] force-white-text"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memverifikasi...
                  </>
                ) : 'Masuk ke Dashboard'}
              </button>
            </form>
          </div>

          {/* Navigation / Secondary Actions */}
          <div className="flex flex-col items-center gap-3 mt-6">
            <button
              onClick={() => {
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors underline underline-offset-4 cursor-pointer"
            >
              ← Kembali ke Halaman Publik
            </button>
            <button
              onClick={() => setShowServerSettings(!showServerSettings)}
              className="flex flex-row items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-500 transition-colors cursor-pointer font-bold"
            >
              <Settings className="w-3.5 h-3.5" /> Konfigurasi Server (Mobile)
            </button>
          </div>

          {/* Mobile Server Configuration Section */}
          {showServerSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl"
            >
              <p className="text-[10px] text-zinc-500 mb-2 leading-relaxed font-semibold">
                Jika menggunakan aplikasi HP (.APK), masukkan IP laptop server Anda agar HP bisa terhubung. Contoh: <code className="text-emerald-500 font-bold">http://172.41.1.10:3000</code>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualApiUrl}
                  onChange={e => setManualApiUrl(e.target.value)}
                  placeholder="http://ip-server:3000"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={() => {
                    if (manualApiUrl) {
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
                  className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-3 py-2 flex items-center justify-center transition-colors cursor-pointer force-white-text"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

    </div>
  );
}
