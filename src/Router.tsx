import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import PublicPage from './pages/PublicPage';
import NotFoundPage from './pages/NotFoundPage';
import { AdminLayout } from './components/layout/AdminLayout';
import { RequireAuth, AlreadyLoggedIn } from './components/auth/RequireAuth';

// Views
import { DashboardView } from './views/DashboardView';
import { MapView } from './views/MapView';
import { TopologyView } from './views/TopologyView';
import { VlanView } from './views/VlanView';
import { DevicesView } from './views/DevicesView';
import { SettingsView } from './views/SettingsView';
import { NotificationsView } from './views/NotificationsView';
import { AccessPointsView } from './views/AccessPointsView';
import { LogsView } from './views/LogsView';
import { SmartCentralView } from './views/SmartCentralView';
import { ClientReportView } from './views/ClientReportView';
import { ControllersView } from './views/ControllersView';
import { Toaster } from 'react-hot-toast';

export default function Router() {
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    sessionStorage.removeItem('last_seen_notification_id');
    window.location.replace('/login?reason=logout');
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public Routes ─────────── */}
        <Route path="/" element={<PublicPage onGoToLogin={() => window.location.href = '/login'} />} />
        <Route path="/public" element={<PublicPage onGoToLogin={() => window.location.href = '/login'} />} />

        {/* ── Login Route ─────────────
            AlreadyLoggedIn: jika token masih valid, langsung redirect ke dashboard
            tanpa perlu render halaman login sama sekali.                          */}
        <Route path="/login" element={
          <AlreadyLoggedIn>
            <LoginPage onLogin={(token, user) => {
              localStorage.setItem('auth_token', token);
              localStorage.setItem('auth_user', user);
              window.location.replace('/admin/dashboard');
            }} />
          </AlreadyLoggedIn>
        } />

        {/* ── Admin Routes ─────────────
            RequireAuth: periksa token ada + belum expire sebelum render layout.
            Jika gagal → redirect /login dengan reason yang sesuai.              */}
        <Route path="/admin" element={
          <RequireAuth>
            <AdminLayout onLogout={handleLogout} />
          </RequireAuth>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"    element={<DashboardView />} />
          <Route path="map"          element={<MapView />} />
          <Route path="topology"     element={<TopologyView />} />
          <Route path="vlan/*"       element={<VlanView />} />
          <Route path="devices/*"    element={<DevicesView />} />
          <Route path="aps"          element={<AccessPointsView />} />
          <Route path="logs"         element={<LogsView />} />
          <Route path="settings"     element={<SettingsView />} />
          <Route path="notifications" element={<NotificationsView />} />
          <Route path="smart-central" element={<SmartCentralView />} />
          <Route path="clients"      element={<ClientReportView />} />
          <Route path="controllers"  element={<ControllersView />} />
          {/* Catch unknown /admin/* sub-routes → tampilkan 404 di dalam layout */}
          <Route path="*"            element={<NotFoundPage errorCode={404} />} />
        </Route>

        {/* ── Error Pages ───────────── */}
        <Route path="/403" element={<NotFoundPage errorCode={403} />} />
        <Route path="/500" element={<NotFoundPage errorCode={500} />} />

        {/* ── Global 404 Catch-all ─────
            Semua URL yang tidak dikenal → halaman 404 premium, bukan redirect ke /.  */}
        <Route path="*" element={<NotFoundPage errorCode={404} />} />
      </Routes>

      <Toaster position="top-center" />
    </BrowserRouter>
  );
}
