import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LoaderProps {
  message?: string;
  className?: string;
}

export function Loader({ message = "Loading data...", className = "" }: LoaderProps) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'id';
  const isIndo = currentLang.toLowerCase().startsWith('id');

  // Helper to translate message dynamically based on keyword matching
  const getLocalizedMessage = (msg: string) => {
    const lower = msg.toLowerCase();
    
    if (lower.includes('access point')) {
      return isIndo ? "Menyingkronkan database access point..." : "Synchronizing access point database...";
    }
    if (lower.includes('external') || lower.includes('sinking')) {
      return isIndo ? "Menghubungkan dengan infrastruktur luar..." : "Syncing with external infrastructure...";
    }
    if (lower.includes('secure admin') || lower.includes('secure administrator') || lower.includes('portal admin')) {
      return isIndo ? "Menginisialisasi portal administrator..." : "Initializing secure administrator portal...";
    }
    if (lower.includes('infrastructure status')) {
      return isIndo ? "Mengambil status infrastruktur..." : "Fetching infrastructure status...";
    }
    if (lower.includes('interface data') || lower.includes('data interface')) {
      return isIndo ? "Mengambil data antarmuka (interface)..." : "Fetching interface data...";
    }
    if (lower.includes('queues data') || lower.includes('queue data')) {
      return isIndo ? "Mengambil data antrean (queues)..." : "Fetching queue data...";
    }
    if (lower.includes('persistent logs') || lower.includes('log sistem')) {
      return isIndo ? "Menyingkronkan log sistem..." : "Synchronizing persistent logs...";
    }
    if (lower.includes('critical system') || lower.includes('peringatan sistem')) {
      return isIndo ? "Menyingkronkan peringatan sistem..." : "Synchronizing critical system alerts...";
    }
    if (lower.includes('konfigurasi sistem') || lower.includes('system configuration')) {
      return isIndo ? "Memuat konfigurasi sistem..." : "Loading system configuration...";
    }
    if (lower.includes('daftar admin') || lower.includes('administrator list')) {
      return isIndo ? "Memuat daftar admin..." : "Loading administrator list...";
    }
    if (lower.includes('topology') || lower.includes('topologi')) {
      return isIndo ? "Memetakan topologi infrastruktur..." : "Mapping infrastructure topology...";
    }
    if (lower.includes('traffic matrix') || lower.includes('matriks trafik')) {
      return isIndo ? "Menyingkronkan matriks trafik..." : "Synchronizing interface traffic matrix...";
    }
    if (lower.includes('loading data') || lower.includes('memuat data')) {
      return isIndo ? "Memuat data..." : "Loading data...";
    }
    
    // Return original message if no keyword match is found
    return msg;
  };

  const displayMessage = getLocalizedMessage(message);

  return (
    <div className={`flex flex-col items-center justify-center p-12 w-full h-full ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500 blur-[20px] opacity-20 animate-pulse"></div>
        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin relative z-10" />
      </div>
      <p className="mt-4 text-sm font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
        {displayMessage}
      </p>
    </div>
  );
}
