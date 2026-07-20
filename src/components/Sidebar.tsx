import React, { useState, useEffect } from 'react';
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
  Cloud,
  LogOut,
  LogIn,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  signInWithGoogle, 
  logoutUser, 
  auth, 
  onAuthStateChanged, 
  type User 
} from '../config/firebase';
import { initFirebaseSync, onSyncSuccess } from '../db/firebaseSync';
import { format } from 'date-fns';
import { DayledgeLogo, DayledgeIcon } from './DayledgeLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface MenuGroup {
  title?: string;
  items: MenuItem[];
}

export function Sidebar({ 
  activeTab, 
  setActiveTab, 
  theme, 
  toggleTheme,
  isMobileOpen = false,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse
}: SidebarProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('18:02');

  useEffect(() => {
    initFirebaseSync((u) => {
      setUser(u);
      setLastSyncTime(format(new Date(), 'HH:mm'));
    });
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLastSyncTime(format(new Date(), 'HH:mm'));
    });
    const unsubscribeSync = onSyncSuccess((date) => {
      setLastSyncTime(format(date, 'HH:mm'));
    });
    return () => {
      unsubscribeAuth();
      unsubscribeSync();
    };
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      setLastSyncTime(format(new Date(), 'HH:mm'));
    } catch (err: any) {
      alert('Sign-In Error: ' + (err?.message || 'Could not complete Google Login. Check browser permissions.'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logoutUser();
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Grouped Navigation structure as shown in screenshot
  const menuGroups: MenuGroup[] = [
    {
      title: 'MAIN',
      items: [
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'outstanding', label: 'Outstanding', icon: CreditCard },
        { id: 'accounts', label: 'Accounts', icon: Landmark },
      ]
    },
    {
      title: 'MANAGEMENT',
      items: [
        { id: 'fixed-expenses', label: 'Fixed Recurring', icon: RefreshCw },
        { id: 'habits', label: 'Habits', icon: CheckSquare },
      ]
    },
    {
      title: 'INSIGHTS',
      items: [
        { id: 'statistics', label: 'Analytics', icon: BarChart3 },
        { id: 'search', label: 'Search & Activity', icon: Search },
      ]
    },
    {
      items: [
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    }
  ];

  const handleTabSelect = (tabId: string) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden animate-fade-in"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`h-screen fixed left-0 top-0 border-r border-neutral-200/50 dark:border-neutral-800/50 bg-white/95 dark:bg-neutral-950/95 md:bg-white/70 md:dark:bg-neutral-950/70 backdrop-blur-xl flex flex-col justify-between p-3.5 z-50 transition-all duration-300 ${
          isCollapsed ? 'md:w-20' : 'md:w-64'
        } w-64 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col gap-5 overflow-y-auto no-scrollbar">
          {/* Brand Header / Interactive Logo */}
          <div className="flex items-center justify-between px-1.5 pt-1">
            <div 
              onClick={() => handleTabSelect('calendar')}
              className="cursor-pointer group flex items-center gap-2 transition-transform active:scale-95 select-none"
              title={isCollapsed ? 'Dayledge OS' : undefined}
            >
              {isCollapsed ? (
                <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center group-hover:scale-105 group-hover:bg-apple-blue/10 transition-all">
                  <DayledgeIcon size={26} />
                </div>
              ) : (
                <DayledgeLogo iconSize={32} textClassName="text-lg font-extrabold tracking-tight group-hover:text-apple-blue transition-colors" />
              )}
            </div>

            {/* Desktop Collapse Toggle Button */}
            {onToggleCollapse && (
              <button 
                onClick={onToggleCollapse}
                className="hidden md:flex p-1.5 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-all cursor-pointer"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            )}

            {/* Mobile Close Button */}
            {onCloseMobile && (
              <button 
                onClick={onCloseMobile}
                className="md:hidden p-1.5 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Grouped Navigation Items */}
          <nav className="flex flex-col gap-4">
            {menuGroups.map((group, groupIdx) => (
              <div key={groupIdx} className="flex flex-col gap-1">
                {/* Group Title Header */}
                {group.title && !isCollapsed && (
                  <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-3 mb-1">
                    {group.title}
                  </span>
                )}

                {/* Group Items */}
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabSelect(item.id)}
                        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-xs transition-all duration-200 text-left relative group ${
                          isActive
                            ? 'bg-blue-500/10 dark:bg-blue-500/15 text-apple-blue font-bold shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium'
                        } ${isCollapsed ? 'justify-center px-1' : ''}`}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <div className={`p-1.5 rounded-xl transition-all ${
                          isActive 
                            ? 'bg-apple-blue text-white shadow-sm shadow-apple-blue/30' 
                            : 'text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {!isCollapsed && (
                          <span className="truncate tracking-tight">{item.label}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Divider Line between groups */}
                {groupIdx < menuGroups.length - 1 && (
                  <div className="border-t border-neutral-100 dark:border-neutral-900/60 my-1.5 mx-2" />
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Personal Information & Cloud Sync Bottom Card */}
        <div className="flex flex-col gap-3 border-t border-neutral-100 dark:border-neutral-900/80 pt-3">
          {user ? (
            <div className={`rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200/40 dark:border-neutral-800/40 flex flex-col gap-2.5 shadow-xs transition-all ${
              isCollapsed ? 'p-1.5 items-center' : 'p-3'
            }`}>
              {/* User Profile info */}
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || 'User'} 
                      className="w-8 h-8 rounded-full border border-neutral-200/60 dark:border-neutral-700/60 shrink-0" 
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {user.displayName?.[0] || user.email?.[0] || 'P'}
                    </div>
                  )}
                  {!isCollapsed && (
                    <div className="flex flex-col truncate">
                      <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                        {user.displayName || 'Priyanshu Kumar'}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
                        {user.email || 'priyanshu@gmail.com'}
                      </span>
                    </div>
                  )}
                </div>

                {!isCollapsed && (
                  <button
                    onClick={handleLogout}
                    disabled={loading}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-apple-red hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 transition-colors shrink-0 cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Cloud Sync Status & Last Sync Time */}
              {!isCollapsed && (
                <div className="pt-1.5 border-t border-neutral-200/30 dark:border-neutral-800/30 flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20" />
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Live Synced to Cloud
                    </span>
                  </div>
                  <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500">
                    {lastSyncTime}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className={`rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200/40 dark:border-neutral-800/40 flex flex-col gap-2 shadow-xs transition-all ${
              isCollapsed ? 'p-1.5 items-center' : 'p-3'
            }`}>
              {!isCollapsed ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-apple-blue/10 text-apple-blue">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        Personal Space
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        Local Device Storage
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-apple-blue hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleLogin}
                  className="p-2 rounded-xl bg-apple-blue text-white"
                  title="Sign in with Google"
                >
                  <LogIn className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Appearance Switcher Control */}
          <div className={`flex flex-col gap-1.5 ${isCollapsed ? 'items-center' : 'px-1'}`}>
            {!isCollapsed && (
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">Appearance</span>
            )}
            
            {!isCollapsed ? (
              <div className="bg-neutral-100/80 dark:bg-neutral-900/80 p-1 rounded-2xl flex items-center justify-between border border-neutral-200/50 dark:border-neutral-800/50">
                <button
                  onClick={() => theme !== 'light' && toggleTheme()}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-xl text-xs font-bold transition-all ${
                    theme === 'light'
                      ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200/50'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-500' : ''}`} />
                  <span>Light</span>
                </button>

                <button
                  onClick={() => theme !== 'dark' && toggleTheme()}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-xl text-xs font-bold transition-all ${
                    theme === 'dark'
                      ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/50'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-apple-blue' : ''}`} />
                  <span>Dark</span>
                </button>
              </div>
            ) : (
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 text-neutral-600 dark:text-neutral-300 hover:scale-105 active:scale-95 transition-all"
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              >
                {theme === 'light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-apple-blue" />}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
