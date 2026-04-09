import React from 'react';
import { Settings as SettingsIcon, BookOpen, Save, Shield } from 'lucide-react';

export function SettingsView() {
  return (
    <div className="p-6 md:p-8 animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white tracking-tight">Settings & Preferences</h2>
        <p className="text-zinc-400 mt-1">Manage portal config and read system documentation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-indigo-400" /> General Preferences
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider block mb-2">Notification Polling (Seconds)</label>
                <input 
                  type="number" 
                  defaultValue={10} 
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50" 
                />
              </div>

              <div>
                <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider block mb-2">Theme Mode</label>
                <select className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 outline-none">
                  <option>Dark (Default)</option>
                  <option disabled>Light (Coming Soon)</option>
                </select>
              </div>

              <button className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg transition-colors">
                <Save className="w-4 h-4" /> Save Preferences
              </button>
            </div>
          </div>

          <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-400" /> Danger Zone
            </h3>
            <p className="text-zinc-400 text-sm mb-4">Wipe data logs and restart background workers. This cannot be undone.</p>
            <button className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/30 font-bold text-sm">
               Flush Notification Logs
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <BookOpen className="absolute top-4 right-4 w-12 h-12 text-zinc-800 opacity-20 group-hover:scale-110 group-hover:opacity-30 transition-all" />
            <h3 className="text-lg font-bold text-white mb-2 relative z-10">Documentation</h3>
            <p className="text-zinc-400 text-sm mb-6 relative z-10">Read the manual on how to attach new Mikrotik devices.</p>
            
            <ul className="space-y-3 relative z-10 text-sm text-indigo-400 underline underline-offset-4 decoration-white/20">
              <li><a href="#">Connecting via SNMP</a></li>
              <li><a href="#">Managing Bandwidth</a></li>
              <li><a href="#">VLAN Graphing Logic</a></li>
              <li><a href="#">Gemini AI Integrations</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
