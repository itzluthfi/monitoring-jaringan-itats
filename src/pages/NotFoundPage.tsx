import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ArrowLeft, MapPin } from 'lucide-react';

interface NotFoundPageProps {
  errorCode?: 404 | 403 | 401 | 500;
  message?: string;
}

const errorConfig = {
  401: {
    title: 'Unauthorized',
    subtitle: 'Sesi Anda tidak valid atau telah berakhir.',
    description: 'Silakan login kembali untuk melanjutkan ke panel administrator.',
    color: 'amber',
    action: { label: 'Login Kembali', href: '/login' },
  },
  403: {
    title: 'Forbidden',
    subtitle: 'Akses Ditolak',
    description: 'Anda tidak memiliki izin untuk mengakses halaman ini.',
    color: 'rose',
    action: { label: 'Kembali ke Dashboard', href: '/admin/dashboard' },
  },
  404: {
    title: 'Not Found',
    subtitle: 'Halaman Tidak Ditemukan',
    description: 'URL yang Anda masukkan tidak tersedia dalam sistem ini.',
    color: 'indigo',
    action: { label: 'Kembali ke Dashboard', href: '/admin/dashboard' },
  },
  500: {
    title: 'Server Error',
    subtitle: 'Terjadi Kesalahan Internal',
    description: 'Sistem mengalami masalah yang tidak terduga. Coba refresh atau hubungi administrator.',
    color: 'rose',
    action: { label: 'Refresh Halaman', href: window.location.href },
  },
};

const colorMap: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  amber:  { text: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  glow: 'shadow-amber-500/20' },
  rose:   { text: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   glow: 'shadow-rose-500/20' },
  indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', glow: 'shadow-indigo-500/20' },
};

export default function NotFoundPage({ errorCode = 404, message }: NotFoundPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const config = errorConfig[errorCode];
  const c = colorMap[config.color] ?? colorMap.indigo;
  const isLoggedIn = !!localStorage.getItem('auth_token');

  const handleAction = () => {
    if (errorCode === 500) {
      window.location.reload();
    } else if (errorCode === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      navigate('/login', { replace: true });
    } else {
      navigate(isLoggedIn ? '/admin/dashboard' : '/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] ${c.bg} rounded-full blur-[120px] opacity-30 pointer-events-none`} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '36px 36px' }} />

      <div className="relative z-10 text-center max-w-lg w-full animate-in fade-in slide-in-from-bottom-8 duration-500">
        {/* Error code large */}
        <div className="relative mb-6 select-none">
          <p className={`text-[140px] md:text-[180px] font-black leading-none ${c.text} opacity-10 pointer-events-none`}>
            {errorCode}
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-20 h-20 ${c.bg} border ${c.border} rounded-3xl flex items-center justify-center shadow-2xl ${c.glow} shadow-xl`}>
              <MapPin className={`w-9 h-9 ${c.text}`} />
            </div>
          </div>
        </div>

        <h1 className={`text-3xl md:text-4xl font-black text-white tracking-tight mb-2`}>{config.subtitle}</h1>
        <p className={`text-sm font-bold uppercase tracking-widest ${c.text} mb-4`}>{errorCode} · {config.title}</p>

        {message && (
          <p className="text-xs text-zinc-600 font-mono bg-zinc-900/70 border border-white/5 rounded-xl px-4 py-2 mb-4 break-all">
            {message}
          </p>
        )}

        <p className="text-zinc-400 text-sm leading-relaxed mb-3">
          {config.description}
        </p>

        {/* URL info */}
        <p className="text-[10px] text-zinc-700 font-mono mb-8 truncate">
          Halaman: <span className={c.text}>{location.pathname}</span>
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold text-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <button
            onClick={handleAction}
            className={`flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20`}
          >
            <Home className="w-4 h-4" /> {config.action.label}
          </button>
        </div>

        <p className="mt-10 text-[10px] text-zinc-700">ITATS Network Monitoring System · Admin Portal</p>
      </div>
    </div>
  );
}
