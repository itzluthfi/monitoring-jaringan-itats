import React, { useState, useEffect } from 'react';
import { Network, Plus, Shield, Server, Edit, Trash2, CheckCircle, XCircle, Clock, Info, AlertTriangle, Key, ExternalLink } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { Loader } from '../components/common/Loader';
import Swal from 'sweetalert2';

interface Controller {
  id: number;
  name: string;
  type: 'unifi' | 'omada' | 'ruijie' | 'snmp';
  host: string;
  user: string;
  status: 'online' | 'error' | 'unknown';
  last_error: string | null;
  last_sync: string | null;
}

export function ControllersView() {
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<any>({});
  const [showModal, setShowModal] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'unifi',
    host: '',
    user: '',
    password: '',
    site: 'default'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ctrlsRes, typesRes] = await Promise.all([
        authFetch('/api/controllers'),
        authFetch('/api/controllers/types')
      ]);
      setControllers(await ctrlsRes.json());
      setTypes(await typesRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      const res = await authFetch(`/api/controllers/${id}/test`, { method: 'POST' });
      const result = await res.json();
      
      if (result.success) {
        Swal.fire({
          title: 'Connection Successful!',
          text: `Nexus is successfully talking to ${result.driver || 'the controller'}.`,
          icon: 'success',
          background: '#18181b',
          color: '#fff',
          confirmButtonColor: '#6366f1'
        });
      } else {
        Swal.fire({
          title: 'Connection Failed',
          html: `
            <div class="text-left text-sm">
              <p class="text-rose-400 font-bold mb-2">Error: ${result.error}</p>
              <div class="bg-zinc-800 p-3 rounded-lg border border-zinc-700">
                <p class="text-zinc-300"><strong>Hint:</strong> ${result.hint || 'Check credentials and network access.'}</p>
              </div>
            </div>
          `,
          icon: 'error',
          background: '#18181b',
          color: '#fff',
          confirmButtonColor: '#e23b3b'
        });
      }
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setTestingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/controllers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          extra_config: { site: formData.site }
        })
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
        Swal.fire({
          title: 'Controller Added',
          text: 'New data source has been registered.',
          icon: 'success',
          background: '#18181b',
          color: '#fff',
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    const result = await Swal.fire({
      title: 'Hapus Controller?',
      text: `Semua data client dari "${name}" tidak akan muncul lagi di dashboard.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e23b3b',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Ya, Hapus',
      background: '#18181b',
      color: '#fff'
    });

    if (result.isConfirmed) {
      await authFetch(`/api/controllers/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  if (loading) return <Loader message="Sinking with external infrastructure..." />;

  const currentTypeMeta = types[formData.type] || {};

  return (
    <div className="p-6 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Adapters & External Controllers</h2>
          <p className="text-zinc-400 text-sm mt-1">Manage 3rd-party integrations like UniFi, Omada, and Ruijie.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-5 h-5" /> Add New Controller
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {controllers.map(ctrl => (
          <div key={ctrl.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col group hover:border-indigo-500/50 transition-all">
            <div className="p-5 flex-1">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Server className="w-6 h-6" />
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  ctrl.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  ctrl.status === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  'bg-zinc-800 text-zinc-500 border border-zinc-700'
                }`}>
                  {ctrl.status}
                </span>
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1">{ctrl.name}</h3>
              <p className="text-xs text-zinc-500 font-mono mb-4">{ctrl.host}</p>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Vendor Type</span>
                  <span className="text-zinc-300 font-bold uppercase">{ctrl.type}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Last Sync</span>
                  <span className="text-zinc-300">{ctrl.last_sync ? new Date(ctrl.last_sync).toLocaleTimeString() : 'Never'}</span>
                </div>
              </div>

              {ctrl.status === 'error' && (
                <div className="mt-4 p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> Last Error
                  </p>
                  <p className="text-[10px] text-rose-300/70 leading-relaxed italic line-clamp-2">{ctrl.last_error}</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-zinc-950/50 border-t border-zinc-800 flex items-center gap-2">
              <button 
                onClick={() => handleTest(ctrl.id)}
                disabled={testingId === ctrl.id}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg transition-all disabled:opacity-50"
              >
                {testingId === ctrl.id ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Test Connection
              </button>
              <button 
                onClick={() => handleDelete(ctrl.id, ctrl.name)}
                className="p-2 text-zinc-600 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {controllers.length === 0 && (
          <div className="col-span-full py-20 bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-zinc-600">
             <Network className="w-16 h-16 opacity-10 mb-4" />
             <p className="font-bold text-zinc-400">No active controllers detected</p>
             <p className="text-xs max-w-xs text-center mt-2">Connect your UniFi, Omada, or Ruijie infrastructure to start monitoring multi-vendor clients in real-time.</p>
          </div>
        )}
      </div>

      {/* Modal / Add Form */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
                <h3 className="font-bold text-white flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <Plus className="w-5 h-5" />
                  </div>
                  Add Network Controller
                </h3>
                <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row h-full max-h-[70vh]">
                {/* Form Side */}
                <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">Vendor Protocol</label>
                        <select 
                          value={formData.type}
                          onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {Object.entries(types).map(([id, meta]: any) => (
                            <option key={id} value={id}>{meta.label}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">Controller Name</label>
                        <input 
                          required
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          placeholder="e.g. UniFi ITATS Campus"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">Host URL / IP (with port)</label>
                        <input 
                          required
                          value={formData.host}
                          onChange={e => setFormData({...formData, host: e.target.value})}
                          placeholder="e.g. 192.168.1.50:8443"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">API User</label>
                        <input 
                          value={formData.user}
                          onChange={e => setFormData({...formData, user: e.target.value})}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">API Password</label>
                        <input 
                          type="password"
                          value={formData.password}
                          onChange={e => setFormData({...formData, password: e.target.value})}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {formData.type === 'unifi' && (
                        <div className="col-span-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5 block">UniFi Site ID (usually 'default')</label>
                          <input 
                            value={formData.site}
                            onChange={e => setFormData({...formData, site: e.target.value})}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                   </div>

                   <div className="pt-4 flex gap-3">
                      <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20">
                        Register Controller
                      </button>
                   </div>
                </form>

                {/* Instructions Side */}
                <div className="w-full md:w-72 bg-zinc-950/80 p-6 border-l border-zinc-800 overflow-y-auto custom-scrollbar">
                   <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                     <Info className="w-3.5 h-3.5" /> Setup Guide
                   </p>
                   
                   <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-bold text-white mb-2">{currentTypeMeta.label}</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed mb-4">{currentTypeMeta.description}</p>
                        
                        <div className="bg-indigo-500/5 border border-indigo-500/20 p-3 rounded-xl">
                           <p className="text-[11px] text-indigo-300 font-medium italic">
                             &ldquo;{currentTypeMeta.hint}&rdquo;
                           </p>
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="flex items-start gap-3">
                           <div className="w-5 h-5 rounded-full bg-zinc-800 text-[10px] flex items-center justify-center text-zinc-400 flex-shrink-0 mt-0.5">1</div>
                           <p className="text-[11px] text-zinc-500">Gunakan User dengan hak akses <strong>Read-Only</strong> minimal untuk keamanan.</p>
                        </div>
                        <div className="flex items-start gap-3">
                           <div className="w-5 h-5 rounded-full bg-zinc-800 text-[10px] flex items-center justify-center text-zinc-400 flex-shrink-0 mt-0.5">2</div>
                           <p className="text-[11px] text-zinc-500">Jika menggunakan port default, port UniFi adalah <strong>8443</strong> atau <strong>443</strong>.</p>
                        </div>
                        <div className="flex items-start gap-3">
                           <div className="w-5 h-5 rounded-full bg-zinc-800 text-[10px] flex items-center justify-center text-zinc-400 flex-shrink-0 mt-0.5">3</div>
                           <p className="text-[11px] text-zinc-500">Nexus akan mengabaikan sertifikat self-signed secara otomatis.</p>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

const X = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

const RefreshCw = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
);
