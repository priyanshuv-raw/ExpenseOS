import React from 'react';
import type { User } from '../config/firebase';
import { Menu, PieChart, Sparkles, Moon, Sun } from 'lucide-react';
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
      case 'daily': return 'Daily Log';
      case 'fixed': return 'Fixed Expenses';
      case 'accounts': return 'Accounts';
      case 'outstanding': return 'Outstanding';
      case 'habits': return 'Habits & Routine';
      case 'analytics': return 'Analytics';
      case 'journal': return 'Journal & Notes';
      case 'settings': return 'Settings';
      default: return 'Life OS';
    }
  };

  return (
    <header className="flex md:hidden items-center justify-between px-4 py-3 fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-200/50 dark:border-neutral-800/50 transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenLeftSidebar}
          className="p-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:scale-[1.03] active:scale-[0.97] transition-transform"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <span className="text-xs font-black tracking-tight text-neutral-900 dark:text-white flex items-center gap-1">
            {getTabTitle()}
          </span>
          <span className="text-[9px] text-neutral-400 font-semibold leading-none">
            {format(new Date(), 'EEEE, d MMM')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Dark / Light Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400"
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
        </button>

        {/* Right Financial Summary Drawer Toggle */}
        <button
          onClick={onOpenRightSidebar}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black font-bold text-[10px] shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>Summary</span>
        </button>
      </div>
    </header>
  );
}
