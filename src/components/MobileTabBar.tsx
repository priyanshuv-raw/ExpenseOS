import React from 'react';
import { 
  CalendarDays, 
  Repeat, 
  Landmark, 
  CreditCard, 
  CheckSquare, 
  BarChart3, 
  Settings 
} from 'lucide-react';

interface MobileTabBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function MobileTabBar({ activeTab, setActiveTab }: MobileTabBarProps) {
  const tabs = [
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'fixed', label: 'Fixed', icon: Repeat },
    { id: 'accounts', label: 'Accounts', icon: Landmark },
    { id: 'outstanding', label: 'Debts', icon: CreditCard },
    { id: 'habits', label: 'Habits', icon: CheckSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="flex md:hidden items-center justify-around fixed bottom-0 left-0 right-0 z-40 bg-white/85 dark:bg-neutral-950/85 backdrop-blur-2xl border-t border-neutral-200/50 dark:border-neutral-800/50 py-1.5 px-1 transition-colors">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
              isActive 
                ? 'text-apple-blue font-bold scale-[1.05]' 
                : 'text-neutral-450 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
            <span className="text-[9px] tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
