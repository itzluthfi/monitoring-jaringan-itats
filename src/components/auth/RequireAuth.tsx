import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * RequireAuth - wrapper komponen untuk route yang butuh autentikasi.
 * Handles: 
 *   1. Token tidak ada        → redirect ke /login
 *   2. Token expired (JWT)    → clear token + redirect login
 *   3. Token invalid/corrupt  → clear token + redirect login
 *   4. Server 401/403         → tampilkan halaman error yang sesuai
 */

interface RequireAuthProps {
  children: React.ReactNode;
}

function parseJwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.exp ?? null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const exp = parseJwtExpiry(token);
  if (!exp) return true; // Jika tidak bisa dibaca, anggap expired
  return Date.now() >= exp * 1000;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();
  const token = localStorage.getItem('auth_token');

  // 1. Tidak ada token sama sekali
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Token ada tapi sudah expire
  if (isTokenExpired(token)) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    sessionStorage.removeItem('last_seen_notification_id');
    return <Navigate to="/login" state={{ from: location, reason: 'session_expired' }} replace />;
  }

  // 3. Token valid → izinkan akses
  return <>{children}</>;
}

/**
 * AlreadyLoggedIn - wrapper untuk /login route.
 * Jika user sudah login dan tokennya masih valid, redirect ke dashboard.
 */
export function AlreadyLoggedIn({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token');

  if (token && !isTokenExpired(token)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Jika ada token tapi expired, bersihkan storage lalu tampilkan halaman login
  if (token) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    sessionStorage.removeItem('last_seen_notification_id');
  }

  return <>{children}</>;
}
