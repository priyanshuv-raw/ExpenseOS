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
  Compass,
  Cloud,
  LogOut,
  LogIn
} from 'lucide-react';
import { 
  signInWithGoogle, 
  logoutUser, 
  auth, 
  onAuthStateChanged, 
  type User 
} from '../config/firebase';
import { initFirebaseSync } from '../db/firebaseSync';
import { format } from 'date-fns';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function Sidebar({ activeTab, setActiveTab, theme, toggleTheme }: SidebarProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');

  useEffect(() => {
    initFirebaseSync((u) => {
      setUser(u);
      setLastSyncTime(format(new Date(), 'HH:mm'));
    });
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLastSyncTime(format(new Date(), 'HH:mm'));
    });
    return () => unsubscribe();
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
    <aside className="w-64 h-screen fixed left-0 top-0 border-r border-neutral-150 dark:border-neutral-900 bg-white/70 dark:bg-neutral-950/70 backdrop-blur-md flex flex-col justify-between p-4 z-10">
      <div className="flex flex-col gap-6">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 px-2 pt-2">
          <div className="w-9 h-9 rounded-xl bg-apple-blue flex items-center justify-center shadow-md shadow-apple-blue/30">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight text-neutral-950 dark:text-neutral-50 font-sans">Life OS</h1>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider">Workspace</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 text-left ${isActive
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

      {/* Personal Information & Cloud Sync Bottom Card */}
      <div className="flex flex-col gap-3 border-t border-neutral-150 dark:border-neutral-900 pt-3">
        {user ? (
          <div className="p-3 rounded-2xl bg-neutral-100/80 dark:bg-neutral-900/80 border border-neutral-200/60 dark:border-neutral-800 flex flex-col gap-2.5 shadow-sm">
            {/* User Profile info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="w-8 h-8 rounded-full border border-neutral-300 dark:border-neutral-700 shrink-0" 
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-apple-purple text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {user.displayName?.[0] || user.email?.[0] || 'P'}
                  </div>
                )}
                <div className="flex flex-col truncate">
                  <span className="text-xs font-extrabold text-neutral-900 dark:text-white truncate">
                    {user.displayName || 'Priyanshu Kumar'}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
                    {user.email || 'Cloud Synced'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                disabled={loading}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-apple-red hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors shrink-0 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Cloud Sync Status & Last Sync Time */}
            <div className="pt-1.5 border-t border-neutral-200/50 dark:border-neutral-800/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  Live Synced to Cloud
                </span>
              </div>
              <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500">
                {lastSyncTime}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-neutral-100/80 dark:bg-neutral-900/80 border border-neutral-200/60 dark:border-neutral-800 flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center justify-between">
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
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-apple-blue hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          </div>
        )}

        {/* Theme Switcher Row */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500">Appearance</span>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 text-[11px] font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-3 h-3" /> Dark
              </>
            ) : (
              <>
                <Sun className="w-3 h-3 text-amber-400" /> Light
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
