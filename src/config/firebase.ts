import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';

// Get Firebase Config (from localStorage settings or Vite env)
export const getFirebaseConfig = () => {
  const stored = localStorage.getItem('lifeos_firebase_config');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {}
  }
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDEVAsna4_X2vQ2wRnys3PzPPQypy3VGz8",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "lifeos-raw.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "lifeos-raw",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "lifeos-raw.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "569995628681",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:569995628681:web:4d49ee5bc7d2f98a1b7658"
  };
};

const firebaseConfig = getFirebaseConfig();

// Check if valid config is provided
export const isFirebaseConfigured = () => {
  const cfg = getFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.projectId);
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore safely with fallback
let firestoreInstance: any = null;
try {
  firestoreInstance = getFirestore(app);
} catch (e) {
  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (err) {
    console.warn('Firestore initialization warning:', err);
  }
}

export const dbFirestore = firestoreInstance;

// Auth Helpers
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    const { clearLocalDatabase } = await import('../db/firebaseSync');
    await clearLocalDatabase();
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
    throw error;
  }
};

export { onAuthStateChanged, type User };
