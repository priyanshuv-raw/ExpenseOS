import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type FixedExpense } from '../db/db';
import { Card } from '../components/Card';
import { runFixedExpensesEngine } from '../db/fixedExpensesEngine';
import { Plus, X, Calendar, RefreshCw, Trash2, Play, Edit2, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

export function FixedExpensesPage() {
  const fixedExpenses = useLiveQuery(() => db.fixedExpenses.toArray()) || [];
  const categoriesSetting = useLiveQuery(() => db.settings.get('categories'));
  const categories = categoriesSetting
    ? (categoriesSetting.value as string[])
    : ['Food', 'Groceries', 'Travel', 'Bills', 'Shopping', 'Entertainment', 'Medical', 'Subscription', 'Rent', 'Utilities', 'Other'];

  const recurringExpenses = fixedExpenses.filter(i => i.category !== 'Income');
  const recurringIncome  = fixedExpenses.filter(i => i.category === 'Income');

  const [showAddForm, setShowAddForm]       = useState(false);
  const [formType, setFormType]             = useState<'expense' | 'income'>('expense');
  const [name, setName]                     = useState('');
  const [amount, setAmount]                 = useState('');
  const [repeat, setRepeat]                 = useState<'Monthly' | 'Yearly'>('Monthly');
  const [dueDate, setDueDate]               = useState('');
  const [category, setCategory]             = useState('Rent');
  const [autoGenerate, setAutoGenerate]     = useState(true);
  const [isProcessing, setIsProcessing]     = useState(false);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const openAddForm = (type: 'expense' | 'income') => {
    setEditingFixedId(null);
    setFormType(type);
    setName(''); setAmount(''); setDueDate('');
    setCategory(type === 'income' ? 'Income' : 'Rent');
    setRepeat('Monthly'); setAutoGenerate(true);
    setShowAddForm(true);
  };

  const handleCloseModal = () => {
    setEditingFixedId(null);
    setName(''); setAmount(''); setDueDate('');
    setCategory('Rent'); setAutoGenerate(true);
    setShowAddForm(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !dueDate) return;
    const parsedDue = Math.max(1, Math.min(31, Number(dueDate)));
    await db.fixedExpenses.add({
      id: crypto.randomUUID(), name,
      amount: Number(amount), repeat, dueDate: parsedDue,
      category: formType === 'income' ? 'Income' : category,
      autoGenerate, lastGeneratedMonth: format(new Date(), 'yyyy-MM'),
    });
    handleCloseModal();
  };

  const handleStartEdit = (item: FixedExpense) => {
    setEditingFixedId(item.id);
    setFormType(item.category === 'Income' ? 'income' : 'expense');
    setName(item.name); setAmount(item.amount.toString());
    setDueDate(item.dueDate.toString()); setCategory(item.category);
    setRepeat(item.repeat); setAutoGenerate(item.autoGenerate);
    setShowAddForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFixedId || !name || !amount || !dueDate) return;
    const existing = await db.fixedExpenses.get(editingFixedId);
    if (!existing) return;
    await db.fixedExpenses.put({
      ...existing, name, amount: Number(amount), repeat,
      dueDate: Math.max(1, Math.min(31, Number(dueDate))),
      category: formType === 'income' ? 'Income' : category,
      autoGenerate,
    });
    handleCloseModal();
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 3000);
      return;
    }
    await db.fixedExpenses.delete(id);
    setDeleteConfirmId(null);
  };

  const triggerEngineManual = async () => {
    setIsProcessing(true);
    try { await runFixedExpensesEngine(); alert('Fixed expenses check completed!'); }
    catch (err) { console.error(err); alert('Error running engine.'); }
    finally { setIsProcessing(false); }
  };

  const getNextDueDate = (item: FixedExpense): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (item.repeat === 'Monthly') {
      // Try this month first
      const candidate = new Date(today.getFullYear(), today.getMonth(), item.dueDate);
      if (candidate >= today) return format(candidate, 'd MMM yyyy');
      // Otherwise next month
      const next = new Date(today.getFullYear(), today.getMonth() + 1, item.dueDate);
      return format(next, 'd MMM yyyy');
    }

    if (item.repeat === 'Yearly' && item.lastGeneratedMonth) {
      const [, monthStr] = item.lastGeneratedMonth.split('-');
      const month = parseInt(monthStr, 10) - 1; // 0-indexed
      const candidate = new Date(today.getFullYear(), month, item.dueDate);
      if (candidate >= today) return format(candidate, 'd MMM yyyy');
      // Next year
      const next = new Date(today.getFullYear() + 1, month, item.dueDate);
      return format(next, 'd MMM yyyy');
    }

    return `Day ${item.dueDate}`;
  };

  const ItemCard = ({ item }: { item: FixedExpense }) => {
    const isIncome = item.category === 'Income';
    const nextDate = getNextDueDate(item);
    return (
      <Card className={`relative flex flex-col justify-between min-h-[145px] transition-all ${
        isIncome ? 'border-emerald-300/50 dark:border-emerald-700/40 ring-1 ring-emerald-400/10' : ''
      }`}>
        <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
          <button onClick={() => handleStartEdit(item)} className="p-1 text-neutral-400 hover:text-apple-blue transition-colors cursor-pointer" title="Edit">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {deleteConfirmId === item.id ? (
            <button onClick={() => handleDelete(item.id)} className="bg-apple-red text-white px-2 py-0.5 rounded text-[9px] font-bold animate-pulse-slow cursor-pointer">Delete?</button>
          ) : (
            <button onClick={() => handleDelete(item.id)} className="p-1 text-neutral-400 hover:text-apple-red transition-colors cursor-pointer" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div>
          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.75 rounded-md ${
            isIncome ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                     : 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400'
          }`}>{item.category}</span>
          <h3 className="text-md font-bold text-neutral-800 dark:text-white mt-2.5">{item.name}</h3>
          <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span className="font-semibold text-neutral-600 dark:text-neutral-300">{nextDate}</span>
            <span className="text-neutral-300 dark:text-neutral-600">·</span>
            {item.repeat}
          </p>
        </div>
        <div className="flex justify-between items-end border-t border-neutral-100 dark:border-neutral-900 pt-3 mt-4">
          <div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-semibold block">Auto-generates</span>
            <span className="text-[11px] text-neutral-800 dark:text-neutral-200 font-bold">{item.autoGenerate ? '✓ Active' : '✕ Inactive'}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-semibold block">Amount</span>
            <span className={`text-md font-extrabold ${
              isIncome ? 'text-emerald-500' : 'text-apple-red'
            }`}>
              {isIncome ? '+' : '-'}₹{item.amount.toLocaleString()}
            </span>
          </div>
        </div>
      </Card>
    );
  };


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-neutral-100 dark:border-neutral-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Fixed Recurring</h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Manage recurring bills, subscriptions, and income like salary.</p>
        </div>
        <button onClick={triggerEngineManual} disabled={isProcessing}
          className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all">
          <Play className="w-3.5 h-3.5" />{isProcessing ? 'Processing...' : 'Run Engine'}
        </button>
      </div>

      {/* ── Recurring Expenses ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-apple-red" />
            <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">Recurring Expenses</h2>
            <span className="text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-full">{recurringExpenses.length}</span>
          </div>
          <button onClick={() => openAddForm('expense')}
            className="flex items-center gap-1.5 bg-black text-white dark:bg-white dark:text-black hover:scale-[1.01] active:scale-[0.99] px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition-transform">
            <Plus className="w-3.5 h-3.5" /> Add Expense
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recurringExpenses.map(item => <ItemCard key={item.id} item={item} />)}
          {recurringExpenses.length === 0 && (
            <div className="col-span-full border-2 border-dashed border-neutral-200 dark:border-neutral-850 rounded-2xl p-8 text-center flex flex-col items-center gap-2">
              <RefreshCw className="w-7 h-7 text-neutral-300" />
              <p className="text-sm font-semibold text-neutral-500">No recurring expenses</p>
              <p className="text-xs text-neutral-400">Add rent, subscriptions, utilities, etc.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Recurring Income ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">Recurring Income</h2>
            <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">{recurringIncome.length}</span>
          </div>
          <button onClick={() => openAddForm('income')}
            className="flex items-center gap-1.5 bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-[1.01] active:scale-[0.99] px-3.5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all">
            <Plus className="w-3.5 h-3.5" /> Add Income
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recurringIncome.map(item => <ItemCard key={item.id} item={item} />)}
          {recurringIncome.length === 0 && (
            <div className="col-span-full border-2 border-dashed border-emerald-200 dark:border-emerald-900/30 rounded-2xl p-8 text-center flex flex-col items-center gap-2">
              <TrendingUp className="w-7 h-7 text-emerald-300" />
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">No recurring income</p>
              <p className="text-xs text-neutral-400">Add salary, freelance income, rent received, etc.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={handleCloseModal} className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">
              {editingFixedId ? 'Edit Recurring' : 'Add Recurring'}
            </h2>

            {/* Type toggle — only on new entry */}
            {!editingFixedId && (
              <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 mb-5">
                <button type="button" onClick={() => { setFormType('expense'); setCategory('Rent'); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    formType === 'expense' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400'
                  }`}>
                  <TrendingDown className="w-3.5 h-3.5 text-apple-red" /> Expense
                </button>
                <button type="button" onClick={() => { setFormType('income'); setCategory('Income'); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    formType === 'income' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400'
                  }`}>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Income
                </button>
              </div>
            )}

            <form onSubmit={editingFixedId ? handleUpdate : handleAdd} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                  {formType === 'income' ? 'Income Name' : 'Expense Name'}
                </label>
                <input type="text"
                  placeholder={formType === 'income' ? 'e.g. Salary, Freelance, Rent Received' : 'e.g. Rent, Netflix, ACT Internet'}
                  value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                  required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Amount (₹)</label>
                  <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                    required />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Due Day (1–31)</label>
                  <input type="number" min="1" max="31" placeholder="Day of month" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                    required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {formType === 'expense' && (
                  <div>
                    <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-white dark:bg-neutral-950 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue text-neutral-900 dark:text-white">
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                )}
                <div className={formType === 'income' ? 'col-span-2' : ''}>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Repeat</label>
                  <select value={repeat} onChange={(e) => setRepeat(e.target.value as 'Monthly' | 'Yearly')}
                    className="w-full bg-white dark:bg-neutral-950 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue text-neutral-900 dark:text-white">
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2.5 mt-1 bg-white dark:bg-neutral-950 p-3 rounded-xl border border-neutral-300 dark:border-neutral-700">
                <input type="checkbox" id="auto-generate" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)}
                  className="accent-apple-blue w-4 h-4 cursor-pointer" />
                <label htmlFor="auto-generate" className="text-xs text-neutral-700 dark:text-neutral-300 font-bold cursor-pointer">
                  Auto-generate transactions each cycle
                </label>
              </div>

              <button type="submit" className={`w-full text-white py-3 rounded-xl text-sm font-bold mt-1 shadow-md transition-colors ${
                formType === 'income' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                                      : 'bg-apple-blue hover:bg-apple-blue/90 shadow-apple-blue/15'
              }`}>
                {editingFixedId ? 'Update' : formType === 'income' ? 'Add Income' : 'Add Expense'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
