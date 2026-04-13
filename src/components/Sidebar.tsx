import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LogOut, Monitor, Menu, Sun, Moon } from 'lucide-react';
import { NAVIGATION } from '../navigation';
import { NavLink, useNavigate } from 'react-router-dom';

function cn(...inputs: (string|undefined|null|false)[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  theme: string;
  setTheme: (theme: string) => void;
  onLogout: () => void;
  authUser: string;
  unreadCount?: number;
}

export function Sidebar({ 
  isOpen, 
  setIsOpen, 
  isCollapsed,
  setIsCollapsed,
  theme, 
  setTheme, 
  onLogout,
  authUser,
  unreadCount
}: SidebarProps) {
  const navigate = useNavigate();
  
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed md:static inset-y-0 left-0 z-50",
        "bg-zinc-950/90 backdrop-blur-xl border-r border-zinc-800/50 flex flex-col transition-all duration-300 ease-in-out",
        isCollapsed ? "md:w-20" : "md:w-64",
        "w-64", // Mobile width
        !isOpen && "-translate-x-full md:translate-x-0"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-800/50 overflow-hidden">
          <div className="flex items-center gap-3 cursor-pointer min-w-max" onClick={() => navigate('/admin/dashboard')}>
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-[8px] opacity-40"></div>
              <Monitor className="w-6 h-6 text-indigo-400 relative z-10" />
            </div>
            {!isCollapsed && (
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent animate-in fade-in duration-300">
                Nexus
              </span>
            )}
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-zinc-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto w-full custom-scrollbar py-4">
          <nav className="px-3 space-y-1">
            {!isCollapsed && (
              <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4 px-3 animate-in fade-in duration-300">
                Main Menu
              </div>
            )}
            
            {NAVIGATION.map((item) => {
              const Icon = item.icon;
              const path = `/admin/${item.id}`;
              
              return (
                <NavLink
                  key={item.id}
                  to={path}
                  title={isCollapsed ? item.label : ""}
                  onClick={() => {
                    if (window.innerWidth < 768) setIsOpen(false);
                  }}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group",
                    isCollapsed ? "justify-center" : "",
                    isActive 
                      ? "bg-indigo-500/10 text-indigo-400 shadow-[inset_0_0_15px_rgba(99,102,241,0.05)] border border-indigo-500/20" 
                      : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200 border border-transparent"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn("w-5 h-5 flex-shrink-0 transition-colors", isActive ? "text-indigo-400" : "text-zinc-500")} />
                      {!isCollapsed && <span className="flex-1 truncate animate-in slide-in-from-left-2 duration-300">{item.label}</span>}
                      
                      {/* Hover Tooltip for Collapsed Sidebar */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-4 px-3 py-2 bg-indigo-600 text-white text-[11px] font-bold rounded-lg shadow-xl opacity-0 translate-x-[-10px] pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 z-[100] whitespace-nowrap border border-indigo-500/50">
                          {item.label}
                          {/* Triangle arrow for tooltip */}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-indigo-600" />
                        </div>
                      )}

                      {item.id === 'notifications' && Boolean(unreadCount && unreadCount > 0) && (
                        <span className={cn(
                          "bg-rose-500 text-white text-[9px] font-black min-w-[20px] h-[20px] flex items-center justify-center rounded-full shadow-lg shadow-rose-500/20 border border-zinc-950",
                          isCollapsed ? "absolute top-1.5 right-1.5 scale-90" : "px-1.5 py-0.5"
                        )}>
                          {unreadCount > 100 ? '100+' : unreadCount}
                        </span>
                      )}
                    </>
                  )}

                </NavLink>

              );
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="p-3 border-t border-zinc-800/50 w-full space-y-2">
          {/* Theme Toggle */}
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              "w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:bg-white/[0.03] hover:text-white transition-all",
              isCollapsed ? "justify-center" : "gap-3"
            )}
            title={isCollapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : ""}
          >
            {theme === 'dark' ? <Moon className="w-5 h-5 flex-shrink-0" /> : <Sun className="w-5 h-5 flex-shrink-0" />}
            {!isCollapsed && <span className="animate-in fade-in duration-300">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>}
          </button>

          {/* User Profile / Logout */}
          <div className={cn(
            "flex items-center p-2 rounded-xl bg-zinc-900/50 border border-zinc-800/50",
            isCollapsed ? "flex-col gap-3 justify-center" : "gap-3"
          )}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 text-white font-black text-xs shadow-lg shadow-indigo-500/20">
              {authUser.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                <p className="text-[11px] font-bold text-zinc-200 truncate uppercase tracking-wider">{authUser}</p>
                <p className="text-[10px] text-zinc-500 truncate font-mono">ADMINISTRATOR</p>
              </div>
            )}
            <button 
              onClick={onLogout}
              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
