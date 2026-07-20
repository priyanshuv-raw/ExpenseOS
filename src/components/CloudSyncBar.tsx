import React, { useState, useEffect } from 'react';
import { 
  signInWithGoogle, 
  logoutUser, 
  auth, 
  onAuthStateChanged, 
  isFirebaseConfigured, 
  type User 
} from '../config/firebase';
import { initFirebaseSync } from '../db/firebaseSync';
import { Cloud, CloudCheck, LogIn, LogOut, Sparkles, Key, Check } from 'lucide-react';

export function CloudSyncBar() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState<boolean>(false);
  const [configured, setConfigured] = useState<boolean>(isFirebaseConfigured());

  useEffect(() => {
    initFirebaseSync((u) => setUser(u));
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (err: any) {
      alert('Sign-In Error: ' + (err?.message || 'Could not complete Google Login. Check browser permissions.'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to sign out of your Dayledge account?')) {
      return;
    }
    try {
      setLoading(true);
      await logoutUser();
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200/80 dark:border-neutral-800 px-4 py-2 flex items-center justify-between text-xs font-medium">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-apple-blue/10 dark:bg-apple-blue/20 text-apple-blue">
          <Cloud className="w-3.5 h-3.5" />
        </div>
        <span className="text-neutral-600 dark:text-neutral-300 font-semibold hidden sm:inline">
          Cloud Live Sync:
        </span>
        
        {user ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CloudCheck className="w-3 h-3" />
            Live Synced to Cloud
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            Local Device Storage
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-2.5">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-5 h-5 rounded-full border border-neutral-300 dark:border-neutral-700" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-apple-purple text-white flex items-center justify-center font-bold text-[10px]">
                {user.displayName?.[0] || user.email?.[0] || 'U'}
              </div>
            )}
            <span className="text-neutral-800 dark:text-white font-bold hidden md:inline">
              {user.displayName || user.email}
            </span>
            <button
              onClick={handleLogout}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-neutral-500 hover:text-apple-red dark:hover:text-apple-red hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-apple-blue hover:bg-blue-600 text-white font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
