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
import { ConfirmModal } from './ConfirmModal';

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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
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

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    try {
      setLoading(true);
      await logoutUser();
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Grouped Navigation structure matching screenshot
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
        className={`h-screen fixed left-0 top-0 border-r border-neutral-200/50 dark:border-neutral-800/50 bg-white/95 dark:bg-neutral-950/95 md:bg-white/70 md:dark:bg-neutral-950/70 backdrop-blur-xl flex flex-col justify-between z-50 transition-all duration-300 ${
          isCollapsed ? 'md:w-20 p-2.5 items-center' : 'md:w-64 p-4'
        } w-64 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Floating Border Expand / Collapse Toggle Button */}
        {onToggleCollapse && (
          <button 
            onClick={onToggleCollapse}
            className="hidden md:flex absolute -right-3.5 top-6 z-50 w-7 h-7 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-md items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}

        <div className={`flex flex-col gap-5 overflow-y-auto no-scrollbar w-full ${isCollapsed ? 'items-center' : ''}`}>
          {/* Brand Header / Interactive Logo */}
          <div className={`flex items-center justify-between w-full pt-1 ${isCollapsed ? 'justify-center px-0' : 'px-1.5'}`}>
            <div 
              onClick={() => {
                if (isCollapsed && onToggleCollapse) {
                  onToggleCollapse();
                } else {
                  handleTabSelect('calendar');
                }
              }}
              className="cursor-pointer group flex items-center gap-2 transition-transform active:scale-95 select-none"
              title={isCollapsed ? 'Click to Expand Sidebar' : 'Dayledge OS'}
            >
              {isCollapsed ? (
                <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center group-hover:scale-105 group-hover:bg-apple-blue/10 transition-all shadow-xs">
                  <DayledgeIcon size={24} />
                </div>
              ) : (
                <DayledgeLogo iconSize={32} textClassName="text-lg font-extrabold tracking-tight group-hover:text-apple-blue transition-colors" />
              )}
            </div>

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
          <nav className="flex flex-col gap-4 w-full">
            {menuGroups.map((group, groupIdx) => (
              <div key={groupIdx} className={`flex flex-col gap-1 w-full ${isCollapsed ? 'items-center' : ''}`}>
                {/* Group Title Header */}
                {group.title && !isCollapsed && (
                  <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-3 mb-1">
                    {group.title}
                  </span>
                )}

                {/* Group Items */}
                <div className={`flex flex-col gap-1 w-full ${isCollapsed ? 'items-center' : ''}`}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabSelect(item.id)}
                        className={`cursor-pointer transition-all duration-200 text-left relative group flex items-center ${
                          isCollapsed
                            ? 'w-10 h-10 rounded-2xl justify-center p-0 mx-auto'
                            : 'w-full gap-3 px-2.5 py-2 rounded-2xl text-xs'
                        } ${
                          isActive
                            ? 'bg-blue-500/10 dark:bg-blue-500/15 text-apple-blue font-bold shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium'
                        }`}
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
                  <div className={`border-t border-neutral-100 dark:border-neutral-900/60 my-1.5 ${isCollapsed ? 'w-8 mx-auto' : 'mx-2'}`} />
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Personal Information & Cloud Sync Bottom Section */}
        <div className={`flex flex-col gap-3 border-t border-neutral-100 dark:border-neutral-900/80 pt-3 w-full ${isCollapsed ? 'items-center' : ''}`}>
          {user ? (
            isCollapsed ? (
              /* Collapsed Profile Icon Badge */
              <button 
                onClick={handleLogout}
                disabled={loading}
                className="relative group p-0.5 rounded-full hover:ring-2 hover:ring-apple-blue transition-all cursor-pointer mx-auto"
                title={`${user.displayName || 'Priyanshu Kumar'} (Click to Sign Out)`}
              >
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="w-9 h-9 rounded-full border border-neutral-200 dark:border-neutral-700 object-cover" 
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-neutral-800 dark:bg-neutral-200 text-white dark:text-black flex items-center justify-center font-bold text-xs">
                    {user.displayName?.[0] || user.email?.[0] || 'P'}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-950" />
              </button>
            ) : (
              /* Expanded Full Profile Card */
              <div className="p-3 rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200/40 dark:border-neutral-800/40 flex flex-col gap-2.5 shadow-xs w-full">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {user.photoURL ? (
                      <img 
                        src={user.photoURL} 
                        alt={user.displayName || 'User'} 
                        className="w-8 h-8 rounded-full border border-neutral-200/60 dark:border-neutral-700/60 shrink-0 object-cover" 
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-neutral-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {user.displayName?.[0] || user.email?.[0] || 'P'}
                      </div>
                    )}
                    <div className="flex flex-col truncate">
                      <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                        {user.displayName || 'Priyanshu Kumar'}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
                        {user.email || 'priyanshu@gmail.com'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    disabled={loading}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-apple-red hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 transition-colors shrink-0 cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Cloud Sync Status & Last Sync Time */}
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
              </div>
            )
          ) : (
            isCollapsed ? (
              <button
                onClick={handleLogin}
                className="w-9 h-9 rounded-full bg-apple-blue text-white flex items-center justify-center shadow-xs mx-auto"
                title="Sign in with Google"
              >
                <LogIn className="w-4 h-4" />
              </button>
            ) : (
              <div className="p-3 rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200/40 dark:border-neutral-800/40 flex flex-col gap-2 shadow-xs w-full">
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
              </div>
            )
          )}

          {/* Appearance Switcher Control */}
          <div className={`flex flex-col gap-1.5 w-full ${isCollapsed ? 'items-center' : 'px-1'}`}>
            {!isCollapsed && (
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">Appearance</span>
            )}
            
            {!isCollapsed ? (
              <div className="bg-neutral-100/80 dark:bg-neutral-900/80 p-1 rounded-2xl flex items-center justify-between border border-neutral-200/50 dark:border-neutral-800/50 w-full">
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
                className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:scale-105 active:scale-95 transition-all mx-auto"
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              >
                {theme === 'light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-apple-blue" />}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Aesthetic Sign-Out Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        title="Sign Out of Dayledge?"
        description="Are you sure you want to sign out? Your offline habits and financial tracking data remain safe on this device."
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="danger"
        loading={loading}
      />
    </>
  );
}
