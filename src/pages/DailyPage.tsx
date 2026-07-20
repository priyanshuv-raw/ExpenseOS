import React, { useState, useEffect } from 'react';
import { db, type JournalEntry, type Expense, type Habit, type HabitLog } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { HabitIconHelper } from '../utils/icons';
import { 
  X, 
  Sun, 
  Bold, 
  Italic, 
  Heading1, 
  List, 
  CheckSquare, 
  BookOpen, 
  Eye, 
  Edit3,
  Receipt,
  Trash2,
  Moon,
  Brain,
  Clock,
  Zap,
  Cigarette,
  Minus,
  Plus,
  Check,
  CheckSquare2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DailyPageProps {
  dateStr: string;
  onClose: () => void;
}

export function DailyPage({ dateStr, onClose }: DailyPageProps) {
  // Parsing date
  const parsedDate = parseISO(dateStr);
  const formattedDate = format(parsedDate, 'EEEE, d MMMM yyyy');

  // React state for logs
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<JournalEntry['mood']>('');
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(2);
  const [sleepHours, setSleepHours] = useState(7);
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('23:00');
  const [cigarettes, setCigarettes] = useState(0);
  const [isPreview, setIsPreview] = useState(false);
  const [clearLogConfirm, setClearLogConfirm] = useState(false);

  // Form states for adding expense directly inside the day
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState<Expense['category']>('Food');
  const [expAccountId, setExpAccountId] = useState('hdfc');
  const [expDescription, setExpDescription] = useState('');

  // Inline expense edit states
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAccountId, setEditAccountId] = useState('');

  // Live queries for this specific day
  const journalEntry = useLiveQuery(() => db.journal.get(dateStr), [dateStr]);
  const dayExpenses = useLiveQuery(() => 
    db.expenses.filter(e => e.date === dateStr).toArray(), [dateStr]
  ) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const allOutstanding = useLiveQuery(() => db.outstanding.filter(o => o.status === 'active').toArray()) || [];
  const allFixedExpenses = useLiveQuery(() => db.fixedExpenses.toArray()) || [];
  const categoriesSetting = useLiveQuery(() => db.settings.get('categories'));
  const categories = categoriesSetting ? (categoriesSetting.value as string[]) : ['Food', 'Groceries', 'Travel', 'Bills', 'Shopping', 'Entertainment', 'Medical', 'Subscription', 'Rent', 'Utilities', 'Other'];

  // Habit tracking live queries
  const activeHabits = useLiveQuery(() => db.habits.filter(h => h.active === true).toArray()) || [];
  const habitLogs = useLiveQuery(() => db.habitLogs.where('date').equals(dateStr).toArray(), [dateStr]) || [];

  // Load existing log
  useEffect(() => {
    if (journalEntry) {
      setContent(journalEntry.content || '');
      setMood(journalEntry.mood || '');
      setEnergy(journalEntry.energy || 3);
      setStress(journalEntry.stress || 2);
      setSleepHours(journalEntry.sleepHours || 7);
      setWakeTime(journalEntry.wakeTime || '07:00');
      setSleepTime(journalEntry.sleepTime || '23:00');
      setCigarettes(journalEntry.cigarettes || 0);
    } else {
      // Clear for new day
      setContent('');
      setMood('');
      setEnergy(3);
      setStress(2);
      setSleepHours(7);
      setWakeTime('07:00');
      setSleepTime('23:00');
      setCigarettes(0);
    }
  }, [journalEntry, dateStr]);

  // Auto-save debouncer
  useEffect(() => {
    const saveTimeout = setTimeout(async () => {
      // Don't auto-create empty entries
      if (!content && !mood && !sleepTime && !cigarettes) return;

      const entry: JournalEntry = {
        date: dateStr,
        content,
        mood,
        energy,
        stress,
        sleepHours,
        wakeTime,
        sleepTime,
        cigarettes
      };
      await db.journal.put(entry);
    }, 800); // 800ms debounce

    return () => clearTimeout(saveTimeout);
  }, [content, mood, energy, stress, sleepHours, wakeTime, sleepTime, cigarettes, dateStr]);

  // Markdown Toolbar Helpers
  const insertMarkdown = (syntax: string) => {
    const textarea = document.getElementById('journal-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const selected = text.substring(start, end);

    let replacement = '';
    if (syntax === 'bold') replacement = `**${selected || 'bold text'}**`;
    else if (syntax === 'italic') replacement = `*${selected || 'italic text'}*`;
    else if (syntax === 'heading') replacement = `\n# ${selected || 'Heading'}\n`;
    else if (syntax === 'list') replacement = `\n- ${selected || 'list item'}\n`;
    else if (syntax === 'checkbox') replacement = `\n- [ ] ${selected || 'task'}\n`;

    setContent(before + replacement + after);
    
    // Focus back
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 50);
  };

  // Simple Markdown Parser for Rich Text display
  const renderMarkdown = (text: string) => {
    if (!text) return '<p class="text-neutral-400 italic">No text logged yet.</p>';
    
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings
    html = html.replace(/^# (.*?)$/gm, '<h3 class="text-lg font-bold text-neutral-900 dark:text-white mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h4 class="text-md font-bold text-neutral-800 dark:text-neutral-250 mt-3 mb-1.5">$1</h4>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Lists
    html = html.replace(/^\- \[\ \]\s(.*)$/gm, '<li class="list-none flex items-start gap-2 my-1"><input type="checkbox" disabled class="mt-1"> <span>$1</span></li>');
    html = html.replace(/^\- \[[xX]\]\s(.*)$/gm, '<li class="list-none flex items-start gap-2 my-1"><input type="checkbox" checked disabled class="mt-1"> <span class="line-through text-neutral-400">$1</span></li>');
    html = html.replace(/^\-\s(.*)$/gm, '<li class="list-disc ml-5 my-1">$1</li>');

    // Paragraphs (split by double enters)
    html = html.split('\n\n').map(p => {
      if (p.startsWith('<h') || p.startsWith('<li')) return p;
      return `<p class="mb-3 text-neutral-700 dark:text-neutral-300 leading-relaxed">${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
  };

  // Toggle habit log for this date
  const toggleHabitLog = async (habitId: string) => {
    const existing = habitLogs.find(l => l.habitId === habitId);
    if (existing) {
      await db.habitLogs.put({ ...existing, completed: !existing.completed });
    } else {
      await db.habitLogs.add({ date: dateStr, habitId, completed: true });
    }
  };

  // Direct Expense addition
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expAmount || isNaN(Number(expAmount))) return;

    const parsedAmount = Math.abs(Number(expAmount));
    const now = new Date();
    const selectedAcc = accounts.find(a => a.id === expAccountId);
    const resolvedPaymentType = selectedAcc ? selectedAcc.name : 'Cash';

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      amount: parsedAmount,
      category: expCategory,
      account: expAccountId,
      paymentType: resolvedPaymentType,
      description: expDescription || `${expCategory} Expense`,
      date: dateStr,
      time: format(now, 'HH:mm')
    };

    await db.expenses.add(newExpense);

    // Adjust balance
    const account = await db.accounts.get(expAccountId);
    if (account) {
      if (expCategory === 'Income') {
        account.balance += parsedAmount;
      } else {
        account.balance -= parsedAmount;
      }
      await db.accounts.put(account);
    }

    // Reset Form
    setExpAmount('');
    setExpDescription('');
    setShowAddExpense(false);
  };

  // Direct Expense deletion
  const handleDeleteExpense = async (exp: Expense) => {
    await db.expenses.delete(exp.id);
    const account = await db.accounts.get(exp.account);
    if (account) {
      if (exp.category === 'Income') {
        account.balance -= exp.amount;
      } else {
        account.balance += exp.amount;
      }
      await db.accounts.put(account);
    }
  };

  // Start editing an expense
  const startEditExpense = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setEditAmount(String(exp.amount));
    setEditDescription(exp.description);
    setEditCategory(exp.category);
    setEditAccountId(exp.account);
  };

  // Save edited expense
  const handleSaveEditExpense = async (exp: Expense) => {
    const newAmount = Math.abs(Number(editAmount));
    if (!newAmount || isNaN(newAmount)) return;

    // Reverse old balance effect
    const oldAccount = await db.accounts.get(exp.account);
    if (oldAccount) {
      oldAccount.balance = exp.category === 'Income'
        ? oldAccount.balance - exp.amount
        : oldAccount.balance + exp.amount;
      await db.accounts.put(oldAccount);
    }

    // Apply new balance effect
    const newAccount = await db.accounts.get(editAccountId);
    if (newAccount) {
      newAccount.balance = editCategory === 'Income'
        ? newAccount.balance + newAmount
        : newAccount.balance - newAmount;
      await db.accounts.put(newAccount);
    }

    const selectedAcc = accounts.find(a => a.id === editAccountId);
    await db.expenses.put({
      ...exp,
      amount: newAmount,
      description: editDescription || editCategory,
      category: editCategory,
      account: editAccountId,
      paymentType: selectedAcc?.name || exp.paymentType,
    });
    setEditingExpenseId(null);
  };

  // Clear entire journal entry for this day
  const handleClearLog = async () => {
    if (!clearLogConfirm) {
      setClearLogConfirm(true);
      setTimeout(() => setClearLogConfirm(false), 3000);
      return;
    }
    // Delete the journal entry from db
    await db.journal.delete(dateStr);
    // Reset all form states
    setContent('');
    setMood('');
    setEnergy(3);
    setStress(2);
    setSleepHours(7);
    setWakeTime('07:00');
    setSleepTime('23:00');
    setCigarettes(0);
    setClearLogConfirm(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-xs z-35 flex justify-end">
      {/* Tap off target */}
      <div className="flex-1" onClick={onClose} />

      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="w-full max-w-xl h-screen bg-white dark:bg-neutral-950 border-l border-neutral-100 dark:border-neutral-900 shadow-2xl p-6 overflow-y-auto z-40 flex flex-col justify-between"
      >
        <div>
          {/* Header */}
          <div className="flex justify-between items-start border-b border-neutral-100 dark:border-neutral-900 pb-4 mb-5">
            <div>
              <h2 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest leading-none mb-2.5">Daily Log Entry</h2>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white leading-tight">{formattedDate}</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Clear Log button */}
              {clearLogConfirm ? (
                <button
                  onClick={handleClearLog}
                  className="flex items-center gap-1.5 bg-apple-red text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-600 transition-all animate-pulse-slow cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Confirm Clear?
                </button>
              ) : (
                journalEntry && (
                  <button
                    onClick={handleClearLog}
                    className="p-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 text-neutral-450 dark:text-neutral-500 hover:text-apple-red hover:border-red-200 dark:hover:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                    title="Clear daily log for this day"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )
              )}
              <button 
                onClick={onClose}
                className="p-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 text-neutral-450 dark:text-neutral-500 hover:text-neutral-850 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Section: Daily Parameters grouped */}
          <div className="flex flex-col gap-6 mb-6">
            {/* Group 1: Mood, Sleep & Consumables */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-205 dark:border-neutral-850 p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-900/60 pb-2">
                <Brain className="w-4 h-4 text-pink-500 stroke-[2.5px]" />
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">Daily Check-in</span>
              </div>

              <div className="flex items-center gap-0">
                {/* Mood emojis */}
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-neutral-450 dark:text-neutral-500 uppercase block mb-2">Mood</label>
                  <div className="flex gap-1.5">
                    {(['😊', '😄', '😐', '😔', '😢'] as const).map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setMood(emoji)}
                        className={`text-xl p-2 rounded-xl transition-all cursor-pointer ${
                          mood === emoji
                            ? 'bg-apple-blue/10 border border-apple-blue scale-110'
                            : 'bg-white border border-neutral-200 hover:bg-neutral-50 dark:bg-neutral-950 dark:border-neutral-800'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vertical divider */}
                <div className="w-px self-stretch bg-neutral-100 dark:bg-neutral-800 mx-5 flex-shrink-0" />

                {/* Sleep + Cigs */}
                <div className="flex items-end gap-5 flex-shrink-0">
                  {/* Sleep Hours */}
                  <div className="flex flex-col items-center gap-1.5">
                    <label className="text-[10px] font-bold text-neutral-450 dark:text-neutral-500 uppercase flex items-center gap-1">
                      <Moon className="w-3 h-3 text-indigo-400" /> Sleep
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSleepHours(h => Math.max(0, parseFloat((h - 0.5).toFixed(1))))}
                        className="w-7 h-7 rounded-full border border-neutral-300 dark:border-neutral-700 flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 active:scale-95 transition-transform cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-extrabold text-base text-neutral-900 dark:text-white min-w-[28px] text-center">{sleepHours}</span>
                      <button
                        type="button"
                        onClick={() => setSleepHours(h => parseFloat((h + 0.5).toFixed(1)))}
                        className="w-7 h-7 rounded-full border border-neutral-300 dark:border-neutral-700 flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 active:scale-95 transition-transform cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Cigarettes stepper */}
                  <div className="flex flex-col items-center gap-1.5">
                    <label className="text-[10px] font-bold text-neutral-450 dark:text-neutral-500 uppercase flex items-center gap-1">
                      <Cigarette className="w-3 h-3 text-amber-500" /> Cigs
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCigarettes(c => Math.max(0, c - 1))}
                        className="w-7 h-7 rounded-full border border-neutral-300 dark:border-neutral-700 flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 active:scale-95 transition-transform cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-extrabold text-base text-neutral-900 dark:text-white min-w-[18px] text-center">{cigarettes}</span>
                      <button
                        type="button"
                        onClick={() => setCigarettes(c => c + 1)}
                        className="w-7 h-7 rounded-full border border-neutral-300 dark:border-neutral-700 flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 active:scale-95 transition-transform cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Group 4: Habits for this Day */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-205 dark:border-neutral-850 p-5 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-900/60 pb-2">
                <CheckSquare2 className="w-4 h-4 text-emerald-500 stroke-[2px]" />
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">Habits</span>
                <span className="ml-auto text-[10px] font-bold text-neutral-400 dark:text-neutral-500">
                  {habitLogs.filter(l => l.completed).length}/{activeHabits.length} done
                </span>
              </div>

              {activeHabits.length === 0 ? (
                <p className="text-xs text-neutral-400 italic text-center py-2">No active habits. Set them up in the Habits section.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeHabits.map(habit => {
                    const log = habitLogs.find(l => l.habitId === habit.id);
                    const isDone = !!log?.completed;
                    return (
                      <button
                        key={habit.id}
                        type="button"
                        onClick={() => toggleHabitLog(habit.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer select-none ${
                          isDone
                            ? 'bg-emerald-500 dark:bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                            : 'bg-white dark:bg-neutral-950 border border-neutral-250 dark:border-neutral-750 text-neutral-500 dark:text-neutral-400 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-600 dark:hover:text-emerald-400'
                        }`}
                      >
                        <HabitIconHelper
                          iconName={habit.icon}
                          className={`w-3.5 h-3.5 flex-shrink-0 ${isDone ? 'text-white' : ''}`}
                        />
                        <span>{habit.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section: Journal Editor */}
          <div className="border border-neutral-300 dark:border-neutral-700 rounded-2xl overflow-hidden mb-6 flex flex-col">
            {/* Editor toolbar */}
            <div className="bg-neutral-50 dark:bg-neutral-900 px-4 py-2 border-b border-neutral-300 dark:border-neutral-700 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => insertMarkdown('bold')} 
                  type="button"
                  className="p-1 rounded text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-850"
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => insertMarkdown('italic')} 
                  type="button"
                  className="p-1 rounded text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-850"
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => insertMarkdown('heading')} 
                  type="button"
                  className="p-1 rounded text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-850"
                  title="Heading"
                >
                  <Heading1 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => insertMarkdown('list')} 
                  type="button"
                  className="p-1 rounded text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-850"
                  title="Bullet List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => insertMarkdown('checkbox')} 
                  type="button"
                  className="p-1 rounded text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-850"
                  title="Task Checklist"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Preview toggle */}
              <button
                type="button"
                onClick={() => setIsPreview(!isPreview)}
                className="flex items-center gap-1 text-[10px] font-bold text-neutral-500 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 px-2 py-1 rounded-md"
              >
                {isPreview ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {isPreview ? 'Write' : 'Preview'}
              </button>
            </div>

            {/* Editor Workspace */}
            <div className="p-4 bg-white dark:bg-neutral-900 min-h-[220px]">
              {isPreview ? (
                <div 
                  className="prose dark:prose-invert max-w-none text-sm outline-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                />
              ) : (
                <textarea
                  id="journal-textarea"
                  rows={8}
                  placeholder="Today was... (supports markdown, auto-saves)"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none text-sm leading-relaxed resize-none no-scrollbar text-neutral-900 dark:text-neutral-200"
                />
              )}
            </div>
          </div>

          {/* Section: Due Payments on This Day */}
          {(() => {
            const parsedDay = parsedDate.getDate();
            const duePayments = allOutstanding.filter(o => {
              if (!o.dueDate) return false;
              const d = String(o.dueDate);
              if (d === dateStr) return true;
              if (/^\d{1,2}$/.test(d)) return parseInt(d, 10) === parsedDay;
              return false;
            });
            if (duePayments.length === 0) return null;
            return (
              <div className="mb-4 border border-neutral-200 dark:border-neutral-850 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider">📅 Due on This Day</span>
                  <span className="ml-auto text-[10px] font-bold text-neutral-400">{duePayments.length} payment{duePayments.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-850">
                  {duePayments.map(debt => {
                    const isLent = debt.direction === 'lent';
                    return (
                      <div key={debt.id} className={`flex items-center justify-between px-4 py-3 ${
                        isLent ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : 'bg-red-50/30 dark:bg-red-950/10'
                      }`}>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                              isLent
                                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            }`}>
                              {isLent ? '↗ Receivable' : '↙ Pay'}
                            </span>
                            <span className="text-[9px] font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                              {debt.type}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-neutral-800 dark:text-white mt-0.5">{debt.name}</span>
                          {debt.minimumDue > 0 && (
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Min. due: ₹{debt.minimumDue.toLocaleString()}</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`text-base font-extrabold ${
                            isLent ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                          }`}>
                            ₹{debt.outstandingAmount.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-neutral-400 dark:text-neutral-500 block">outstanding</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Section: Fixed Expenses Due on This Day */}
          {(() => {
            const parsedDay = parsedDate.getDate();
            const parsedMonth = parsedDate.getMonth() + 1;
            const dueFixed = allFixedExpenses.filter(fe => {
              if (fe.repeat === 'Monthly') return fe.dueDate === parsedDay;
              if (fe.repeat === 'Yearly' && fe.lastGeneratedMonth) {
                const [, month] = fe.lastGeneratedMonth.split('-');
                return fe.dueDate === parsedDay && parseInt(month, 10) === parsedMonth;
              }
              return false;
            });
            if (dueFixed.length === 0) return null;
            return (
              <div className="mb-4 border border-amber-200 dark:border-amber-900/40 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/40 flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">📌 Fixed Expenses Due</span>
                  <span className="ml-auto text-[10px] font-bold text-amber-500">{dueFixed.length} item{dueFixed.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-col divide-y divide-amber-100 dark:divide-amber-900/30">
                  {dueFixed.map(fe => (
                    <div key={fe.id} className="flex items-center justify-between px-4 py-3 bg-amber-50/30 dark:bg-amber-950/10">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">
                            {fe.repeat}
                          </span>
                          <span className="text-[9px] font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                            {fe.category}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-neutral-800 dark:text-white mt-0.5">{fe.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                          ₹{fe.amount.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-neutral-400 dark:text-neutral-500 block">due today</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Section: Expenses for this Day */}
          <div className="border border-neutral-200 dark:border-neutral-850 rounded-2xl p-4 bg-neutral-50/20 dark:bg-neutral-900/10">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-apple-red" /> Day Expenses
              </h3>
              <button
                onClick={() => setShowAddExpense(!showAddExpense)}
                className="text-[10px] font-bold bg-apple-blue text-white px-2.5 py-1.5 rounded-lg shadow-sm"
              >
                {showAddExpense ? 'Cancel' : 'Add Expense'}
              </button>
            </div>

            {/* Inline add form */}
            {showAddExpense && (
              <form onSubmit={handleAddExpense} className="grid grid-cols-2 gap-3 mb-4 bg-white dark:bg-neutral-900 p-3.5 rounded-xl border border-neutral-300 dark:border-neutral-700">
                <input
                  type="number"
                  placeholder="Amount"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white"
                  required
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white"
                />
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <select
                  value={expAccountId}
                  onChange={(e) => setExpAccountId(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="col-span-2 bg-apple-blue text-white py-1.5 rounded-lg text-xs font-bold shadow-sm"
                >
                  Save Expense
                </button>
              </form>
            )}

            {/* List of day expenses */}
            <div className="flex flex-col gap-1.5">
              {dayExpenses.map((exp) => (
                <div key={exp.id}>
                  {editingExpenseId === exp.id ? (
                    /* Inline edit form */
                    <div className="bg-white dark:bg-neutral-900 border border-apple-blue/40 rounded-xl p-3 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          placeholder="Amount"
                          className="px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description"
                          className="px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white"
                        />
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white"
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <select
                          value={editAccountId}
                          onChange={(e) => setEditAccountId(e.target.value)}
                          className="px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white"
                        >
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEditExpense(exp)}
                          className="flex-1 bg-apple-blue text-white py-1.5 rounded-lg text-[10px] font-bold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingExpenseId(null)}
                          className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 py-1.5 rounded-lg text-[10px] font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal row */
                    <div className="flex justify-between items-center bg-white dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs">
                      <div>
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{exp.description}</span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-2 bg-neutral-50 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                          {exp.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-neutral-850 dark:text-white">₹{exp.amount.toLocaleString()}</span>
                        <button
                          onClick={() => startEditExpense(exp)}
                          className="text-neutral-400 hover:text-apple-blue transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp)}
                          className="text-neutral-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {dayExpenses.length === 0 && (
                <div className="text-center py-2 text-xs text-neutral-400 italic">
                  No expenses logged for this date.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer info status */}
        <div className="border-t border-neutral-100 dark:border-neutral-900 pt-4 mt-6 text-center">
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
            Auto-saves modifications locally on changes
          </span>
        </div>
      </motion.div>
    </div>
  );
}
