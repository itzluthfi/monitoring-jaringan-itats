import React from 'react';
import { RefreshCw } from 'lucide-react';

interface LoaderProps {
  message?: string;
  className?: string;
}

export function Loader({ message = "Loading data...", className = "" }: LoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 w-full h-full ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500 blur-[20px] opacity-20 animate-pulse"></div>
        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin relative z-10" />
      </div>
      <p className="mt-4 text-sm font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
        {message}
      </p>
    </div>
  );
}
