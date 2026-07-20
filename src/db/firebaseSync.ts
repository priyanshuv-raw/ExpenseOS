import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, dbFirestore, onAuthStateChanged, isFirebaseConfigured, type User } from '../config/firebase';
import { db } from './db';

let currentUser: User | null = null;
let isSyncingFromCloud = false;
let pushTimeout: any = null;

// Real-time listener cleanup handle
let unsubscribeSnapshot: (() => void) | null = null;

// Sync Listeners
type SyncListener = (timestamp: Date) => void;
const syncListeners: Set<SyncListener> = new Set();

export function onSyncSuccess(listener: SyncListener) {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

function notifySyncSuccess() {
  const now = new Date();
  syncListeners.forEach(fn => {
    try {
      fn(now);
    } catch (e) {}
  });
}

/**
 * Completely clears local Dexie IndexedDB tables
 */
export async function clearLocalDatabase() {
  isSyncingFromCloud = true;
  try {
    await db.transaction('rw', [
      db.journal, db.expenses, db.fixedExpenses, db.accounts,
      db.outstanding, db.habits, db.habitLogs,
      db.settings, db.scheduledTransactions
    ], async () => {
      await Promise.all([
        db.journal.clear(),
        db.expenses.clear(),
        db.fixedExpenses.clear(),
        db.accounts.clear(),
        db.outstanding.clear(),
        db.habits.clear(),
        db.habitLogs.clear(),
        db.settings.clear(),
        db.scheduledTransactions.clear()
      ]);
    });
    console.log('🧹 Local database wiped clean for account separation.');
  } catch (err) {
    console.error('Error clearing local storage:', err);
  } finally {
    isSyncingFromCloud = false;
  }
}

/**
 * Pushes local Dexie database to Firebase Firestore under user's document
 */
export async function pushLocalToFirebase(userId?: string) {
  const targetUid = userId || currentUser?.uid || auth?.currentUser?.uid;
  if (isSyncingFromCloud || !dbFirestore || !targetUid) return;

  clearTimeout(pushTimeout);
  pushTimeout = setTimeout(async () => {
    if (isSyncingFromCloud) return;
    try {
      // Serialize arrays cleanly to prevent Firestore class/prototype rejection
      const journal = JSON.parse(JSON.stringify(await db.journal.toArray()));
      const expenses = JSON.parse(JSON.stringify(await db.expenses.toArray()));
      const fixedExpenses = JSON.parse(JSON.stringify(await db.fixedExpenses.toArray()));
      const accounts = JSON.parse(JSON.stringify(await db.accounts.toArray()));
      const outstanding = JSON.parse(JSON.stringify(await db.outstanding.toArray()));
      const habits = JSON.parse(JSON.stringify(await db.habits.toArray()));
      const habitLogs = JSON.parse(JSON.stringify(await db.habitLogs.toArray()));
      const settings = JSON.parse(JSON.stringify(await db.settings.toArray()));
      const scheduledTransactions = JSON.parse(JSON.stringify(await db.scheduledTransactions.toArray()));

      const data = {
        journal,
        expenses,
        fixedExpenses,
        accounts,
        outstanding,
        habits,
        habitLogs,
        settings,
        scheduledTransactions,
        updatedAt: new Date().toISOString()
      };

      const userDocRef = doc(dbFirestore, 'users', targetUid);
      await setDoc(userDocRef, data, { merge: true });
      console.log('☁️ Successfully synced data to Firestore Cloud!');
      notifySyncSuccess();
    } catch (err: any) {
      console.error('Firebase Cloud Push Error:', err);
    }
  }, 300);
}

/**
 * Initializes Firebase Real-time Auth & Cloud Sync listener
 */
export function initFirebaseSync(onUserChange?: (user: User | null) => void) {
  if (!isFirebaseConfigured() || !dbFirestore || !auth) return;

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (onUserChange) onUserChange(user);

    if (user) {
      // Unsubscribe existing listener if any
      if (unsubscribeSnapshot) unsubscribeSnapshot();

      const userDocRef = doc(dbFirestore, 'users', user.uid);

      // 1. Fetch initial user document to check if existing user or new user
      try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          // Existing user: hydrate local Dexie database from their cloud data
          const cloudData = docSnap.data();
          isSyncingFromCloud = true;
          await db.transaction('rw', [
            db.journal, db.expenses, db.fixedExpenses, db.accounts,
            db.outstanding, db.habits, db.habitLogs,
            db.settings, db.scheduledTransactions
          ], async () => {
            await db.journal.clear();
            if (cloudData.journal?.length) await db.journal.bulkPut(cloudData.journal);
            
            await db.expenses.clear();
            if (cloudData.expenses?.length) await db.expenses.bulkPut(cloudData.expenses);
            
            await db.fixedExpenses.clear();
            if (cloudData.fixedExpenses?.length) await db.fixedExpenses.bulkPut(cloudData.fixedExpenses);
            
            await db.accounts.clear();
            if (cloudData.accounts?.length) await db.accounts.bulkPut(cloudData.accounts);
            
            await db.outstanding.clear();
            if (cloudData.outstanding?.length) await db.outstanding.bulkPut(cloudData.outstanding);
            
            await db.habits.clear();
            if (cloudData.habits?.length) await db.habits.bulkPut(cloudData.habits);
            
            await db.habitLogs.clear();
            if (cloudData.habitLogs?.length) await db.habitLogs.bulkPut(cloudData.habitLogs);
            
            await db.settings.clear();
            if (cloudData.settings?.length) await db.settings.bulkPut(cloudData.settings);
            
            await db.scheduledTransactions.clear();
            if (cloudData.scheduledTransactions?.length) await db.scheduledTransactions.bulkPut(cloudData.scheduledTransactions);
          });
          isSyncingFromCloud = false;
          notifySyncSuccess();
        } else {
          // Brand-new user: wipe local IndexedDB clean so they get a 100% fresh empty workspace
          await clearLocalDatabase();
          await pushLocalToFirebase(user.uid);
        }
      } catch (e) {
        console.error('Error fetching initial user cloud profile:', e);
      }

      // 2. Attach real-time snapshot listener for changes from other devices
      unsubscribeSnapshot = onSnapshot(userDocRef, async (snapshot) => {
        if (!snapshot.exists() || snapshot.metadata.hasPendingWrites) return;

        const cloudData = snapshot.data();
        if (!cloudData) return;

        isSyncingFromCloud = true;

        try {
          await db.transaction('rw', [
            db.journal, db.expenses, db.fixedExpenses, db.accounts,
            db.outstanding, db.habits, db.habitLogs,
            db.settings, db.scheduledTransactions
          ], async () => {
            await db.journal.clear();
            if (cloudData.journal?.length) await db.journal.bulkPut(cloudData.journal);

            await db.expenses.clear();
            if (cloudData.expenses?.length) await db.expenses.bulkPut(cloudData.expenses);

            await db.fixedExpenses.clear();
            if (cloudData.fixedExpenses?.length) await db.fixedExpenses.bulkPut(cloudData.fixedExpenses);

            await db.accounts.clear();
            if (cloudData.accounts?.length) await db.accounts.bulkPut(cloudData.accounts);

            await db.outstanding.clear();
            if (cloudData.outstanding?.length) await db.outstanding.bulkPut(cloudData.outstanding);

            await db.habits.clear();
            if (cloudData.habits?.length) await db.habits.bulkPut(cloudData.habits);

            await db.habitLogs.clear();
            if (cloudData.habitLogs?.length) await db.habitLogs.bulkPut(cloudData.habitLogs);

            await db.settings.clear();
            if (cloudData.settings?.length) await db.settings.bulkPut(cloudData.settings);

            await db.scheduledTransactions.clear();
            if (cloudData.scheduledTransactions?.length) await db.scheduledTransactions.bulkPut(cloudData.scheduledTransactions);
          });
          notifySyncSuccess();
        } catch (err) {
          console.error('Error hydrating from Firebase Cloud:', err);
        } finally {
          isSyncingFromCloud = false;
        }
      });
    } else {
      // User logged out: clear snapshot listener & wipe local database clean!
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      await clearLocalDatabase();
    }
  });
}

// Hook into Dexie table mutations to trigger pushLocalToFirebase when user is logged in
[
  db.journal,
  db.expenses,
  db.fixedExpenses,
  db.accounts,
  db.outstanding,
  db.habits,
  db.habitLogs,
  db.settings,
  db.scheduledTransactions
].forEach(table => {
  table.hook('creating', () => {
    if (!isSyncingFromCloud && currentUser) pushLocalToFirebase();
  });
  table.hook('updating', () => {
    if (!isSyncingFromCloud && currentUser) pushLocalToFirebase();
  });
  table.hook('deleting', () => {
    if (!isSyncingFromCloud && currentUser) pushLocalToFirebase();
  });
});
