import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import PublicPage from './pages/PublicPage';
import { AdminLayout } from './components/layout/AdminLayout';

// Target views we will create
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
    window.location.href = '/login';
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<PublicPage onGoToLogin={() => window.location.href = '/login'} />} />
        <Route path="/public" element={<PublicPage onGoToLogin={() => window.location.href = '/login'} />} />
        
        {/* Login Route */}
        <Route path="/login" element={
          localStorage.getItem('auth_token') ? <Navigate to="/admin/dashboard" replace /> : <LoginPage onLogin={(token, user) => {
            localStorage.setItem('auth_token', token);
            localStorage.setItem('auth_user', user);
            window.location.href = '/admin/dashboard';
          }} />
        } />
        
        {/* Admin Routes wrapped in Layout */}
        <Route path="/admin" element={<AdminLayout onLogout={handleLogout} />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardView />} />
          <Route path="map" element={<MapView />} />
          <Route path="topology" element={<TopologyView />} />
          <Route path="vlan/*" element={<VlanView />} />
          <Route path="devices/*" element={<DevicesView />} />
          <Route path="aps" element={<AccessPointsView />} />
          <Route path="logs" element={<LogsView />} />
          <Route path="settings" element={<SettingsView />} />
          <Route path="notifications" element={<NotificationsView />} />
          <Route path="smart-central" element={<SmartCentralView />} />
          <Route path="clients" element={<ClientReportView />} />
          <Route path="controllers" element={<ControllersView />} />
        </Route>


        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

