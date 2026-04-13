import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Wifi, MapPin, Monitor, Server, Tag, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { Loader } from '../components/common/Loader';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';

export function AccessPointsView() {
  const [aps, setAps] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMikrotik, setFilterMikrotik] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAp, setEditingAp] = useState<any>(null);
  
  const [formData, setFormData] = useState({ mikrotik_id: '', name: '', group_label: '', lat: '', lng: '', ip_address: '' });

  const fetchAps = () => {
    let url = `/api/access-points?page=${page}&limit=${limit}`;
    if (filterType !== 'all') url += `&mode=${filterType}`;
    if (filterStatus !== 'all') url += `&status=${filterStatus}`;
    if (filterMikrotik !== 'all') url += `&mikrotik_id=${filterMikrotik}`;

    authFetch(url)
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.data)) {
          setAps(data.data);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      }).catch(console.error);
  };

  const fetchDevices = () => {
    authFetch('/api/mikrotiks')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setDevices(data);
      }).catch(console.error);
  };

  useEffect(() => {
    setLoading(true);
    let url = `/api/access-points?page=${page}&limit=${limit}`;
    if (filterType !== 'all') url += `&mode=${filterType}`;
    if (filterStatus !== 'all') url += `&status=${filterStatus}`;
    if (filterMikrotik !== 'all') url += `&mikrotik_id=${filterMikrotik}`;

    Promise.all([
      authFetch(url).then(r => r.json()),
      authFetch('/api/mikrotiks').then(r => r.json())
    ]).then(([apsData, devicesData]) => {
      if (apsData && Array.isArray(apsData.data)) {
        setAps(apsData.data);
        setTotal(apsData.total);
        setTotalPages(apsData.totalPages);
      }
      if (Array.isArray(devicesData)) setDevices(devicesData);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, [page, limit, filterType, filterStatus, filterMikrotik]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingAp ? `/api/access-points/${editingAp.id}` : '/api/access-points';
      const method = editingAp ? 'PUT' : 'POST';
      
      const payload = {
          ...formData,
          lat: parseFloat(formData.lat) || null,
          lng: parseFloat(formData.lng) || null
      };

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to save AP");
      toast.success(editingAp ? 'Access Point updated!' : 'Access Point added!');
      setIsModalOpen(false);
      setEditingAp(null);
      setFormData({ mikrotik_id: '', name: '', group_label: '', lat: '', lng: '', ip_address: '' });
      fetchAps();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This AP will be removed from the map and management list.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      authFetch(`/api/access-points/${id}`, { method: 'DELETE' })
        .then(() => {
          toast.success('Access Point deleted');
          fetchAps();
        }).catch(err => toast.error('Failed to delete'));
    }
  };

  const filteredAps = useMemo(() => {
    if (!searchTerm) return aps;
    const term = searchTerm.toLowerCase();
    return aps.filter(ap => 
      ap.name.toLowerCase().includes(term) || 
      (ap.mac_address || '').toLowerCase().includes(term) ||
      (ap.ip_address || '').toLowerCase().includes(term) ||
      (ap.group_label || '').toLowerCase().includes(term)
    );
  }, [aps, searchTerm]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader message="Synchronizing access point database..." />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-white tracking-tight">Access Points</h2>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <div className="space-y-1">
               <label className="text-[10px] text-zinc-500 uppercase font-bold ml-1">By Type</label>
               <select 
                 value={filterType} 
                 onChange={e => { setFilterType(e.target.value); setPage(1); }}
                 className="block w-40 bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
               >
                 <option value="all">All Types</option>
                 <option value="ap">Access Point</option>
                 <option value="infrastructure">Backbone</option>
               </select>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] text-zinc-500 uppercase font-bold ml-1">By Status</label>
               <select 
                 value={filterStatus} 
                 onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                 className="block w-40 bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
               >
                 <option value="all">All Status</option>
                 <option value="online">Online</option>
                 <option value="offline">Offline</option>
               </select>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] text-zinc-500 uppercase font-bold ml-1">By Router</label>
               <select 
                 value={filterMikrotik} 
                 onChange={e => { setFilterMikrotik(e.target.value); setPage(1); }}
                 className="block w-48 bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
               >
                 <option value="all">All Routers</option>
                 {devices.map(d => (
                   <option key={d.id} value={d.id}>{d.name}</option>
                 ))}
               </select>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] text-zinc-500 uppercase font-bold ml-1">Search</label>
               <input 
                 type="text"
                 placeholder="Search name, mac, ssid..."
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="block w-48 bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-600"
               />
            </div>
          </div>
        </div>
        <button 
          onClick={() => { 
            setEditingAp(null); 
            setFormData({ mikrotik_id: devices[0]?.id || '', name: '', group_label: '', lat: '', lng: '', ip_address: '' });
            setIsModalOpen(true); 
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 h-fit rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Add Access Point
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-zinc-400 uppercase bg-zinc-950/50 border-b border-zinc-800">
              <tr>
                 <th className="px-6 py-4 font-semibold">AP Name & IP</th>
                <th className="px-6 py-4 font-semibold">Uplink Router</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredAps.map((ap) => {
                const isOnline = ap.status === 'online';
                return (
                  <tr key={ap.id} className="hover:bg-zinc-800/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${ap.mode === 'infrastructure' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {ap.mode === 'infrastructure' ? <Server className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-white font-bold">{ap.name}</p>
                          <p className="text-xs text-zinc-500 font-mono mt-0.5">{ap.ip_address || (ap.mode === 'infrastructure' ? 'Core Node' : 'No dynamic IP')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-zinc-300">
                        <Monitor className="w-4 h-4 text-indigo-400" />
                        {ap.mikrotik_name || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                         ap.mode === 'infrastructure' 
                           ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' 
                           : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                       }`}>
                          {ap.mode === 'infrastructure' ? 'BACKBONE' : 'ACCESS POINT'}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`} title={ap.last_error ? `Error: ${ap.last_error}` : undefined}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                          {isOnline ? 'ONLINE' : 'OFFLINE'}
                          {ap.last_error && <AlertCircle className="w-3 h-3 text-rose-400 ml-0.5" />}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                       <button onClick={() => {
                          setEditingAp(ap);
                          setFormData({ 
                              mikrotik_id: String(ap.mikrotik_id), 
                              name: ap.name, 
                              group_label: ap.group_label || '', 
                              lat: ap.lat || '', 
                              lng: ap.lng || '',
                              ip_address: ap.ip_address || ''
                          });
                          setIsModalOpen(true);
                       }} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                         <Edit2 className="w-4 h-4" />
                       </button>
                       <button onClick={() => handleDelete(ap.id)} className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors">
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                );
              })}
              {aps.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Monitor className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-400">No access points configured.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {aps.length > 0 && (
          <div className="px-6 py-4 bg-zinc-950/20 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                 <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">Show per page</span>
                 <select 
                   value={limit}
                   onChange={(e) => {
                     setLimit(parseInt(e.target.value));
                     setPage(1);
                   }}
                   className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer"
                 >
                   <option value={10}>10</option>
                   <option value={25}>25</option>
                   <option value={50}>50</option>
                   <option value={100}>100</option>
                 </select>
               </div>
               <p className="text-xs text-zinc-500">
                 Showing <span className="text-white font-bold">{(page-1)*limit + 1}</span> to <span className="text-white font-bold">{Math.min(page*limit, total)}</span> of <span className="text-white font-bold">{total}</span> Access Points
               </p>
             </div>

             <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 disabled:opacity-20 hover:text-white transition-all"
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 disabled:opacity-20 hover:text-white transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 mx-2">
                  <span className="text-xs font-bold text-indigo-400 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md">{page}</span>
                  <span className="text-xs text-zinc-600 font-bold">/</span>
                  <span className="text-xs text-zinc-500 font-bold">{totalPages}</span>
                </div>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 disabled:opacity-20 hover:text-white transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 disabled:opacity-20 hover:text-white transition-all"
                  title="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
             </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800">
              <h3 className="text-xl font-bold text-white tracking-tight">
                {editingAp ? 'Edit Access Point' : 'Add New Access Point'}
              </h3>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Uplink Router / Controller</label>
                <select 
                   required
                   value={formData.mikrotik_id} 
                   onChange={e => setFormData({...formData, mikrotik_id: e.target.value})} 
                   className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                   <option value="" disabled>Select MikroTik...</option>
                   {devices.map(d => (
                       <option key={d.id} value={d.id}>{d.name}</option>
                   ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">AP Name / Identity</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all" placeholder="e.g. F-101" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">IP Address (Monitoring)</label>
                <input type="text" value={formData.ip_address} onChange={e => setFormData({...formData, ip_address: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 192.168.1.50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Group / Floor Label</label>
                <input type="text" value={formData.group_label} onChange={e => setFormData({...formData, group_label: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none" placeholder="e.g. Gedung F Lantai 1" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Map Latitude (Lat)</label>
                  <input type="number" step="any" value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 text-sm outline-none" placeholder="-7.29..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Map Longitude (Lng)</label>
                  <input type="number" step="any" value={formData.lng} onChange={e => setFormData({...formData, lng: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 text-sm outline-none" placeholder="112.77..." />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl font-medium transition-colors">Save Details</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2.5 rounded-xl font-medium transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
