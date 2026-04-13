import React, { useState, useEffect, useCallback } from 'react';
import { 
  Brain, Cpu, Database, Network, RefreshCw, CheckCircle, 
  XCircle, AlertTriangle, Activity, Zap, Server, Router as RouterIcon,
  BarChart2, Play, RotateCcw, Wifi, Shield, Info, X, Key
} from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import toast from 'react-hot-toast';

function StatusDot({ online }: { online: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
  );
}

function MetricCard({ icon: Icon, label, value, sub, color = 'indigo', onClick }: any) {
  const cols: Record<string, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  return (
    <button 
      onClick={onClick}
      disabled={!onClick}
      className={`bg-zinc-900/50 border border-white/10 rounded-2xl p-5 flex items-start text-left gap-4 shadow-xl transition-all w-full
        ${onClick ? 'hover:bg-zinc-800 hover:border-white/20 hover:scale-[1.02] active:scale-95 cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`p-3 rounded-xl border ${cols[color] || cols.indigo}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-white mt-1">{value}</p>
        {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
      </div>
    </button>
  );
}

export function SmartCentralView() {
  const [devices, setDevices] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [testResults, setTestResults] = useState<Record<number, any>>({});
  const [snmpAvailability, setSnmpAvailability] = useState<Record<number, { success: boolean; checking: boolean; tested: boolean }>>({});
  const [testingId, setTestingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [resettingAI, setResettingAI] = useState(false);
  const [activeModal, setActiveModal] = useState<'none' | 'device_status' | 'driver_dist' | 'driver_info' | 'arch_info' | 'snmp_guide'>('none');
  const [selectedDeviceForGuide, setSelectedDeviceForGuide] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [devRes, driverRes, aiRes] = await Promise.all([
        authFetch('/api/mikrotiks').then(r => r.json()),
        authFetch('/api/adapters/drivers').then(r => r.json()),
        authFetch('/api/adapters/ai-status').then(r => r.json()),
      ]);
      if (Array.isArray(devRes)) setDevices(devRes);
      if (Array.isArray(driverRes)) setDrivers(driverRes);
      if (aiRes && !aiRes.error) setAiStatus(aiRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const testDevice = async (device: any) => {
    setTestingId(device.id);
    try {
      const res = await authFetch(`/api/adapters/device/${device.id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [device.id]: data }));
      toast[data.success ? 'success' : 'error'](
        data.success ? `${device.name}: Connected via ${data.driver}` : `${device.name}: ${data.error}`,
        { duration: 4000 }
      );
    } catch (e: any) {
      toast.error(`Test failed: ${e.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const checkSnmp = async (device: any) => {
    setSnmpAvailability(prev => ({ ...prev, [device.id]: { ...(prev[device.id] || {}), checking: true, tested: false } }));
    try {
      const res = await authFetch(`/api/adapters/device/${device.id}/test-snmp`, { method: 'POST' });
      const data = await res.json();
      setSnmpAvailability(prev => ({ 
        ...prev, 
        [device.id]: { success: data.success, checking: false, tested: true } 
      }));
      if (data.success) {
        toast.success(`SNMP available on ${device.name}`);
      }
    } catch (e) {
      setSnmpAvailability(prev => ({ 
        ...prev, 
        [device.id]: { success: false, checking: false, tested: true } 
      }));
    }
  };

  const changeDriver = async (deviceId: number, deviceName: string, currentDriver: string, newDriver: string) => {
    if (currentDriver === newDriver) return;
    const confirmed = window.confirm(
      `Ganti driver "${deviceName}" dari "${currentDriver.toUpperCase()}" ke "${newDriver.toUpperCase()}"?\n\nDevice mungkin perlu beberapa detik untuk reconnect.`
    );
    if (!confirmed) return;

    try {
      await authFetch(`/api/adapters/device/${deviceId}/driver`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver: newDriver }),
      });
      toast.success(`Driver "${deviceName}" diubah ke "${newDriver}"`);
      fetchAll();
    } catch (e) {
      toast.error('Gagal mengubah driver. Coba lagi.');
    }
  };


  const resetAI = async () => {
    setResettingAI(true);
    try {
      await authFetch('/api/adapters/ai-reset', { method: 'POST' });
      setAiStatus(null);
      toast.success('AI model cache cleared. Will re-train on next prediction call.');
      fetchAll();
    } catch (e) {
      toast.error('Failed to reset AI');
    } finally {
      setResettingAI(false);
    }
  };

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const driverMap: Record<string, number> = {};
  devices.forEach(d => { const dr = d.driver || 'mikrotik'; driverMap[dr] = (driverMap[dr] || 0) + 1; });

  return (
    <div className="p-6 md:p-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-400" />
            Smart Central
          </h2>
          <p className="text-zinc-400 mt-1">Multi-vendor adapter management & local AI engine control</p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-xl text-sm font-medium transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={Server} label="Total Devices" value={devices.length} sub={`${onlineCount} online`} color="indigo" onClick={() => setActiveModal('device_status')} />
        <MetricCard icon={Network} label="Active Drivers" value={Object.keys(driverMap).length} sub={Object.entries(driverMap).map(([k,v]) => `${k}: ${v}`).join(', ')} color="cyan" onClick={() => setActiveModal('driver_dist')} />
        <MetricCard icon={Brain} label="AI Engine" value={aiStatus?.hasModel ? 'Trained' : 'Idle'} sub={aiStatus?.lastTrainedAt ? `Last: ${new Date(aiStatus.lastTrainedAt).toLocaleTimeString()}` : 'Not yet trained'} color={aiStatus?.hasModel ? 'emerald' : 'amber'} onClick={() => setActiveModal('arch_info')} />
        <MetricCard icon={Cpu} label="Model Type" value={aiStatus?.modelType || 'N/A'} sub={`Window: ${aiStatus?.windowSize || 0} pts, Epochs: ${aiStatus?.epochs || 0}`} color="purple" onClick={() => setActiveModal('arch_info')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Driver Manager */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-white/10 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <RouterIcon className="w-5 h-5 text-cyan-400" />
              Device Driver Manager
            </span>
            <button onClick={() => setActiveModal('driver_info')} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-cyan-400 transition-colors" title="Adapter Support Info">
              <Info className="w-4 h-4" />
            </button>
          </h3>
          <p className="text-xs text-zinc-500 mb-5">Select the network protocol/adapter for each device. Use MikroTik API for RouterOS, or SNMP for multi-vendor support.</p>

          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
            {loading ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-zinc-800/50 rounded-xl animate-pulse" />
            )) : devices.map(device => {
              const test = testResults[device.id];
              const currentDriver = device.driver || 'mikrotik';
              return (
                <div key={device.id} className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <StatusDot online={device.status === 'online'} />
                      <div>
                        <p className="text-sm font-bold text-white">{device.name}</p>
                        <p className="text-xs text-zinc-500 font-mono">{device.host}:{device.port}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {test && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${test.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {test.success ? `✓ ${test.driver}` : '✗ Failed'}
                        </span>
                      )}
                      <button
                        onClick={() => testDevice(device)}
                        disabled={testingId === device.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        {testingId === device.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Test
                      </button>
                    </div>
                  </div>
                  
                  {/* Driver Selector */}
                  <div className="flex gap-2 flex-wrap">
                    {drivers.map(d => (
                      <button
                        key={d.id}
                        onClick={() => {
                          if (d.id === 'snmp' && (!snmpAvailability[device.id]?.tested || !snmpAvailability[device.id]?.success)) {
                            setSelectedDeviceForGuide(device);
                            setActiveModal('snmp_guide');
                          } else {
                            changeDriver(device.id, device.name, currentDriver, d.id);
                          }
                        }}
                        title={d.description}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${currentDriver === d.id 
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
                          : 'bg-zinc-900/50 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                        }`}
                      >
                        {d.id === 'mikrotik' ? '🔴' : '🔵'} 
                        <span>{d.id.toUpperCase()}</span>
                        {d.id === 'snmp' && (
                          <div 
                            onClick={(e) => { e.stopPropagation(); checkSnmp(device); }}
                            className={`w-2 h-2 rounded-full border border-black/20 ${
                              snmpAvailability[device.id]?.checking ? 'bg-amber-400 animate-spin border-dashed' :
                              snmpAvailability[device.id]?.success ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' :
                              snmpAvailability[device.id]?.tested ? 'bg-rose-500' : 'bg-zinc-600'
                            }`}
                            title={snmpAvailability[device.id]?.tested ? (snmpAvailability[device.id]?.success ? 'SNMP Active' : 'SNMP Offline') : 'Check SNMP Status'}
                          />
                        )}
                        {currentDriver === d.id && ' ✓'}
                      </button>
                    ))}
                  </div>

                  {/* Test result details */}
                  {test?.success && (
                    <div className="mt-2 flex items-center gap-4 text-[11px] text-zinc-500 font-mono bg-zinc-950/50 rounded-lg px-3 py-2 border border-zinc-800">
                      {test.identity && <span>ID: {test.identity}</span>}
                      {test.version && <span>v{test.version}</span>}
                      {test.uptime && <span>Up: {test.uptime}</span>}
                      {test.cpuLoad !== undefined && <span>CPU: {test.cpuLoad}%</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Engine Panel */}
        <div className="flex flex-col gap-4">
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                Local AI Engine
              </span>
              <button onClick={() => setActiveModal('arch_info')} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-purple-400 transition-colors" title="AI Model Architecture">
                <Info className="w-4 h-4" />
              </button>
            </h3>
            <p className="text-xs text-zinc-500 mb-4">TensorFlow.js CNN-1D model running locally — no external API needed.</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-xl">
                <span className="text-xs text-zinc-400 font-semibold">Status</span>
                <span className={`flex items-center gap-1.5 text-xs font-bold ${aiStatus?.hasModel ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <StatusDot online={aiStatus?.hasModel} />
                  {aiStatus?.hasModel ? 'Model Ready' : 'Not Trained'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-xl">
                <span className="text-xs text-zinc-400 font-semibold">Architecture</span>
                <span className="text-xs font-mono text-purple-300">{aiStatus?.modelType || 'CNN-1D'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-xl">
                <span className="text-xs text-zinc-400 font-semibold">Framework</span>
                <span className="text-xs font-mono text-cyan-300">TensorFlow.js</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-xl">
                <span className="text-xs text-zinc-400 font-semibold">Input Window</span>
                <span className="text-xs font-mono text-zinc-300">{aiStatus?.windowSize || 12} data points</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-xl">
                <span className="text-xs text-zinc-400 font-semibold">Training Status</span>
                <span className={`flex items-center gap-1.5 text-xs font-bold ${aiStatus?.isTraining ? 'text-amber-400' : 'text-zinc-500'}`}>
                  {aiStatus?.isTraining
                    ? <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" /> Training...</>
                    : 'Idle'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-xl">
                <span className="text-xs text-zinc-400 font-semibold">Training Epochs</span>
                <span className="text-xs font-mono text-zinc-300">{aiStatus?.epochs || 50}</span>
              </div>
              {aiStatus?.lastTrainedAt && (
                <div className="flex items-center justify-between p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-xl">
                  <span className="text-xs text-zinc-400 font-semibold">Last Trained</span>
                  <span className="text-xs font-mono text-zinc-300">{new Date(aiStatus.lastTrainedAt).toLocaleString()}</span>
                </div>
              )}
              {aiStatus?.cacheExpiresIn && (
                <div className="flex items-center justify-between p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-xl">
                  <span className="text-xs text-zinc-400 font-semibold">Cache Expires</span>
                  <span className="text-xs font-mono text-emerald-400">in {aiStatus.cacheExpiresIn}</span>
                </div>
              )}
              {aiStatus?.trainingLoss !== undefined && (
                <div className="flex items-center justify-between p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-xl">
                  <span className="text-xs text-zinc-400 font-semibold">Training Loss</span>
                  <span className="text-xs font-mono text-purple-300">{Number(aiStatus.trainingLoss).toFixed(6)}</span>
                </div>
              )}
            </div>

            <button
              onClick={resetAI}
              disabled={resettingAI}
              className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${resettingAI ? 'animate-spin' : ''}`} />
              {resettingAI ? 'Clearing...' : 'Reset AI Cache'}
            </button>
          </div>
        </div>
      </div>

      {/* Modals Overlay */}
      {activeModal !== 'none' && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
              <h3 className="font-bold text-white flex items-center gap-2 capitalize">
                {activeModal.replace('_', ' ')}
              </h3>
              <button 
                onClick={() => setActiveModal('none')}
                className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {/* Device Status Modal */}
              {activeModal === 'device_status' && (
                <div className="space-y-3">
                  {devices.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <StatusDot online={d.status === 'online'} />
                        <div>
                          <p className="text-sm font-bold text-zinc-200">{d.name}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">{d.host}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {d.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Driver Distribution Modal */}
              {activeModal === 'driver_dist' && (
                <div className="space-y-4">
                  {Object.entries(driverMap).map(([driver, count]) => (
                    <div key={driver} className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{driver}</span>
                        <span className="text-xs text-zinc-500 font-bold">{count} devices</span>
                      </div>
                      <div className="space-y-1">
                        {devices.filter(d => (d.driver || 'mikrotik') === driver).map(d => (
                          <div key={d.id} className="text-xs text-zinc-300 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50 flex items-center gap-2">
                             <div className={`w-1 h-3 rounded-full ${driver === 'mikrotik' ? 'bg-rose-500' : 'bg-cyan-500'}`} />
                             {d.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Driver Support Modal */}
              {activeModal === 'driver_info' && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                    Our multi-vendor adapter system allows seamless monitoring across different hardware using optimized drivers.
                  </p>
                  {drivers.map(d => (
                    <div key={d.id} className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-2">
                       <div className="flex items-center gap-2">
                          <span className="text-lg">{d.id === 'mikrotik' ? '🔴' : '🔵'}</span>
                          <span className="font-bold text-zinc-100">{d.label}</span>
                       </div>
                       <p className="text-xs text-zinc-500 leading-relaxed">{d.description}</p>
                       <div className="flex items-center gap-2 mt-2">
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span className="text-[10px] text-zinc-400 font-semibold">Port: {d.id === 'mikrotik' ? '8728 (API)' : '161 (SNMP)'}</span>
                       </div>
                    </div>
                  ))}
                </div>
              )}

              {/* System Architecture Modal */}
              {activeModal === 'arch_info' && (
                <div className="space-y-6">
                   <div>
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Backend Pipeline</h4>
                    <div className="space-y-2">
                      {[
                        { icon: Wifi, label: 'Network Devices', color: 'text-cyan-400', detail: 'MikroTik / SNMP / Ruijie' },
                        { icon: Network, label: 'Adapter Layer', color: 'text-indigo-400', detail: 'Driver Registry (Node.js)' },
                        { icon: Server, label: 'API Server', color: 'text-violet-400', detail: 'Express.js + REST API' },
                        { icon: Database, label: 'Database', color: 'text-emerald-400', detail: 'MySQL' },
                        { icon: Brain, label: 'AI Engine', color: 'text-purple-400', detail: 'TensorFlow.js CNN' },
                        { icon: BarChart2, label: 'Dashboard', color: 'text-amber-400', detail: 'React + Recharts' },
                      ].map((step, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/50 border border-zinc-800">
                          <step.icon className={`w-5 h-5 ${step.color}`} />
                          <div>
                            <p className="text-xs font-bold text-zinc-200">{step.label}</p>
                            <p className="text-[10px] text-zinc-500">{step.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                   </div>
                   <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                      <h4 className="text-xs font-bold text-purple-400 mb-2">AI Training Logic</h4>
                      <p className="text-[11px] text-purple-300/70 leading-relaxed">
                        🧠 The AI model trains automatically on your network's historical wifi density data. 
                        Reset clears the cache, forcing a fresh re-train on the next prediction request. 
                        Requires at least 17 historical data points. Uses CNN-1D for spatial-temporal patterns.
                      </p>
                    </div>
                </div>
              )}

               {/* SNMP Activation Guide Modal */}
               {activeModal === 'snmp_guide' && selectedDeviceForGuide && (
                 <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                       <div className="p-3 bg-rose-500/20 rounded-xl text-rose-400">
                         <AlertTriangle className="w-6 h-6" />
                       </div>
                       <div>
                         <h4 className="font-bold text-white">SNMP belum aktif</h4>
                         <p className="text-xs text-rose-300/70">Nexus tidak dapat terhubung ke {selectedDeviceForGuide.name} via SNMP.</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl">
                          <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                             <Key className="w-3.5 h-3.5" /> Cara Mengaktifkan (MikroTik)
                          </h5>
                          <p className="text-[11px] text-zinc-400 mb-3 leading-relaxed">Copy dan paste perintah berikut di New Terminal Winbox untuk mengaktifkan SNMP v2c standar:</p>
                          <div className="relative group">
                            <code className="block bg-black p-3 rounded-lg text-[11px] text-emerald-400 font-mono border border-zinc-800">
                               /snmp set enabled=yes contact="ITATS Admin"
                            </code>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText('/snmp set enabled=yes contact="ITATS Admin"');
                                toast.success('Copied to clipboard');
                              }}
                              className="absolute right-2 top-2 p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
                            Secara default, community adalah <strong className="text-white">public</strong> dan port <strong className="text-white">161</strong>. Jika Anda sudah mengubahnya, sesuaikan di pengaturan perangkat.
                          </p>
                       </div>

                       <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl">
                          <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Tips Troubleshooting</h5>
                          <ul className="space-y-2">
                             {[
                               'Pastikan port 161 (UDP) tidak diblokir di Firewall Input.',
                               'Cek apakah Community String di router sudah benar ("public").',
                               'Gunakan versi SNMP v2c untuk kompatibilitas terbaik.',
                             ].map((tip, i) => (
                               <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-500 italic">
                                 <span className="text-indigo-400 mt-0.5">•</span>
                                 {tip}
                               </li>
                             ))}
                          </ul>
                       </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                       <button 
                         onClick={() => { checkSnmp(selectedDeviceForGuide); }}
                         className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
                       >
                         Coba Check Lagi
                       </button>
                       <button 
                         onClick={() => {
                           changeDriver(selectedDeviceForGuide.id, selectedDeviceForGuide.name, selectedDeviceForGuide.driver, 'snmp');
                           setActiveModal('none');
                         }}
                         className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all"
                       >
                         Tetap Paksa Gunakan SNMP
                       </button>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
