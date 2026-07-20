import React, { useState } from 'react';
import { 
  CalendarDays, 
  Landmark, 
  CreditCard, 
  CheckSquare, 
  MoreHorizontal,
  Repeat,
  BarChart3,
  Search,
  Settings,
  BookOpen,
  X
} from 'lucide-react';

interface MobileTabBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function MobileTabBar({ activeTab, setActiveTab }: MobileTabBarProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const mainTabs = [
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'accounts', label: 'Accounts', icon: Landmark },
    { id: 'outstanding', label: 'Debts', icon: CreditCard },
    { id: 'habits', label: 'Habits', icon: CheckSquare },
    { id: 'more', label: 'More', icon: MoreHorizontal },
  ];

  const moreTabs = [
    { id: 'fixed-expenses', label: 'Fixed Recurring', desc: 'Subscriptions, EMI, Salary', icon: Repeat },
    { id: 'statistics', label: 'Analytics & Reports', desc: 'Breakdowns & spending trends', icon: BarChart3 },
    { id: 'search', label: 'Search & Activity', desc: 'Find past entries & receipts', icon: Search },
    { id: 'settings', label: 'Settings', desc: 'Preferences, backup, currency', icon: Settings },
  ];

  const handleTabClick = (tabId: string) => {
    if (tabId === 'more') {
      setShowMoreMenu(true);
    } else {
      setActiveTab(tabId);
      setShowMoreMenu(false);
    }
  };

  const isMoreActive = moreTabs.some(t => t.id === activeTab);

  return (
    <>
      {/* iOS Bottom Sheet for 'More' */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end bg-black/60 backdrop-blur-md animate-fade-in">
          <div 
            className="fixed inset-0"
            onClick={() => setShowMoreMenu(false)} 
          />
          <div className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 rounded-t-3xl p-5 relative z-10 animate-slide-up max-h-[80vh] overflow-y-auto">
            {/* iOS Sheet Grab Bar */}
            <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto mb-4" />
            
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-neutral-100 dark:border-neutral-850">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Workspace Shortcuts</h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {moreTabs.map(t => {
                const Icon = t.icon;
                const isSelected = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTab(t.id);
                      setShowMoreMenu(false);
                    }}
                    className={`flex items-center gap-3.5 p-3.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-apple-blue text-white border-apple-blue shadow-md shadow-apple-blue/20'
                        : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200/60 dark:border-neutral-800/60 text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-white/20 text-white' : 'bg-white dark:bg-neutral-900 text-apple-blue shadow-sm'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">{t.label}</div>
                      <div className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-neutral-400 dark:text-neutral-500'}`}>{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* iOS Bottom Navigation Bar */}
      <nav className="flex md:hidden items-center justify-around fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0d1b2a]/95 backdrop-blur-2xl border-t border-neutral-200/70 dark:border-neutral-800/80 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] px-3 transition-colors shadow-2xl">
        {mainTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = tab.id === 'more' ? (isMoreActive || showMoreMenu) : activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all active:scale-95 cursor-pointer ${
                isActive 
                  ? 'text-apple-blue font-bold' 
                  : 'text-neutral-450 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-apple-blue/15 dark:bg-apple-blue/25 text-apple-blue shadow-xs' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
              </div>
              <span className="text-[10px] tracking-tight font-semibold">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
