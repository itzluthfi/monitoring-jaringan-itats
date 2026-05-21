import { Globe, Search, MessageSquare, Plus } from 'lucide-react';

type ActiveTab = 'map' | 'search' | 'ticket' | 'report';

interface Props {
  isDark: boolean;
  active: ActiveTab;
  /** Only relevant on map page — opens left search drawer */
  onSearch?: () => void;
}

export default function PublicBottomBar({ isDark, active, onSearch }: Props) {
  const barBg = isDark
    ? 'bg-slate-950/95 border-white/10 shadow-cyan-950/30'
    : 'bg-white/96 border-black/8 shadow-slate-200/80';

  const activeClass = isDark
    ? 'bg-cyan-500/15 text-cyan-300'
    : 'bg-cyan-50 text-cyan-700';

  const inactiveClass = isDark
    ? 'text-zinc-500 hover:text-zinc-300'
    : 'text-slate-400 hover:text-slate-600';

  const btn = (tab: ActiveTab) =>
    `flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all ${
      active === tab ? activeClass : inactiveClass
    }`;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[800] lg:hidden">
      <div className={`rounded-[2rem] shadow-2xl backdrop-blur-xl border flex items-center justify-around py-2 px-1 ${barBg}`}>

        {/* Peta */}
        <button
          onClick={() => (window.location.href = '/')}
          className={btn('map')}
        >
          <Globe className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Peta</span>
        </button>

        {/* Cari — on map page opens drawer, on other pages goes to / */}
        <button
          onClick={() => {
            if (onSearch) { onSearch(); }
            else { window.location.href = '/'; }
          }}
          className={btn('search')}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Cari</span>
        </button>

        {/* Tiket */}
        <button
          onClick={() => (window.location.href = '/status-board')}
          className={`flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all ${
            active === 'ticket'
              ? isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
              : isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Tiket</span>
        </button>

        {/* Lapor */}
        <button
          onClick={() => (window.location.href = '/report')}
          className={`relative flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all ${
            active === 'report'
              ? isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-600'
              : isDark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-500 hover:text-rose-600'
          }`}
        >
          {active !== 'report' && (
            <span className="absolute top-1.5 right-3.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
          )}
          <Plus className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Lapor</span>
        </button>

      </div>
    </div>
  );
}
