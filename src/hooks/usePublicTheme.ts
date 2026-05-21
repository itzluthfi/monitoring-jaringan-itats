import { useState } from 'react';

/**
 * Shared theme hook for all public pages.
 * Reads & writes to localStorage key 'pub-theme'.
 */
export function usePublicTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return localStorage.getItem('pub-theme') !== 'light'; } catch { return true; }
  });

  const toggleTheme = () => setIsDark((v) => {
    const next = !v;
    try { localStorage.setItem('pub-theme', next ? 'dark' : 'light'); } catch {}
    return next;
  });

  return { isDark, toggleTheme };
}
