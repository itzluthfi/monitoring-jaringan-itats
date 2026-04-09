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
  theme: string;
  setTheme: (theme: string) => void;
  onLogout: () => void;
  authUser: string;
  unreadCount?: number;
}

export function Sidebar({ 
  isOpen, 
  setIsOpen, 
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
        "w-64 bg-zinc-950/90 backdrop-blur-xl border-r border-white/10 flex flex-col transition-transform duration-300 ease-in-out",
        !isOpen && "-translate-x-full md:translate-x-0"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-800/50">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-[8px] opacity-40"></div>
              <Monitor className="w-6 h-6 text-indigo-400 relative z-10" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Nexus</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-zinc-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto w-full">
          <nav className="p-4 space-y-1">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-3">Main Navigation</div>
            
            {NAVIGATION.map((item) => {
              const Icon = item.icon;
              // Map navigation IDs to actual paths
              const path = `/admin/${item.id}`;
              
              return (
                <NavLink
                  key={item.id}
                  to={path}
                  onClick={() => {
                    if (window.innerWidth < 768) setIsOpen(false);
                  }}
                  className={({ isActive }) => cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-indigo-400" : "text-zinc-500")} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.id === 'notifications' && Boolean(unreadCount && unreadCount > 0) && (
                        <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                          {unreadCount}
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
        <div className="p-4 border-t border-zinc-800/50 w-full space-y-4">
          {/* Theme Toggle */}
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent transition-all"
          >
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
          </button>

          {/* User Profile / Logout */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 text-white font-bold shadow-lg shadow-indigo-500/20">
              {authUser.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{authUser}</p>
              <p className="text-xs text-zinc-500 truncate">System Admin</p>
            </div>
            <button 
              onClick={onLogout}
              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-md transition-colors"
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
