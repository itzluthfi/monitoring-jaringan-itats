import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, BookOpen, Save, Shield, BrainCircuit, Trash2, Clock, Globe, Moon, Sun } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { Loader } from '../components/common/Loader';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

export function SettingsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings State
  const [pollingRate, setPollingRate] = useState(10);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState(30);

  const fetchSettings = async () => {
    try {
      const [aiRes, retRes] = await Promise.all([
        authFetch('/api/settings/ai_analysis_enabled'),
        authFetch('/api/settings/log_retention_days')
      ]);

      if (aiRes.ok) {
        const data = await aiRes.json();
        setAiEnabled(data.value !== 'false');
      }
      
      if (retRes.ok) {
        const data = await retRes.json();
        setRetentionDays(parseInt(data.value || '30'));
      }

      // Polling rate is client-side persistent
      const localPolling = localStorage.getItem('notification_polling');
      if (localPolling) setPollingRate(parseInt(localPolling));

    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      // Save theme to localStorage and update document
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      
      // Save polling rate to localStorage
      localStorage.setItem('notification_polling', String(pollingRate));

      // Save AI status to DB
      await authFetch('/api/settings/ai_analysis_enabled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: String(aiEnabled) })
      });

      // Save Retention to DB
      await authFetch('/api/settings/log_retention_days', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: String(retentionDays) })
      });

      toast.success('System preferences saved successfully!');
    } catch (err) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const flushNotifications = async () => {
    const res = await Swal.fire({
      title: 'Flush Notifications?',
      text: "This will permanently delete all notification history.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Yes, wipe it!',
      background: '#18181b',
      color: '#fff'
    });

    if (res.isConfirmed) {
      try {
        const del = await authFetch('/api/notifications', { method: 'DELETE' });
        if (del.ok) toast.success('Notifications flushed');
        else throw new Error();
      } catch (e) {
        toast.error('Action failed');
      }
    }
  };

  const flushLogs = async () => {
    const res = await Swal.fire({
      title: 'Flush Telemetry Logs?',
      text: "All existing log records from all MikroTik devices will be destroyed.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Clean logs now',
      background: '#18181b',
      color: '#fff'
    });

    if (res.isConfirmed) {
      try {
        const del = await authFetch('/api/logs', { method: 'DELETE' });
        if (del.ok) toast.success('Telemetry logs destroyed');
        else throw new Error();
      } catch (e) {
        toast.error('Action failed');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader message="Loading system configuration..." />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white tracking-tight">Settings & Preferences</h2>
        <p className="text-zinc-400 mt-1">Manage portal config and system-wide data policies.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* General Section */}
          <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-400" /> Interface & Polling
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Notification Polling</label>
                <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      type="number" 
                      value={pollingRate} 
                      onChange={e => setPollingRate(parseInt(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors" 
                      placeholder="Interval in seconds"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-bold uppercase">sec</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Visual Theme</label>
                <div className="relative">
                    {theme === 'dark' ? <Moon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" /> : <Sun className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />}
                    <select 
                      value={theme}
                      onChange={e => setTheme(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 outline-none appearance-none"
                    >
                      <option value="dark">Deep Space (Dark)</option>
                      <option value="light">Pure Arctic (Light)</option>
                    </select>
                </div>
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 pt-4 border-t border-white/5">
              <BrainCircuit className="w-5 h-5 text-purple-400" /> AI Monitoring Engine
            </h3>
            
            <div className="space-y-6 mb-8">
               <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                     <p className="text-sm font-bold text-white">Nexus Intelligence Analytics</p>
                     <p className="text-xs text-zinc-500 mt-0.5">Allow AI to predict traffic congestion and generate density insights.</p>
                  </div>
                  <button 
                    onClick={() => setAiEnabled(!aiEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${aiEnabled ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
               </div>

               <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Telemetry Retention Policy</label>
                <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="1" 
                      max="180" 
                      value={retentionDays}
                      onChange={e => setRetentionDays(parseInt(e.target.value))}
                      className="flex-1 accent-indigo-500"
                    />
                    <div className="bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-xl border border-indigo-500/20 text-sm font-bold min-w-[100px] text-center">
                        {retentionDays} Days
                    </div>
                </div>
                <p className="text-[10px] text-zinc-600 mt-2 italic">Logs older than {retentionDays} days will be automatically pruned by the background worker.</p>
               </div>
            </div>

            <button 
              onClick={handleSaveGeneral}
              disabled={saving}
              className="group flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4 group-hover:rotate-12 transition-transform" />}
              {saving ? 'Saving...' : 'Commit Changes'}
            </button>
          </div>

          {/* Danger Zone */}
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 -mr-8 -mt-8 rounded-full blur-3xl" />
            <h3 className="text-xl font-bold text-rose-400 mb-4 flex items-center gap-2 relative z-10">
              <Shield className="w-5 h-5 text-rose-400" /> Danger Zone
            </h3>
            <p className="text-zinc-400 text-sm mb-6 relative z-10">Administrative actions for full database cleanup. Use with caution as these actions are irreversible.</p>
            
            <div className="flex flex-wrap gap-4 relative z-10">
              <button 
                onClick={flushNotifications}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 transition-all border border-rose-500/20 font-bold text-xs"
              >
                <Trash2 className="w-4 h-4" /> Flush Notifications
              </button>
              <button 
                onClick={flushLogs}
                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 text-zinc-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-white/5 font-bold text-xs"
              >
                <Trash2 className="w-4 h-4" /> Flush MikroTik Logs
              </button>
            </div>
          </div>
        </div>

        {/* Documentation Sidebar */}
        <div className="space-y-6">
          <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <BookOpen className="absolute top-4 right-4 w-12 h-12 text-zinc-800 opacity-20 group-hover:scale-110 group-hover:opacity-30 transition-all" />
            <h3 className="text-lg font-bold text-white mb-2 relative z-10">Documentation</h3>
            <p className="text-zinc-400 text-sm mb-6 relative z-10">Reference manual for extending the ITATS Monitoring system capabilities.</p>
            
            <ul className="space-y-4 relative z-10">
              {[
                { title: 'Connecting via SNMP', desc: 'Hardware discovery & setup' },
                { title: 'Bandwidth Control', desc: 'Simple Queue management' },
                { title: 'Nexus AI Engine', desc: 'Insight generation logic' },
                { title: 'API Integration', desc: 'External data webhooks' }
              ].map((item, idx) => (
                <li key={idx} className="group/item cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 group-hover/item:scale-150 transition-transform" />
                    <span className="text-sm font-bold text-indigo-400 group-hover/item:text-white transition-colors">{item.title}</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-0.5 ml-4.5">{item.desc}</p>
                </li>
              ))}
            </ul>

            <div className="mt-8 pt-6 border-t border-white/5 text-[10px] text-zinc-600">
               <p>Portal Build version: 1.4.2-stable</p>
               <p>© 2026 ITATS Monitoring Group</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
