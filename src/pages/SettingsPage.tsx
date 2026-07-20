import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { Card } from '../components/Card';
import { useLiveQuery } from 'dexie-react-hooks';
import { getFirebaseConfig } from '../config/firebase';
import { Download, Upload, FileSpreadsheet, RefreshCw, Moon, Sun, X, Plus, Cloud } from 'lucide-react';
import { format } from 'date-fns';

interface SettingsPageProps {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}

export function SettingsPage({ theme, setTheme }: SettingsPageProps) {
  // Queries
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const habits = useLiveQuery(() => db.habits.toArray()) || [];
  
  // Dynamic categories loader
  const categoriesSetting = useLiveQuery(() => db.settings.get('categories'));
  const categories = categoriesSetting ? (categoriesSetting.value as string[]) : [];

  // Local settings states
  const [currency, setCurrency] = useState('₹');
  const [dailyBudget, setDailyBudget] = useState('1500');
  const [recoverySaved, setRecoverySaved] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Firebase Config State
  const initialFbConfig = getFirebaseConfig();
  const [fbApiKey, setFbApiKey] = useState(initialFbConfig.apiKey || '');
  const [fbAuthDomain, setFbAuthDomain] = useState(initialFbConfig.authDomain || '');
  const [fbProjectId, setFbProjectId] = useState(initialFbConfig.projectId || '');
  const [fbStorageBucket, setFbStorageBucket] = useState(initialFbConfig.storageBucket || '');
  const [fbAppId, setFbAppId] = useState(initialFbConfig.appId || '');
  const [fbSaved, setFbSaved] = useState(false);

  const handleSaveFirebase = () => {
    const config = {
      apiKey: fbApiKey.trim(),
      authDomain: fbAuthDomain.trim(),
      projectId: fbProjectId.trim(),
      storageBucket: fbStorageBucket.trim(),
      messagingSenderId: '',
      appId: fbAppId.trim(),
    };
    localStorage.setItem('lifeos_firebase_config', JSON.stringify(config));
    setFbSaved(true);
    setTimeout(() => {
      setFbSaved(false);
      window.location.reload();
    }, 1200);
  };

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      const dbCurrency = await db.settings.get('currency');
      if (dbCurrency) setCurrency(dbCurrency.value);

      const dbBudget = await db.settings.get('dailyBudget');
      if (dbBudget) setDailyBudget(dbBudget.value.toString());
    };
    loadSettings();
  }, []);

  const saveSettings = async (key: string, value: any) => {
    await db.settings.put({ key, value });
  };

  const handleCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCurrency(val);
    await saveSettings('currency', val);
  };

  const handleBudgetChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDailyBudget(val);
    await saveSettings('dailyBudget', Number(val) || 1500);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;

    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) {
      alert('Category already exists.');
      return;
    }

    const newCats = [...categories, name];
    await saveSettings('categories', newCats);
    setNewCategoryName('');
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    if (categories.length <= 1) {
      alert('You must have at least one category.');
      return;
    }

    if (confirm(`Are you sure you want to delete the category "${catToDelete}"? past transactions with this category will remain, but you won't be able to select it for new entries.`)) {
      const newCats = categories.filter(c => c !== catToDelete);
      await saveSettings('categories', newCats);
    }
  };

  // JSON Export
  const handleExportJSON = async () => {
    const data = {
      journal: await db.journal.toArray(),
      expenses: await db.expenses.toArray(),
      fixedExpenses: await db.fixedExpenses.toArray(),
      accounts: await db.accounts.toArray(),
      outstanding: await db.outstanding.toArray(),
      habits: await db.habits.toArray(),
      habitLogs: await db.habitLogs.toArray(),
      settings: await db.settings.toArray()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV Export (Expenses)
  const handleExportCSV = async () => {
    const list = await db.expenses.toArray();
    const accountList = await db.accounts.toArray();
    
    let csvContent = 'ID,Date,Time,Description,Category,Account,Payment Type,Amount\n';
    
    list.forEach(tx => {
      const accName = accountList.find(a => a.id === tx.account)?.name || tx.account;
      const descClean = tx.description.replace(/"/g, '""');
      csvContent += `"${tx.id}","${tx.date}","${tx.time}","${descClean}","${tx.category}","${accName}","${tx.paymentType}",${tx.amount}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Save Recovery Mirror Backup
  const handleRecoveryBackup = async () => {
    try {
      const allExpenses = await db.expenses.toArray();
      const allJournal = await db.journal.toArray();
      const allAccounts = await db.accounts.toArray();
      const allOutstanding = await db.outstanding.toArray();
      const allFixed = await db.fixedExpenses.toArray();
      const allHabits = await db.habits.toArray();
      const allHabitLogs = await db.habitLogs.toArray();
      const allSettings = await db.settings.toArray();

      localStorage.setItem('lifeos_mirror_expenses', JSON.stringify(allExpenses));
      localStorage.setItem('lifeos_mirror_journal', JSON.stringify(allJournal));
      localStorage.setItem('lifeos_mirror_accounts', JSON.stringify(allAccounts));
      localStorage.setItem('lifeos_mirror_outstanding', JSON.stringify(allOutstanding));
      localStorage.setItem('lifeos_mirror_fixed', JSON.stringify(allFixed));
      localStorage.setItem('lifeos_mirror_habits', JSON.stringify(allHabits));
      localStorage.setItem('lifeos_mirror_habit_logs', JSON.stringify(allHabitLogs));
      localStorage.setItem('lifeos_mirror_settings', JSON.stringify(allSettings));

      setRecoverySaved(true);
      setTimeout(() => setRecoverySaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save recovery backup.');
    }
  };

  // JSON Import
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        if (confirm('Importing will completely replace your current database records. Proceed?')) {
          await db.transaction('rw', [
            db.journal, db.expenses, db.fixedExpenses, db.accounts, 
            db.outstanding, db.habits, db.habitLogs, db.settings
          ], async () => {
            // Wipes tables
            await db.journal.clear();
            await db.expenses.clear();
            await db.fixedExpenses.clear();
            await db.accounts.clear();
            await db.outstanding.clear();
            await db.habits.clear();
            await db.habitLogs.clear();
            await db.settings.clear();

            // Inserts backups
            if (data.journal) await db.journal.bulkAdd(data.journal);
            if (data.expenses) await db.expenses.bulkAdd(data.expenses);
            if (data.fixedExpenses) await db.fixedExpenses.bulkAdd(data.fixedExpenses);
            if (data.accounts) await db.accounts.bulkAdd(data.accounts);
            if (data.outstanding) await db.outstanding.bulkAdd(data.outstanding);
            if (data.habits) await db.habits.bulkAdd(data.habits);
            if (data.habitLogs) await db.habitLogs.bulkAdd(data.habitLogs);
            if (data.settings) await db.settings.bulkAdd(data.settings);
          });
          
          alert('Database recovered and loaded successfully!');
          window.location.reload();
        }
      } catch (err) {
        console.error(err);
        alert('Invalid JSON file format. Make sure it is a valid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // Reset database completely
  const handleResetDatabase = async () => {
    if (confirm('CAUTION: This will delete ALL journal entries, expense transactions, habits, settings, and net worth records. Your Life OS will be wiped clean. Are you absolutely sure?')) {
      await db.transaction('rw', [
        db.journal, db.expenses, db.fixedExpenses, db.accounts, 
        db.outstanding, db.habits, db.habitLogs, db.settings
      ], async () => {
        await db.journal.clear();
        await db.expenses.clear();
        await db.fixedExpenses.clear();
        await db.accounts.clear();
        await db.outstanding.clear();
        await db.habits.clear();
        await db.habitLogs.clear();
        await db.settings.clear();
      });
      alert('Life OS database reset successfully.');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-3xl pb-10">
      <div className="border-b border-neutral-100 dark:border-neutral-900 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Settings</h1>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
          Customize currency symbols, daily thresholds, backup archives, and reset system configurations.
        </p>
      </div>

      {/* Preferences Card */}
      <Card className="p-6">
        <h2 className="text-sm font-extrabold text-neutral-900 dark:text-white mb-5 uppercase tracking-wide">Workspace Preferences</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Currency */}
          <div>
            <label className="font-semibold text-neutral-450 dark:text-neutral-400 block mb-2">Currency Symbol</label>
            <select
              value={currency}
              onChange={handleCurrencyChange}
              className="w-full bg-white dark:bg-neutral-950 px-3.5 py-2.5 rounded-xl border border-neutral-350 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-apple-blue"
            >
              <option value="₹">₹ (INR Rupee)</option>
              <option value="$">$ (USD Dollar)</option>
              <option value="€">€ (Euro)</option>
              <option value="£">£ (Pound Sterling)</option>
              <option value="¥">¥ (Yen / Yuan)</option>
            </select>
          </div>

          {/* Budget */}
          <div>
            <label className="font-semibold text-neutral-450 dark:text-neutral-400 block mb-2">Default Daily Allowance Limit</label>
            <input
              type="number"
              value={dailyBudget}
              onChange={handleBudgetChange}
              className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-350 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-apple-blue"
              placeholder="e.g. 1500"
            />
          </div>
        </div>

        {/* Theme select */}
        <div className="border-t border-neutral-150 dark:border-neutral-800 pt-5 mt-5">
          <label className="font-semibold text-xs text-neutral-450 dark:text-neutral-400 block mb-3">Theme Selection</label>
          <div className="flex gap-2.5 text-xs">
            <button
              onClick={() => { setTheme('light'); document.documentElement.classList.remove('dark'); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold ${
                theme === 'light' 
                  ? 'bg-neutral-950 text-white dark:bg-white dark:text-black border-transparent shadow-sm'
                  : 'bg-white hover:bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-850 text-neutral-500'
              }`}
            >
              <Sun className="w-3.5 h-3.5" /> Light Mode
            </button>
            <button
              onClick={() => { setTheme('dark'); document.documentElement.classList.add('dark'); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold ${
                theme === 'dark' 
                  ? 'bg-neutral-950 text-white dark:bg-white dark:text-black border-transparent shadow-sm'
                  : 'bg-white hover:bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-850 text-neutral-500'
              }`}
            >
              <Moon className="w-3.5 h-3.5" /> Dark Mode
            </button>
          </div>
        </div>
      </Card>

      {/* Firebase Cloud Sync Configuration */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-extrabold text-neutral-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <Cloud className="w-4 h-4 text-apple-blue" />
            Firebase Project Credentials
          </h2>
          {fbSaved && (
            <span className="text-xs font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg">
              Saved! Reloading...
            </span>
          )}
        </div>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-5">
          Paste your Firebase project credentials from Firebase Console (<a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-apple-blue underline">console.firebase.google.com</a>) to link your personal cloud database.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-5">
          <div>
            <label className="font-semibold text-neutral-500 dark:text-neutral-400 block mb-1.5">API Key (apiKey)</label>
            <input
              type="text"
              value={fbApiKey}
              onChange={(e) => setFbApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-white dark:bg-neutral-950 px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:text-white font-mono text-[11px] focus:outline-none focus:border-apple-blue"
            />
          </div>
          <div>
            <label className="font-semibold text-neutral-500 dark:text-neutral-400 block mb-1.5">Project ID (projectId)</label>
            <input
              type="text"
              value={fbProjectId}
              onChange={(e) => setFbProjectId(e.target.value)}
              placeholder="my-lifeos-app"
              className="w-full bg-white dark:bg-neutral-950 px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:text-white font-mono text-[11px] focus:outline-none focus:border-apple-blue"
            />
          </div>
          <div>
            <label className="font-semibold text-neutral-500 dark:text-neutral-400 block mb-1.5">Auth Domain (authDomain)</label>
            <input
              type="text"
              value={fbAuthDomain}
              onChange={(e) => setFbAuthDomain(e.target.value)}
              placeholder="my-lifeos-app.firebaseapp.com"
              className="w-full bg-white dark:bg-neutral-950 px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:text-white font-mono text-[11px] focus:outline-none focus:border-apple-blue"
            />
          </div>
          <div>
            <label className="font-semibold text-neutral-500 dark:text-neutral-400 block mb-1.5">App ID (appId)</label>
            <input
              type="text"
              value={fbAppId}
              onChange={(e) => setFbAppId(e.target.value)}
              placeholder="1:123456789:web:abcdef..."
              className="w-full bg-white dark:bg-neutral-950 px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:text-white font-mono text-[11px] focus:outline-none focus:border-apple-blue"
            />
          </div>
        </div>

        <button
          onClick={handleSaveFirebase}
          className="bg-apple-blue hover:bg-blue-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          Save & Link Firebase Credentials
        </button>
      </Card>

      {/* Category Customization Card */}
      <Card className="p-6">
        <h2 className="text-sm font-extrabold text-neutral-900 dark:text-white mb-2 uppercase tracking-wide">Category Customization</h2>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-5">
          Add or remove custom transaction categories. Wiped categories will persist in historical entries but will be removed from form picks.
        </p>

        <form onSubmit={handleAddCategory} className="flex gap-2 mb-5">
          <input
            type="text"
            placeholder="Add new category e.g. Shopping, Subscriptions..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
            required
          />
          <button
            type="submit"
            className="bg-apple-blue text-white hover:scale-105 active:scale-95 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-apple-blue/15"
          >
            Add
          </button>
        </form>

        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
          {categories.map(cat => (
            <div 
              key={cat} 
              className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-300 shadow-sm"
            >
              <span>{cat}</span>
              <button
                type="button"
                onClick={() => handleDeleteCategory(cat)}
                className="text-neutral-400 hover:text-apple-red transition-colors"
                title={`Delete ${cat}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <span className="text-xs text-neutral-450 italic py-2">No custom categories.</span>
          )}
        </div>
      </Card>

      {/* Backup & Recovery Utilities Card */}
      <Card className="p-6">
        <h2 className="text-sm font-extrabold text-neutral-900 dark:text-white mb-4 uppercase tracking-wide">Data Export & Backup Archive</h2>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-5">
          Your data is strictly yours forever. Export full local archives, backup to browser cache partitions, or upload a recovery JSON.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
          {/* Export JSON */}
          <button
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-2 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 hover:bg-neutral-50 dark:hover:bg-neutral-850 py-3 rounded-xl shadow-sm text-neutral-700 dark:text-neutral-300"
          >
            <Download className="w-4 h-4" /> Export DB Archive (JSON)
          </button>

          {/* Export Expenses CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 hover:bg-neutral-50 dark:hover:bg-neutral-850 py-3 rounded-xl shadow-sm text-neutral-700 dark:text-neutral-300"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Expenses (CSV)
          </button>

          {/* Local recovery backup */}
          <button
            onClick={handleRecoveryBackup}
            className="flex items-center justify-center gap-2 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 hover:bg-neutral-50 dark:hover:bg-neutral-850 py-3 rounded-xl shadow-sm text-neutral-700 dark:text-neutral-300"
          >
            <RefreshCw className="w-4 h-4" />
            {recoverySaved ? '✓ Backup Mirror Saved' : 'Save Recovery Mirror'}
          </button>

          {/* Import JSON */}
          <div className="relative border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 hover:bg-neutral-50 dark:hover:bg-neutral-850 rounded-xl overflow-hidden shadow-sm flex items-center justify-center py-3 cursor-pointer text-neutral-700 dark:text-neutral-300">
            <Upload className="w-4 h-4 mr-2" />
            <span>Import Recovery DB (JSON)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border border-red-200/50 dark:border-red-950/40 bg-red-50/10 dark:bg-red-950/5">
        <h2 className="text-sm font-extrabold text-red-650 dark:text-red-400 mb-2 uppercase tracking-wide">Danger Zone</h2>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-4">
          Irreversible destructive actions. Make sure you have exported backups before performing any clear operations.
        </p>

        <button
          onClick={handleResetDatabase}
          className="flex items-center justify-center gap-2 border border-red-200 dark:border-red-950 bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20 py-3 rounded-xl shadow-sm text-red-600 dark:text-red-450 w-full sm:w-auto px-6 font-bold text-xs"
        >
          Reset Database & Clear All Data
        </button>
      </Card>
    </div>
  );
}
