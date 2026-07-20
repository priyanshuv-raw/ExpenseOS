import Dexie, { type Table } from 'dexie';
import { format } from 'date-fns';
import initialData from '../../data/db.json';

// Interfaces for our database entities
export interface JournalEntry {
  date: string; // YYYY-MM-DD (primary key)
  content: string; // Rich text HTML/Markdown
  mood: '😊' | '😄' | '😐' | '😔' | '😢' | '';
  energy: number; // 1-5
  stress: number; // 1-5
  sleepHours: number;
  wakeTime: string; // HH:MM
  sleepTime: string; // HH:MM
  cigarettes: number;
}

export interface Expense {
  id: string; // UUID
  amount: number;
  category: string;
  account: string; // Account ID e.g., 'axis', 'hdfc', 'cash'
  paymentType: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  receiptImage?: string; // base64 string
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  repeat: 'Monthly' | 'Yearly';
  dueDate: number; // Day of month (1-31)
  category: string;
  autoGenerate: boolean;
  lastGeneratedMonth: string; // YYYY-MM to prevent double generation
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  openingBalance: number;
  icon?: string; // Optional icon identifier (e.g. 'bank', 'coins')
}

export interface OutstandingDebt {
  id: string;
  name: string;
  type: 'Credit Card' | 'Loan' | 'Friend' | 'Family';
  outstandingAmount: number;
  interest: number; // % annual interest
  dueDate: string; // YYYY-MM-DD or date string
  minimumDue: number;
  status: 'active' | 'paid';
  paymentHistory: { date: string; amount: number }[];
  cardLimit?: number; // Configurable limit for credit cards
  direction?: 'borrowed' | 'lent'; // borrowed = liability (I owe them), lent = receivable (They owe me)
}

export interface Habit {
  id: string;
  name: string;
  isDefault: boolean;
  active: boolean;
  createdAt: string; // YYYY-MM-DD
  icon: string; // Lucide icon lookup string
  order?: number; // Reorder index
}

export interface HabitLog {
  id?: number;
  date: string; // YYYY-MM-DD
  habitId: string;
  completed: boolean;
}

export interface Setting {
  key: string;
  value: any;
}

export interface ScheduledTransaction {
  id: string; // UUID
  name: string;
  amount: number;
  type: 'Income' | 'Expense';
  category: string;
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'completed' | 'skipped';
}

// Subclass Dexie to define database
class LifeOSDatabase extends Dexie {
  journal!: Table<JournalEntry, string>;
  expenses!: Table<Expense, string>;
  fixedExpenses!: Table<FixedExpense, string>;
  accounts!: Table<Account, string>;
  outstanding!: Table<OutstandingDebt, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, number>;
  settings!: Table<Setting, string>;
  scheduledTransactions!: Table<ScheduledTransaction, string>;

  constructor() {
    super('LifeOSDatabase');
    
    // Schema definition
    this.version(1).stores({
      journal: 'date, mood, energy, stress',
      expenses: 'id, amount, category, account, paymentType, date',
      fixedExpenses: 'id, name, repeat, dueDate, category, autoGenerate',
      accounts: 'id, name, balance',
      outstanding: 'id, name, type, status, dueDate',
      habits: 'id, name, isDefault, active',
      habitLogs: '++id, date, habitId, [date+habitId]',
      settings: 'key',
      scheduledTransactions: 'id, name, amount, type, category, dueDate, status'
    });
  }
}

export const db = new LifeOSDatabase();

// Sync Bridge for File Storage (data/db.json)
let isHydratingFromFile = false;
let saveTimeout: any = null;
export async function saveToFileStorage() {
  if (isHydratingFromFile) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      const data = {
        journal: await db.journal.toArray(),
        expenses: await db.expenses.toArray(),
        fixedExpenses: await db.fixedExpenses.toArray(),
        accounts: await db.accounts.toArray(),
        outstanding: await db.outstanding.toArray(),
        habits: await db.habits.toArray(),
        habitLogs: await db.habitLogs.toArray(),
        settings: await db.settings.toArray(),
        scheduledTransactions: await db.scheduledTransactions.toArray(),
      };
      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data, null, 2),
      });
    } catch (err) {
      console.error('Error syncing to file storage:', err);
    }
  }, 300);
}

// Attach mutation hooks to auto-sync every C/R/U/D operation to data/db.json
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
  table.hook('creating', () => { saveToFileStorage(); });
  table.hook('updating', () => { saveToFileStorage(); });
  table.hook('deleting', () => { saveToFileStorage(); });
});

// Embedded initial seed dataset directly inside db.ts
export const INITIAL_SEED_DATA = {
  journal: [
    {
      date: "2026-07-20",
      content: "",
      mood: "😐",
      energy: 3,
      stress: 2,
      sleepHours: 9,
      wakeTime: "07:00",
      sleepTime: "23:00",
      cigarettes: 0
    }
  ],
  expenses: [
    {
      id: "c0072d7b-adb5-4e3c-a27a-ee44f581f2c2",
      amount: 10,
      category: "Travel",
      account: "hdfc",
      paymentType: "Cash",
      description: "Rickshaw",
      date: "2026-07-20",
      time: "10:34"
    },
    {
      id: "c5b97b27-8ff3-439a-a0ba-c5fa680e7c3c",
      amount: 26,
      category: "Other",
      account: "aa9e440b-9042-4db8-bd6f-5a87014191d4",
      paymentType: "HDFC Bank",
      description: "Cig",
      date: "2026-07-20",
      time: "12:35"
    },
    {
      id: "d056902f-b181-4d13-aca2-6bd6ec71cb76",
      amount: 30,
      category: "Food",
      account: "aa9e440b-9042-4db8-bd6f-5a87014191d4",
      paymentType: "HDFC Bank",
      description: "Poha",
      date: "2026-07-20",
      time: "09:53"
    }
  ],
  fixedExpenses: [
    {
      id: "0e4559ec-205a-4fd6-9f5c-b62cae5050e3",
      name: "Rent",
      amount: 14500,
      repeat: "Monthly",
      dueDate: 4,
      category: "Rent",
      autoGenerate: true,
      lastGeneratedMonth: "2026-07"
    },
    {
      id: "11d43339-9b87-40f0-8f43-a0db47424bbf",
      name: "Salary",
      amount: 56832,
      repeat: "Monthly",
      dueDate: 3,
      category: "Income",
      autoGenerate: true,
      lastGeneratedMonth: "2026-07"
    }
  ],
  accounts: [
    {
      id: "3ae1dd2c-3b66-4dc7-9d5c-c1ae2e48f70e",
      name: "Cash",
      openingBalance: 800,
      balance: 800,
      icon: "wallet"
    },
    {
      id: "5eb85bca-77c4-475e-9dc6-6998dd01f534",
      name: "Axis Bank",
      openingBalance: 7871,
      balance: 7871,
      icon: "bank"
    },
    {
      id: "aa9e440b-9042-4db8-bd6f-5a87014191d4",
      name: "HDFC Bank",
      openingBalance: 8813,
      balance: 8757,
      icon: "briefcase"
    }
  ],
  outstanding: [
    {
      id: "612863da-2dfa-43bf-8657-7bdbe397fbd8",
      name: "Bablu Kumar",
      type: "Friend",
      outstandingAmount: 2000,
      interest: 0,
      dueDate: "2026-08-03",
      minimumDue: 0,
      status: "active",
      paymentHistory: [],
      direction: "lent"
    },
    {
      id: "9f4e762b-7c0d-491e-9869-47f71bfc6a83",
      name: "Rahul Yadav",
      type: "Friend",
      outstandingAmount: 580,
      interest: 0,
      dueDate: "2026-08-03",
      minimumDue: 0,
      status: "active",
      paymentHistory: [],
      direction: "lent"
    },
    {
      id: "d97da7fa-0139-4085-89a9-8ccb5582f615",
      name: "Reimbursement",
      type: "Loan",
      outstandingAmount: 762,
      interest: 0,
      dueDate: "2026-07-23",
      minimumDue: 0,
      status: "active",
      paymentHistory: [],
      direction: "lent"
    },
    {
      id: "o1",
      name: "Axis Bank Flipkart",
      type: "Credit Card",
      outstandingAmount: 13314,
      interest: 0,
      dueDate: "2026-08-05",
      minimumDue: 0,
      status: "active",
      paymentHistory: [
        { date: "2026-06-05", amount: 12000 },
        { date: "2026-07-05", amount: 15400 }
      ],
      cardLimit: 120000,
      direction: "borrowed"
    },
    {
      id: "o2",
      name: "Slice",
      type: "Credit Card",
      outstandingAmount: 24543,
      interest: 0,
      dueDate: "2026-08-05",
      minimumDue: 0,
      status: "active",
      paymentHistory: [
        { date: "2026-06-01", amount: 11450 },
        { date: "2026-07-01", amount: 11450 }
      ],
      cardLimit: 110000,
      direction: "borrowed"
    }
  ],
  habits: [
    { id: "3b5f7b68-8cfe-408a-8601-5b48ce97d780", name: "Under Budget", isDefault: false, active: true, createdAt: "2026-07-19", icon: "budget", order: 4 },
    { id: "66983891-142b-4895-b589-ba12530a857c", name: "No Alcohol", isDefault: false, active: true, createdAt: "2026-07-19", icon: "ban", order: 6 },
    { id: "7b52b14b-1302-4dcc-8fd5-4eaef0d9d28a", name: "Breakfast", isDefault: false, active: true, createdAt: "2026-07-19", icon: "alcohol", order: 1 },
    { id: "81504e06-25c9-4fb8-a5d0-3d3934fca8bc", name: "No Sugar", isDefault: false, active: true, createdAt: "2026-07-19", icon: "sugar", order: 9 },
    { id: "a7d0f70b-3aea-4593-9d6a-fd59db92466f", name: "Lunch", isDefault: false, active: true, createdAt: "2026-07-19", icon: "lunch", order: 2 },
    { id: "b7a20654-3105-4e65-8dc6-a94186494370", name: "Good Sleep", isDefault: false, active: true, createdAt: "2026-07-19", icon: "sleep", order: 0 },
    { id: "be050081-5529-4eca-81eb-09d78cf4753f", name: "Enough Water", isDefault: false, active: true, createdAt: "2026-07-19", icon: "water-glass", order: 8 },
    { id: "dc40f695-7944-4c5c-b737-80e027884c98", name: "No Cigarette", isDefault: false, active: true, createdAt: "2026-07-19", icon: "cigarette", order: 5 },
    { id: "f8c3ef76-0277-4409-83fa-bf18f0014cc5", name: "No Rapido", isDefault: false, active: true, createdAt: "2026-07-19", icon: "taxi", order: 7 },
    { id: "ff0ca852-4981-4203-b244-59b1640f8a38", name: "Dinner", isDefault: false, active: true, createdAt: "2026-07-19", icon: "dinner", order: 3 }
  ],
  habitLogs: [
    { date: "2026-07-19", habitId: "3b5f7b68-8cfe-408a-8601-5b48ce97d780", completed: false, id: 151 },
    { date: "2026-07-19", habitId: "a7d0f70b-3aea-4593-9d6a-fd59db92466f", completed: false, id: 152 },
    { date: "2026-07-19", habitId: "66983891-142b-4895-b589-ba12530a857c", completed: false, id: 153 },
    { date: "2026-07-19", habitId: "7b52b14b-1302-4dcc-8fd5-4eaef0d9d28a", completed: false, id: 154 },
    { date: "2026-07-19", habitId: "81504e06-25c9-4fb8-a5d0-3d3934fca8bc", completed: false, id: 155 },
    { date: "2026-07-20", habitId: "7b52b14b-1302-4dcc-8fd5-4eaef0d9d28a", completed: true, id: 156 },
    { date: "2026-07-20", habitId: "b7a20654-3105-4e65-8dc6-a94186494370", completed: true, id: 157 },
    { date: "2026-07-20", habitId: "66983891-142b-4895-b589-ba12530a857c", completed: true, id: 158 }
  ],
  settings: [
    { key: "categories", value: ["Food", "Groceries", "Travel", "Bills", "Shopping", "Entertainment", "Medical", "Subscription", "Rent", "Utilities", "Other"] },
    { key: "currency", value: "₹" },
    { key: "dailyBudget", value: 450 },
    { key: "theme", value: "light" }
  ],
  scheduledTransactions: []
};

// Seed Helper
export async function seedDatabase() {
  // 1. Try loading existing data from file directory (data/db.json)
  try {
    const res = await fetch('/api/storage');
    if (res.ok) {
      const fileData = await res.json();
      if (fileData && typeof fileData === 'object' && fileData.accounts?.length) {
        isHydratingFromFile = true;
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
            db.scheduledTransactions.clear(),
          ]);

          if (fileData.journal?.length) await db.journal.bulkPut(fileData.journal);
          if (fileData.expenses?.length) await db.expenses.bulkPut(fileData.expenses);
          if (fileData.fixedExpenses?.length) await db.fixedExpenses.bulkPut(fileData.fixedExpenses);
          if (fileData.accounts?.length) await db.accounts.bulkPut(fileData.accounts);
          if (fileData.outstanding?.length) await db.outstanding.bulkPut(fileData.outstanding);
          if (fileData.habits?.length) await db.habits.bulkPut(fileData.habits);
          if (fileData.habitLogs?.length) await db.habitLogs.bulkPut(fileData.habitLogs);
          if (fileData.settings?.length) await db.settings.bulkPut(fileData.settings);
          if (fileData.scheduledTransactions?.length) await db.scheduledTransactions.bulkPut(fileData.scheduledTransactions);
        });
        isHydratingFromFile = false;
        return;
      }
    }
  } catch (err) {
    isHydratingFromFile = false;
  }

  // 2. Fallback to embedded INITIAL_SEED_DATA
  const accountCount = await db.accounts.count();
  if (accountCount === 0) {
    try {
      await db.transaction('rw', [
        db.journal, db.expenses, db.fixedExpenses, db.accounts,
        db.outstanding, db.habits, db.habitLogs, db.settings, db.scheduledTransactions
      ], async () => {
        const data: any = INITIAL_SEED_DATA;
        if (data.journal?.length) await db.journal.bulkPut(data.journal);
        if (data.expenses?.length) await db.expenses.bulkPut(data.expenses);
        if (data.fixedExpenses?.length) await db.fixedExpenses.bulkPut(data.fixedExpenses);
        if (data.accounts?.length) await db.accounts.bulkPut(data.accounts);
        if (data.outstanding?.length) await db.outstanding.bulkPut(data.outstanding);
        if (data.habits?.length) await db.habits.bulkPut(data.habits);
        if (data.habitLogs?.length) await db.habitLogs.bulkPut(data.habitLogs);
        if (data.settings?.length) await db.settings.bulkPut(data.settings);
        if (data.scheduledTransactions?.length) await db.scheduledTransactions.bulkPut(data.scheduledTransactions);
      });
    } catch (e) {
      console.warn('Initial embedded data fallback failed:', e);
    }
  }

  const currentAccountCount = await db.accounts.count();
  if (currentAccountCount > 0) {
    // Migration: Update existing seeded habits with default icon values if missing
    const existingHabits = await db.habits.toArray();
    for (const h of existingHabits) {
      if (!h.icon) {
        if (h.id === 'wake-early') h.icon = 'sun';
        else if (h.id === 'workout') h.icon = 'dumbbell';
        else if (h.id === 'read') h.icon = 'book-open';
        else if (h.id === 'meditation') h.icon = 'brain';
        else if (h.id === 'drink-water') h.icon = 'droplet';
        else if (h.id === 'journal') h.icon = 'pen-tool';
        else if (h.id === 'no-smoking') h.icon = 'ban';
        else if (h.id === 'walk') h.icon = 'footprints';
        else if (h.id === 'learn') h.icon = 'graduation-cap';
        else if (h.id === 'sleep-early') h.icon = 'moon';
        else h.icon = 'target';
        await db.habits.put(h);
      }
    }

    // Migration: Update existing habits with default order values if missing
    for (let i = 0; i < existingHabits.length; i++) {
      if (existingHabits[i].order === undefined) {
        existingHabits[i].order = i;
        await db.habits.put(existingHabits[i]);
      }
    }

    // Migration: Update existing seeded accounts with default icon values if missing
    const existingAccounts = await db.accounts.toArray();
    for (const a of existingAccounts) {
      if (!a.icon) {
        if (a.id === 'axis') a.icon = 'bank';
        else if (a.id === 'hdfc') a.icon = 'building';
        else if (a.id === 'cash') a.icon = 'coins';
        else if (a.id === 'savings') a.icon = 'piggy';
        else if (a.id === 'wallet') a.icon = 'wallet';
        else a.icon = 'bank';
        await db.accounts.put(a);
      }
    }

    // Migration: Update outstanding credit cards with default card limit if missing
    const existingOutstanding = await db.outstanding.toArray();
    for (const o of existingOutstanding) {
      let updated = false;
      if (o.type === 'Credit Card' && o.cardLimit === undefined) {
        o.cardLimit = 100000;
        updated = true;
      }
      if (o.direction === undefined) {
        o.direction = 'borrowed';
        updated = true;
      }
      if (updated) {
        await db.outstanding.put(o);
      }
    }

    // Migration: Update journal entries with default sleepTime and cigarettes if missing
    const existingJournals = await db.journal.toArray();
    for (const j of existingJournals) {
      let updated = false;
      if ((j as any).sleepTime === undefined) {
        (j as any).sleepTime = '23:00';
        delete (j as any).weather;
        updated = true;
      }
      if ((j as any).cigarettes === undefined) {
        (j as any).cigarettes = 0;
        updated = true;
      }
      if (updated) {
        await db.journal.put(j);
      }
    }

    // Migration: Ensure categories list is stored in Settings table
    const existingCategories = await db.settings.get('categories');
    if (!existingCategories) {
      await db.settings.put({
        key: 'categories',
        value: ['Food', 'Groceries', 'Travel', 'Bills', 'Shopping', 'Entertainment', 'Medical', 'Subscription', 'Rent', 'Utilities', 'Other']
      });
    }

    return;
  }

  // 2. Seed Default Habits
  const defaultHabits: Habit[] = [
    { id: 'wake-early', name: 'Wake Early', isDefault: true, active: true, createdAt: '2026-07-01', icon: 'sun', order: 0 },
    { id: 'workout', name: 'Workout', isDefault: true, active: true, createdAt: '2026-07-01', icon: 'dumbbell', order: 1 },
    { id: 'read', name: 'Read', isDefault: true, active: true, createdAt: '2026-07-01', icon: 'book-open', order: 2 },
    { id: 'meditation', name: 'Meditation', isDefault: true, active: true, createdAt: '2026-07-01', icon: 'brain', order: 3 },
    { id: 'drink-water', name: 'Drink Water', isDefault: true, active: true, createdAt: '2026-07-01', icon: 'droplet', order: 4 },
    { id: 'journal', name: 'Journal', isDefault: true, active: true, createdAt: '2026-07-01', icon: 'pen-tool', order: 5 },
    { id: 'no-smoking', name: 'No Smoking', isDefault: true, active: true, createdAt: '2026-07-01', icon: 'ban', order: 6 },
    { id: 'walk', name: 'Walk', isDefault: true, active: true, createdAt: '2026-07-01', icon: 'footprints', order: 7 },
    { id: 'learn', name: 'Learn', isDefault: true, active: true, createdAt: '2026-07-01', icon: 'graduation-cap', order: 8 },
    { id: 'sleep-early', name: 'Sleep Before 11', isDefault: true, active: true, createdAt: '2026-07-01', icon: 'moon', order: 9 }
  ];
  await db.habits.bulkAdd(defaultHabits);

  // 3. Seed Settings
  await db.settings.put({ key: 'currency', value: '₹' });
  await db.settings.put({ key: 'theme', value: 'light' });
  await db.settings.put({ 
    key: 'categories', 
    value: ['Food', 'Groceries', 'Travel', 'Bills', 'Shopping', 'Entertainment', 'Medical', 'Subscription', 'Rent', 'Utilities', 'Income', 'Other'] 
  });

  // Write clean initial data file to data/db.json
  await saveToFileStorage();
}
