import React from 'react';
import type { User } from '../config/firebase';
import { Menu, PieChart, Moon, Sun, Compass } from 'lucide-react';
import { format } from 'date-fns';

interface MobileHeaderProps {
  user: User | null;
  onOpenLeftSidebar: () => void;
  onOpenRightSidebar: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  activeTab: string;
}

export function MobileHeader({
  user,
  onOpenLeftSidebar,
  onOpenRightSidebar,
  theme,
  toggleTheme,
  activeTab
}: MobileHeaderProps) {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'calendar': return 'Calendar';
      case 'fixed-expenses': return 'Fixed Recurring';
      case 'accounts': return 'Accounts';
      case 'outstanding': return 'Debts & Receivables';
      case 'habits': return 'Habits & Routines';
      case 'statistics': return 'Analytics';
      case 'search': return 'Search & Logs';
      case 'settings': return 'Settings';
      default: return 'Life OS';
    }
  };

  return (
    <header className="flex md:hidden items-center justify-between px-3.5 py-2.5 fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-2xl border-b border-neutral-200/60 dark:border-neutral-800/60 transition-colors shadow-sm">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenLeftSidebar}
          className="relative p-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 active:scale-95 transition-transform"
          aria-label="Open Navigation Menu"
        >
          {user?.photoURL ? (
            <img 
              src={user.photoURL} 
              alt={user.displayName || 'User'} 
              className="w-6 h-6 rounded-full border border-neutral-200 dark:border-neutral-700" 
            />
          ) : (
            <Compass className="w-5 h-5 text-apple-blue" />
          )}
          {user && (
            <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-950" />
          )}
        </button>

        <div className="flex flex-col">
          <span className="text-xs font-black tracking-tight text-neutral-900 dark:text-white flex items-center gap-1">
            {getTabTitle()}
          </span>
          <span className="text-[9px] text-neutral-450 dark:text-neutral-500 font-semibold leading-none">
            {format(new Date(), 'EEEE, d MMM')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Dark / Light Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-neutral-100/80 dark:bg-neutral-900/80 text-neutral-600 dark:text-neutral-400 active:scale-95 transition-transform"
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
        </button>

        {/* Right Financial Summary Drawer Toggle */}
        <button
          onClick={onOpenRightSidebar}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-black font-bold text-[10px] shadow-sm active:scale-95 transition-transform"
        >
          <PieChart className="w-3.5 h-3.5 text-apple-blue" />
          <span>Summary</span>
        </button>
      </div>
    </header>
  );
}
