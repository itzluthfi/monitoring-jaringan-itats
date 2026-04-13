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
  const [isCollapsed, setIsCollapsed] = useState(localStorage.getItem('sidebar_collapsed') === 'true');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastSeenId, setLastSeenId] = useState<number>(-1);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  
  // Audio for notifications
  const playNotificationSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log('Audio play blocked by browser policy until user interaction.'));
  };


  // Sync theme to document
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Sync collapse state to storage
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar_collapsed', String(newState));
  };

  let authUser = localStorage.getItem('auth_user');
  if (!authUser || authUser === 'undefined') authUser = 'System Admin';
  const authToken = localStorage.getItem('auth_token');

  // Load notifications periodically
  React.useEffect(() => {
    if (!authToken) return;
    const fetchNotifications = () => {
      authFetch('/api/notifications')
        .then(res => res.json())
        .then(response => {
          // The API returns { data: [...], total: ... }
          const data = response.data || response;
          if (Array.isArray(data)) {
            setNotifications(data);
            
            if (data.length > 0) {
              const latestIdInFetch = Math.max(...data.map(n => n.id));
              
              // If lastSeenId is -1, this is the FIRST fetch. 
              // We just set the baseline without showing alerts for old history.
              if (lastSeenId === -1) {
                setLastSeenId(latestIdInFetch);
                return;
              }

              // Only show alerts for notifications NEWER than our last known ID
              if (lastSeenId >= 0 && latestIdInFetch > lastSeenId) {
                const newNotifs = data.filter((n: Notification) => n.id > lastSeenId);
                
                if (newNotifs.length > 0) {
                  playNotificationSound();
                  
                  newNotifs.forEach((n: Notification) => {
                    const isCritical = n.type === 'critical' || n.type === 'error';

                    toast.custom((t) => (
                      <div className={`${t.visible ? 'animate-in slide-in-from-top-5 fade-in duration-300' : 'animate-out slide-out-to-top-5 fade-out duration-300'} max-w-sm w-full bg-zinc-900 border ${isCritical ? 'border-red-500/50 shadow-red-500/10' : 'border-indigo-500/50 shadow-indigo-500/10'} shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                        <div className="flex-1 w-0 p-4">
                          <div className="flex items-start">
                            <div className={`flex-shrink-0 pt-0.5 ${isCritical ? 'text-red-400' : 'text-indigo-400'}`}>
                              <Bell className="h-6 w-6" />
                            </div>
                            <div className="ml-3 flex-1">
                              <p className="text-sm font-bold text-white uppercase tracking-wider">{n.title}</p>
                              <p className="mt-1 text-sm text-zinc-400 leading-relaxed line-clamp-2">{n.message}</p>
                              <div className="mt-3 flex gap-2">
                                 <button 
                                   onClick={() => {
                                      authFetch(`/api/notifications/${n.id}/read`, { method: 'POST' });
                                      toast.dismiss(t.id);
                                      if (n.action_url) window.location.href = n.action_url;
                                   }}
                                   className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
                                 >
                                   Lihat Sekarang
                                 </button>
                                 <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-bold rounded-lg transition-colors">
                                   Abaikan
                                 </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ), { duration: 8000, position: 'top-center' });
                  });
                }
                setLastSeenId(latestIdInFetch);
              }
            }
          }
        })
        .catch(console.error);
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);

    const handleUpdate = () => fetchNotifications();
    window.addEventListener('notifications-changed', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications-changed', handleUpdate);
    };
  }, [authToken, lastSeenId]);



  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className={`flex h-screen overflow-hidden bg-zinc-950 text-zinc-300 selection:bg-indigo-500/30`}>
      <Sidebar 
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        theme={theme}
        setTheme={setTheme}
        onLogout={() => setIsLogoutModalOpen(true)}
        authUser={authUser}
        unreadCount={unreadCount}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300 ease-in-out">
        {/* Header / Topbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-xl z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50">
              <Menu className="w-5 h-5" />
            </button>
            <button 
              onClick={toggleCollapse} 
              className="hidden md:flex p-2 -ml-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
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
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-zinc-950 px-1 shadow-lg shadow-rose-500/30 animate-in zoom-in-0 duration-300">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}

              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
                    <h3 className="font-semibold text-white">System Notifications</h3>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        authFetch('/api/notifications/read-all', { method: 'POST' }).then(() => {
                          setNotifications(notifications.map(n => ({...n, is_read: 1})));
                        });
                      }}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                    {notifications.length > 0 ? (
                      <div className="divide-y divide-zinc-800">
                        {notifications.map((notif: Notification) => (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                               if (notif.action_url) window.location.href = notif.action_url;
                               setShowNotifications(false);
                            }}
                            className={`p-4 hover:bg-zinc-800/80 transition-all cursor-pointer relative group ${!notif.is_read ? 'bg-indigo-500/5' : ''}`}
                          >
                            {!notif.is_read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}
                            <div className="flex items-center justify-between mb-1">
                               <span className={`text-[11px] font-bold uppercase tracking-tight ${notif.type === 'critical' ? 'text-rose-400' : 'text-indigo-400'}`}>
                                 {notif.title}
                               </span>
                            </div>
                            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{notif.message}</p>
                            <div className="flex items-center justify-between mt-2">
                               <span className="text-[10px] text-zinc-600 font-mono">
                                 {new Date(notif.created_at).toLocaleTimeString()}
                               </span>
                               {notif.action_url && (
                                 <span className="text-[10px] text-indigo-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                   Lihat Detail &rarr;
                                 </span>
                               )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-10 text-center text-zinc-600">
                        <Bell className="w-10 h-10 opacity-10 mx-auto mb-3" />
                        <p className="text-sm">No recent activity</p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-zinc-800 bg-zinc-950/30 text-center">
                     <button 
                       onClick={() => { setShowNotifications(false); window.location.href = '/admin/notifications'; }}
                       className="text-xs text-zinc-500 hover:text-white transition-colors"
                     >
                       View All Logs
                     </button>
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

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 text-center">
                 <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500 ring-4 ring-rose-500/5">
                    <AlertTriangle className="w-8 h-8" />
                 </div>
                 <h3 className="text-xl font-bold text-white mb-2">Konfirmasi Logout</h3>
                 <p className="text-zinc-400 text-sm leading-relaxed">
                    Apakah Anda yakin ingin keluar dari sesi Administrator? Anda harus login kembali untuk mengakses panel ini.
                 </p>
              </div>
              <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 flex flex-col sm:flex-row gap-3">
                 <button 
                    onClick={() => setIsLogoutModalOpen(false)}
                    className="flex-1 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold transition-all"
                 >
                    Batal
                 </button>
                 <button 
                    onClick={() => {
                       setIsLogoutModalOpen(false);
                       onLogout();
                    }}
                    className="flex-1 px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-600/20"
                 >
                    Ya, Logout
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
