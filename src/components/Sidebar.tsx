import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LogOut, Monitor, Menu, Sun, Moon } from 'lucide-react';
import { useTranslatedNav } from '../navigation';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

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
  unreadTicketsCount?: number;
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
  unreadCount,
  unreadTicketsCount
}: SidebarProps) {
  const { t } = useTranslation();
  const { NAV_ITEMS } = useTranslatedNav();
  const navigate = useNavigate();
  
  return (
    <>
      {/* Mobile overlay — animated */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Drawer — slides in/out */}
      <AnimatePresence>
        {(isOpen) && (
          <motion.div
            key="mobile-sidebar"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950/95 backdrop-blur-xl border-r border-zinc-800/50 flex flex-col"
          >
            <SidebarContent
              isCollapsed={false}
              theme={theme}
              setTheme={setTheme}
              onLogout={onLogout}
              authUser={authUser}
              unreadCount={unreadCount}
              unreadTicketsCount={unreadTicketsCount}
              navigate={navigate}
              t={t}
              NAV_ITEMS={NAV_ITEMS}
              onLinkClick={() => setIsOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar — static with width transition */}
      <motion.div
        animate={{ width: isCollapsed ? 80 : 256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="hidden md:flex bg-zinc-950/90 backdrop-blur-xl border-r border-zinc-800/50 flex-col overflow-hidden h-screen shrink-0"
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          theme={theme}
          setTheme={setTheme}
          onLogout={onLogout}
          authUser={authUser}
          unreadCount={unreadCount}
          unreadTicketsCount={unreadTicketsCount}
          navigate={navigate}
          t={t}
          NAV_ITEMS={NAV_ITEMS}
          onLinkClick={() => {}}
        />
      </motion.div>
    </>
  );
}

// ── Inner Content (shared between mobile drawer and desktop sidebar) ──────────
function SidebarContent({
  isCollapsed, theme, setTheme, onLogout, authUser, unreadCount, unreadTicketsCount,
  navigate, t, NAV_ITEMS, onLinkClick
}: any) {
  return (
    <>
      {/* Logo header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-zinc-800/50 overflow-hidden shrink-0">
        <div
          className="flex items-center gap-3 cursor-pointer min-w-max"
          onClick={() => navigate('/admin/dashboard')}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-[8px] opacity-40" />
            <Monitor className="w-6 h-6 text-indigo-400 relative z-10" />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                key="logo-text"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent whitespace-nowrap"
              >
                Nexus
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nav items */}
      <div className={cn('flex-1 w-full custom-scrollbar py-4', isCollapsed ? 'overflow-visible' : 'overflow-y-auto')}>
        <nav className="px-3 space-y-1">
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                key="label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4 px-3"
              >
                Main Menu
              </motion.div>
            )}
          </AnimatePresence>

          {NAV_ITEMS.map((item: any) => {
            const Icon = item.icon;
            const path = `/admin/${item.id}`;
            const label = t(item.labelKey);

            return (
              <NavLink
                key={item.id}
                to={path}
                title={isCollapsed ? label : ''}
                onClick={onLinkClick}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group',
                  isCollapsed ? 'justify-center' : '',
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-400 shadow-[inset_0_0_15px_rgba(99,102,241,0.05)] border border-indigo-500/20'
                    : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200 border border-transparent'
                )}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('w-5 h-5 flex-shrink-0 transition-colors', isActive ? 'text-indigo-400' : 'text-zinc-500')} />

                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          key="nav-label"
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -6 }}
                          transition={{ duration: 0.15 }}
                          className="flex-1 truncate"
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Tooltip when collapsed */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-4 px-3 py-2 bg-indigo-600 text-white text-[11px] font-bold rounded-lg shadow-2xl opacity-0 translate-x-[-10px] pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 z-[999] whitespace-nowrap border border-indigo-500/50">
                        {label}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-indigo-600" />
                      </div>
                    )}

                    {item.id === 'notifications' && Boolean(unreadCount && unreadCount > 0) && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className={cn(
                          'bg-rose-500 text-white text-[9px] font-black min-w-[20px] h-[20px] flex items-center justify-center rounded-full shadow-lg shadow-rose-500/20 border border-zinc-950',
                          isCollapsed ? 'absolute top-1.5 right-1.5 scale-90' : 'px-1.5 py-0.5'
                        )}
                      >
                        {unreadCount! > 100 ? '100+' : unreadCount}
                      </motion.span>
                    )}

                    {item.id === 'tickets' && Boolean(unreadTicketsCount && unreadTicketsCount > 0) && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className={cn(
                          'bg-rose-500 text-white text-[9px] font-black min-w-[20px] h-[20px] flex items-center justify-center rounded-full shadow-lg shadow-rose-500/20 border border-zinc-950',
                          isCollapsed ? 'absolute top-1.5 right-1.5 scale-90' : 'px-1.5 py-0.5'
                        )}
                      >
                        {unreadTicketsCount! > 100 ? '100+' : unreadTicketsCount}
                      </motion.span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="p-3 border-t border-zinc-800/50 w-full space-y-2 shrink-0">
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:bg-white/[0.03] hover:text-white transition-all',
            isCollapsed ? 'justify-center' : 'gap-3'
          )}
          title={isCollapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : ''}
        >
          {theme === 'dark' ? <Moon className="w-5 h-5 flex-shrink-0" /> : <Sun className="w-5 h-5 flex-shrink-0" />}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                key="theme-label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User Profile / Logout */}
        <div className={cn(
          'flex items-center p-2 rounded-xl bg-zinc-900/50 border border-zinc-800/50',
          isCollapsed ? 'flex-col gap-3 justify-center' : 'gap-3'
        )}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 text-white font-black text-xs shadow-lg shadow-indigo-500/20">
            {authUser.charAt(0).toUpperCase()}
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                key="user-info"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0"
              >
                <p className="text-[11px] font-bold text-zinc-200 truncate uppercase tracking-wider">{authUser}</p>
                <p className="text-[10px] text-zinc-500 truncate font-mono">ADMINISTRATOR</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={onLogout}
            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
