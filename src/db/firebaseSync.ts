import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, dbFirestore, onAuthStateChanged, isFirebaseConfigured, type User } from '../config/firebase';
import { db } from './db';

let currentUser: User | null = null;
let isSyncingFromCloud = false;
let pushTimeout: any = null;

// Real-time listener cleanup handle
let unsubscribeSnapshot: (() => void) | null = null;

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
      console.log('☁️ Successfully synced all data (including Outstanding) to Firestore Cloud!');
    } catch (err: any) {
      console.error('Firebase Cloud Push Error:', err);
      if (err?.code === 'permission-denied') {
        console.warn('⚠️ Firestore Rules locked! Go to Firebase Console -> Firestore Database -> Rules tab, set: "allow read, write: if true;" or "if request.auth != null;"');
      }
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

      // Push local data to cloud on login to ensure cloud has latest data
      await pushLocalToFirebase(user.uid);

      // Listen for real-time cloud changes from other devices
      const userDocRef = doc(dbFirestore, 'users', user.uid);
      unsubscribeSnapshot = onSnapshot(userDocRef, async (snapshot) => {
        // Skip local pending write snapshots to prevent self-clearing loops
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
            if (cloudData.journal) {
              await db.journal.clear();
              if (cloudData.journal.length) await db.journal.bulkPut(cloudData.journal);
            }
            if (cloudData.expenses) {
              await db.expenses.clear();
              if (cloudData.expenses.length) await db.expenses.bulkPut(cloudData.expenses);
            }
            if (cloudData.fixedExpenses) {
              await db.fixedExpenses.clear();
              if (cloudData.fixedExpenses.length) await db.fixedExpenses.bulkPut(cloudData.fixedExpenses);
            }
            if (cloudData.accounts) {
              await db.accounts.clear();
              if (cloudData.accounts.length) await db.accounts.bulkPut(cloudData.accounts);
            }
            if (cloudData.outstanding) {
              await db.outstanding.clear();
              if (cloudData.outstanding.length) await db.outstanding.bulkPut(cloudData.outstanding);
            }
            if (cloudData.habits) {
              await db.habits.clear();
              if (cloudData.habits.length) await db.habits.bulkPut(cloudData.habits);
            }
            if (cloudData.habitLogs) {
              await db.habitLogs.clear();
              if (cloudData.habitLogs.length) await db.habitLogs.bulkPut(cloudData.habitLogs);
            }
            if (cloudData.settings) {
              await db.settings.clear();
              if (cloudData.settings.length) await db.settings.bulkPut(cloudData.settings);
            }
            if (cloudData.scheduledTransactions) {
              await db.scheduledTransactions.clear();
              if (cloudData.scheduledTransactions.length) await db.scheduledTransactions.bulkPut(cloudData.scheduledTransactions);
            }
          });
        } catch (err) {
          console.error('Error hydrating from Firebase Cloud:', err);
        } finally {
          isSyncingFromCloud = false;
        }
      });
    } else {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
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
    if (!isSyncingFromCloud) pushLocalToFirebase();
  });
  table.hook('updating', () => {
    if (!isSyncingFromCloud) pushLocalToFirebase();
  });
  table.hook('deleting', () => {
    if (!isSyncingFromCloud) pushLocalToFirebase();
  });
});
