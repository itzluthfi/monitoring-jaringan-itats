import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Wifi, Shield, Cpu, Activity } from 'lucide-react';
import { SplashScreen } from '@capacitor/splash-screen';

interface SplashScreenProps {
  onComplete?: () => void;
  minDuration?: number;
}

export default function SmartSplashScreen({ onComplete, minDuration = 2500 }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing Core Project...');

  useEffect(() => {
    // Dynamic loading text simulation
    const statusLines = [
      'Authenticating Secure Tunnel...',
      'Mapping Network Nodes...',
      'Synchronizing MikroTik Data...',
      'Finalizing Dashboard Layout...',
      'Ready to Link.'
    ];
    
    let currentLine = 0;
    const textInterval = setInterval(() => {
      if (currentLine < statusLines.length) {
        setStatusText(statusLines[currentLine]);
        currentLine++;
      }
    }, 600);

    // Sembunyikan native splash screen segera setelah animasi React kita siap
    const hideNative = async () => {
      try {
        await SplashScreen.hide();
      } catch (e) {
        console.warn('Native splash already hidden');
      }
    };
    
    // Beri sedikit nafas agar React sempat merender UI sebelum splash ditarik
    const hideTimer = setTimeout(hideNative, 400);

    // Progress simulation
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + (Math.random() * 15);
      });
    }, 150);

    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, minDuration);

    return () => {
      clearInterval(interval);
      clearInterval(textInterval);
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, [onComplete, minDuration]);

  return (
    <div className="fixed inset-0 z-[999] bg-[#050505] flex flex-col items-center justify-center overflow-hidden">
      {/* Dynamic Background Glows */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px]" 
      />
      <motion.div 
        animate={{ 
          scale: [1.2, 1, 1.2],
          opacity: [0.05, 0.15, 0.05]
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[400px] h-[400px] bg-violet-600/5 rounded-full blur-[100px] -bottom-20 -right-20" 
      />

      {/* Main Logo Section */}
      <div className="relative mb-12">
        {/* Outer Spinning Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-8 border border-emerald-500/10 rounded-full border-dashed animate-custom-spin"
        />
        
        {/* Orbits */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-16 border border-violet-500/5 rounded-full animate-custom-spin-reverse"
        />

        {/* The Logo Container with Perspective */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-28 h-28 bg-gradient-to-tr from-emerald-500/20 to-violet-500/20 p-0.5 rounded-[2.5rem] shadow-2xl shadow-emerald-500/20"
          style={{ perspective: '1000px' }}
        >
          <div className="w-full h-full bg-[#0A0A0A] rounded-[2.4rem] flex items-center justify-center overflow-hidden border border-white/10" style={{ transformStyle: 'preserve-3d' }}>
            <motion.img 
              src="/logo.png" 
              className="w-20 h-20 object-contain"
              animate={{ 
                rotateY: [0, 360],
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              onError={(e) => {
                // Fallback to Icon if image not found yet
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', '<svg class="w-12 h-12 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/></svg>');
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* Text Context */}
      <div className="text-center mb-8 space-y-2">
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-white text-xl font-bold tracking-[0.2em] uppercase"
        >
          ITATS <span className="text-emerald-500">Nexus</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-zinc-600 text-[10px] font-mono tracking-widest uppercase"
        >
          Security & Network Monitoring System
        </motion.p>
      </div>

      {/* Loading Bar Section */}
      <div className="w-64 space-y-3">
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
          <motion.div 
            className="h-full bg-gradient-to-r from-emerald-500 to-violet-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', damping: 20, stiffness: 40 }}
          />
        </div>
        <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500 uppercase tracking-tighter">
          <motion.span 
            key={statusText}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-emerald-500/80"
          >
            {statusText}
          </motion.span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Bottom Features Indicators (Micro-animations) */}
      <div className="absolute bottom-12 flex gap-8">
        {[
          { icon: Shield, label: 'Secure' },
          { icon: Activity, label: 'Live' },
          { icon: Cpu, label: 'Fast' }
        ].map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + (i * 0.1) }}
            className="flex flex-col items-center gap-1"
          >
            <item.icon className="w-4 h-4 text-zinc-700" />
            <span className="text-[8px] text-zinc-800 font-bold uppercase">{item.label}</span>
          </motion.div>
        ))}
      </div>
      {/* Standard CSS fallback styles in case motion lags */}
      <style>{`
        @keyframes custom-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes custom-spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-custom-spin { animation: custom-spin 8s linear infinite; }
        .animate-custom-spin-reverse { animation: custom-spin-reverse 12s linear infinite; }
      `}</style>
    </div>
  );
}
