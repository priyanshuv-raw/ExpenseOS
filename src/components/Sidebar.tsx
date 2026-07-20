import React from 'react';
import {
  Calendar,
  RefreshCw,
  Landmark,
  CreditCard,
  CheckSquare,
  BarChart3,
  Search,
  Settings,
  Sun,
  Moon,
  Compass
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function Sidebar({ activeTab, setActiveTab, theme, toggleTheme }: SidebarProps) {
  const menuItems = [
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'fixed-expenses', label: 'Fixed Recurring', icon: RefreshCw },
    { id: 'accounts', label: 'Accounts', icon: Landmark },
    { id: 'outstanding', label: 'Outstanding', icon: CreditCard },
    { id: 'habits', label: 'Habits', icon: CheckSquare },
    { id: 'statistics', label: 'Analytics', icon: BarChart3 },
    { id: 'search', label: 'Search & Activity', icon: Search },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 border-r border-neutral-100 dark:border-neutral-900 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-md flex flex-col justify-between p-6 z-10">
      <div className="flex flex-col gap-8">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-lg bg-apple-blue flex items-center justify-center shadow-md shadow-apple-blue/30">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight text-neutral-950 dark:text-neutral-50 font-sans">Life OS</h1>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider">Workspace</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left ${isActive
                  ? 'bg-apple-blue text-white shadow-md shadow-apple-blue/20'
                  : 'text-neutral-500 dark:text-neutral-450 hover:bg-neutral-100 dark:hover:bg-neutral-900/60 hover:text-neutral-950 dark:hover:text-neutral-100'
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Theme Toggle */}
      <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-900 pt-4 px-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Personal Space</span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Offline-first</span>
        </div>
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-full flex items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-600 dark:text-neutral-350 hover:bg-neutral-150 dark:hover:bg-neutral-900 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
