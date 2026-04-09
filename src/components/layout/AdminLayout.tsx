import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { Bell, Menu, AlertTriangle } from 'lucide-react';
import { authFetch } from '../../lib/authFetch';
import { Notification } from '../../types';
import toast from 'react-hot-toast';

interface AdminLayoutProps {
  onLogout: () => void;
}

export function AdminLayout({ onLogout }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastSeenId, setLastSeenId] = useState<number>(0);

  let authUser = localStorage.getItem('auth_user');
  if (!authUser || authUser === 'undefined') authUser = 'System Admin';
  const authToken = localStorage.getItem('auth_token');

  // Load notifications periodically
  React.useEffect(() => {
    if (!authToken) return;
    const fetchNotifications = () => {
      authFetch('/api/notifications')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setNotifications(data);
            
            // Check for new critical alerts to pop up
            if (data.length > 0) {
              const latestIdInFetch = Math.max(...data.map(n => n.id));
              
              if (lastSeenId > 0) {
                const newNotifs = data.filter((n: Notification) => n.id > lastSeenId && !n.is_read && (n.type === 'critical' || n.type === 'error'));
                newNotifs.forEach((n: Notification) => {
                  toast.custom((t) => (
                    <div className={`${t.visible ? 'animate-in slide-in-from-top-5 fade-in duration-300' : 'animate-out slide-out-to-top-5 fade-out duration-300'} max-w-sm w-full bg-zinc-900 border ${n.type === 'critical' ? 'border-red-500/50' : 'border-amber-500/50'} shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                      <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                          <div className={`flex-shrink-0 pt-0.5 ${n.type === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
                            <AlertTriangle className="h-6 w-6" />
                          </div>
                          <div className="ml-3 flex-1">
                            <p className="text-sm font-bold text-white uppercase tracking-wider">{n.title}</p>
                            <p className="mt-1 text-sm text-zinc-400">{n.message}</p>
                            {n.device_name && <p className="mt-2 text-xs text-zinc-500 font-mono">Terminal: {n.device_name}</p>}
                          </div>
                        </div>
                      </div>
                      <div className="flex border-l border-zinc-800">
                        <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:bg-zinc-800/50 focus:outline-none transition-colors">
                          Tutup
                        </button>
                      </div>
                    </div>
                  ), { duration: 8000, position: 'top-center' });
                });
              }
              setLastSeenId(latestIdInFetch);
            }
          }
        })
        .catch(console.error);
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [authToken, lastSeenId]);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'bg-zinc-950 text-zinc-300' : 'bg-zinc-100 text-zinc-800'}`}>
      <Sidebar 
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        theme={theme}
        setTheme={setTheme}
        onLogout={onLogout}
        authUser={authUser}
        unreadCount={unreadCount}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header / Topbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-xl z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
               Administrator Portal
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-full transition-all"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-zinc-950 animate-pulse"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <h3 className="font-semibold text-white">Notifications</h3>
                    <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">{unreadCount} New</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length > 0 ? (
                      <div className="divide-y divide-zinc-800">
                        {notifications.map((notif: Notification) => (
                          <div 
                            key={notif.id} 
                            className={`p-4 hover:bg-zinc-800/50 transition-colors ${!notif.is_read ? 'bg-indigo-500/5' : ''}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-semibold ${notif.type === 'critical' ? 'text-rose-400' : 'text-indigo-400'}`}>
                                {notif.title}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-400 mt-1">{notif.message}</p>
                            <span className="text-xs text-zinc-600 mt-2 block">
                              {new Date(notif.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-zinc-500">
                        <Bell className="w-8 h-8 opacity-20 mx-auto mb-3" />
                        <p className="text-sm">No new notifications</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic View injected here by React Router */}
        <div className="flex-1 overflow-y-auto relative no-scrollbar">
          <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
