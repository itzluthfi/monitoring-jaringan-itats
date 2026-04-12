import React, { useEffect, useState } from 'react';
import { Bell, ShieldAlert, AlertTriangle, Info, Check, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { Loader } from '../components/common/Loader';

export function NotificationsView() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchNotifs = () => {
    authFetch(`/api/notifications?page=${page}&limit=${limit}`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.data)) {
          setNotifications(data.data);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifs();
    const int = setInterval(fetchNotifs, 15000); // Slower polling for notifications
    return () => clearInterval(int);
  }, [page, limit]);

  const markRead = (id: number) => {
    authFetch(`/api/notifications/${id}/read`, { method: 'POST' }).then(fetchNotifs);
  };

  const markAllRead = () => {
    authFetch('/api/notifications/read-all', { method: 'POST' }).then(fetchNotifs);
  };

  const deleteNotif = (id: number) => {
    authFetch(`/api/notifications/${id}`, { method: 'DELETE' }).then(fetchNotifs);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader message="Synchronizing critical system alerts..." />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-indigo-400" /> Notification Center
          </h2>
          <p className="text-zinc-400 mt-1">Review system alerts, errors, and informational events.</p>
        </div>
        {notifications.some(n => n.is_read === 0) && (
          <button 
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold text-sm rounded-xl hover:bg-indigo-500/20 transition-all"
          >
            <Check className="w-4 h-4" /> Mark All as Read
          </button>
        )}
      </div>

      <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-xl">
        {notifications.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center justify-center text-zinc-500">
             <Bell className="w-12 h-12 mb-4 opacity-30" />
             <p>No notifications logs right now.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map((notif: any) => {
              const isError = notif.type === 'error' || notif.type === 'critical';
              const isWarn = notif.type === 'warning';
              
              const Icon = isError ? ShieldAlert : isWarn ? AlertTriangle : Info;
              const colorClass = isError ? 'text-red-400 bg-red-400/10' : 
                                 isWarn ? 'text-amber-400 bg-amber-400/10' : 
                                 'text-indigo-400 bg-indigo-400/10';

              return (
                <div key={notif.id} className={`p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center transition-colors ${notif.is_read === 0 ? 'bg-white/5' : 'bg-transparent'}`}>
                  <div className={`p-3 rounded-xl flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`text-base font-bold truncate ${notif.is_read === 0 ? 'text-white' : 'text-zinc-300'}`}>
                        {notif.title}
                      </h4>
                      {notif.is_read === 0 && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 ml-1" />
                      )}
                    </div>
                    <p className={`text-sm ${notif.is_read === 0 ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs font-mono text-zinc-600">
                      <span>{new Date(notif.created_at).toLocaleString('id-ID')}</span>
                      {notif.device_name && (
                         <>
                           <span>•</span>
                           <span className="uppercase text-indigo-400/50">{notif.device_name}</span>
                         </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center self-end">
                    {notif.action_url && (
                        <button 
                          onClick={() => {
                              markRead(notif.id);
                              window.location.href = notif.action_url;
                          }}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20"
                        >
                          Investigasi
                        </button>
                    )}
                    {notif.is_read === 0 && (
                      <button 
                        onClick={() => markRead(notif.id)}
                        className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500/20 border border-indigo-500/20"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => deleteNotif(notif.id)}
                      className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Controls - Bottom */}
      {notifications.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/40 p-4 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">Show per page</span>
               <select 
                 value={limit}
                 onChange={(e) => {
                   setLimit(parseInt(e.target.value));
                   setPage(1); // Reset to first page
                 }}
                 className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1 outline-none focus:border-indigo-500 transition-all cursor-pointer"
               >
                 <option value={10}>10</option>
                 <option value={25}>25</option>
                 <option value={50}>50</option>
                 <option value={100}>100</option>
               </select>
             </div>
             <p className="text-xs text-zinc-400 font-medium whitespace-nowrap">
               Showing <span className="text-white font-bold">{(page-1)*limit + 1}</span> to <span className="text-white font-bold">{Math.min(page*limit, total)}</span> of <span className="text-white font-bold">{total}</span> notifications
             </p>
          </div>

          <div className="flex items-center gap-2">
            <button
               onClick={() => setPage(1)}
               disabled={page === 1}
               className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 disabled:opacity-20 disabled:cursor-not-allowed hover:text-white transition-all shadow-sm"
               title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
               onClick={() => setPage(p => Math.max(1, p - 1))}
               disabled={page === 1}
               className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 disabled:opacity-20 disabled:cursor-not-allowed hover:text-white transition-all shadow-sm"
               title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1 mx-2">
               <span className="text-xs font-bold text-indigo-400 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md shadow-inner">
                 {page}
               </span>
               <span className="text-xs text-zinc-600 font-bold">/</span>
               <span className="text-xs text-zinc-500 font-bold">
                 {totalPages || 1}
               </span>
            </div>

            <button
               onClick={() => setPage(p => Math.min(totalPages, p + 1))}
               disabled={page >= totalPages}
               className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 disabled:opacity-20 disabled:cursor-not-allowed hover:text-white transition-all shadow-sm"
               title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
               onClick={() => setPage(totalPages)}
               disabled={page >= totalPages}
               className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 disabled:opacity-20 disabled:cursor-not-allowed hover:text-white transition-all shadow-sm"
               title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
