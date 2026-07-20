import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Receipt, BookOpen, CheckSquare, Smile, Brain, Moon, Sun, Clock, Zap, Cigarette, Minus } from 'lucide-react';
import { db, type Expense, type JournalEntry, type HabitLog } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { HabitIconHelper } from '../utils/icons';

export function FloatingAddButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'expense' | 'journal' | 'habits' | null>(null);
  
  // Form states - Expense
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Food');
  const [accountId, setAccountId] = useState('hdfc');
  const [description, setDescription] = useState('');
  const [receiptBase64, setReceiptBase64] = useState<string | undefined>(undefined);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDueDate, setScheduledDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [transactionType, setTransactionType] = useState<'Expense' | 'Income'>('Expense');

  // Form states - Journal
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [journalContent, setJournalContent] = useState('');
  const [mood, setMood] = useState<JournalEntry['mood']>('😊');
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(2);
  const [sleepHours, setSleepHours] = useState(7);
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('23:00');
  const [cigarettes, setCigarettes] = useState(0);

  // Query habits and categories
  const habits = useLiveQuery(() => db.habits.filter(h => h.active === true).toArray()) || [];
  const todayLogs = useLiveQuery(() => db.habitLogs.filter(l => l.date === todayStr).toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const categoriesSetting = useLiveQuery(() => db.settings.get('categories'));
  const categories = categoriesSetting ? (categoriesSetting.value as string[]) : ['Food', 'Groceries', 'Travel', 'Bills', 'Shopping', 'Entertainment', 'Medical', 'Subscription', 'Rent', 'Utilities', 'Other'];

  // Register Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + E -> Quick Expense
      if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsOpen(false);
        setActiveModal('expense');
      }
      // Alt + J -> Quick Journal
      if (e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsOpen(false);
        setActiveModal('journal');
        // Fetch existing journal for today if any
        loadTodayJournal();
      }
      // Alt + H -> Quick Habits
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setIsOpen(false);
        setActiveModal('habits');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadTodayJournal = async () => {
    const existing = await db.journal.get(todayStr);
    if (existing) {
      setJournalContent(existing.content || '');
      setMood(existing.mood || '😊');
      setEnergy(existing.energy);
      setStress(existing.stress);
      setSleepHours(existing.sleepHours);
      setWakeTime(existing.wakeTime);
      setSleepTime(existing.sleepTime || '23:00');
      setCigarettes(existing.cigarettes || 0);
    }
  };

  // Handle receipt upload
  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submissions
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    const parsedAmount = Math.abs(Number(amount));
    const now = new Date();

    if (isScheduled) {
      // Create Scheduled Transaction
      const newScheduled = {
        id: crypto.randomUUID(),
        name: description.trim() || `${category} ${transactionType}`,
        amount: parsedAmount,
        type: transactionType,
        category,
        dueDate: scheduledDueDate || todayStr,
        status: 'pending' as const
      };
      await db.scheduledTransactions.add(newScheduled);
    } else {
      // Create normal immediate Expense
      const selectedAcc = accounts.find(a => a.id === accountId);
      const resolvedPaymentType = selectedAcc ? selectedAcc.name : 'Unknown';
      const resolvedCategory = transactionType === 'Income' ? 'Income' : category;

      const newExpense: Expense = {
        id: crypto.randomUUID(),
        amount: parsedAmount,
        category: resolvedCategory,
        account: accountId,
        paymentType: resolvedPaymentType,
        description: description || `${resolvedCategory} ${transactionType}`,
        date: todayStr,
        time: format(now, 'HH:mm'),
        receiptImage: receiptBase64
      };

      await db.expenses.add(newExpense);

      // Adjust Account balance
      const account = await db.accounts.get(accountId);
      if (account) {
        if (resolvedCategory === 'Income') {
          account.balance += parsedAmount;
        } else {
          account.balance -= parsedAmount;
        }
        await db.accounts.put(account);
      }

      // If Credit Card, update outstanding
      if (resolvedPaymentType === 'Credit Card' || selectedAcc?.name.toLowerCase().includes('card') || selectedAcc?.icon === 'card') {
        const activeCard = await db.outstanding.filter(o => o.type === 'Credit Card').first();
        if (activeCard) {
          activeCard.outstandingAmount += parsedAmount;
          await db.outstanding.put(activeCard);
        }
      }
    }

    // Reset Form
    setAmount('');
    setDescription('');
    setCategory('Food');
    setIsScheduled(false);
    setScheduledDueDate(todayStr);
    setReceiptBase64(undefined);
    setActiveModal(null);
  };

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();

    const journalEntry: JournalEntry = {
      date: todayStr,
      content: journalContent,
      mood,
      energy,
      stress,
      sleepHours,
      wakeTime,
      sleepTime,
      cigarettes
    };

    await db.journal.put(journalEntry);
    setCigarettes(0);
    setActiveModal(null);
  };

  const toggleHabit = async (habitId: string) => {
    const log = todayLogs.find(l => l.habitId === habitId);
    if (log) {
      log.completed = !log.completed;
      await db.habitLogs.put(log);
    } else {
      const newLog: HabitLog = {
        date: todayStr,
        habitId,
        completed: true
      };
      await db.habitLogs.add(newLog);
    }
  };

  return (
    <>
      <div className="fixed bottom-22 md:bottom-8 right-5 md:right-6 z-40">
      {/* Dim backdrop when menu is expanded */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu Options */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 z-40 flex flex-col gap-3 items-end mb-2 animate-scale-up">
          {/* Option 1: Quick Expense */}
          <div 
            onClick={() => { setActiveModal('expense'); setIsOpen(false); }}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <span className="bg-white dark:bg-[#0d1b2a] px-3 py-1.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 text-xs font-bold shadow-md text-neutral-800 dark:text-white whitespace-nowrap select-none group-hover:border-apple-blue transition-colors">
              Add Expense <span className="text-[10px] text-neutral-400 font-normal ml-1">⌥E</span>
            </span>
            <button
              type="button"
              className="w-12 h-12 rounded-full bg-white dark:bg-[#0d1b2a] border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-center text-neutral-800 dark:text-white shadow-lg group-hover:scale-110 group-hover:border-apple-blue group-hover:text-apple-blue transition-all cursor-pointer"
            >
              <Receipt className="w-5 h-5" />
            </button>
          </div>

          {/* Option 2: Quick Habits */}
          <div 
            onClick={() => { setActiveModal('habits'); setIsOpen(false); }}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <span className="bg-white dark:bg-[#0d1b2a] px-3 py-1.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 text-xs font-bold shadow-md text-neutral-800 dark:text-white whitespace-nowrap select-none group-hover:border-apple-blue transition-colors">
              Log Habits <span className="text-[10px] text-neutral-400 font-normal ml-1">⌥H</span>
            </span>
            <button
              type="button"
              className="w-12 h-12 rounded-full bg-white dark:bg-[#0d1b2a] border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-center text-neutral-800 dark:text-white shadow-lg group-hover:scale-110 group-hover:border-apple-blue group-hover:text-apple-blue transition-all cursor-pointer"
            >
              <CheckSquare className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main floating action button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative z-40 w-14 h-14 rounded-full bg-apple-blue text-white flex items-center justify-center shadow-xl shadow-apple-blue/30 hover:scale-105 active:scale-95 transition-transform duration-200 cursor-pointer"
        aria-label="Add Action Menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6 stroke-[2.5px]" />}
      </button>
    </div>

    {/* ================= MODAL SHEETS ================= */}

    {/* 1. Add Expense Modal */}
    {activeModal === 'expense' && (
      <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl relative max-h-[85vh] sm:max-h-[90vh] overflow-y-auto animate-slide-up sm:animate-none">
            {/* iOS Grab Bar */}
            <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto mb-4 sm:hidden" />
            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Quick Add Expense</h2>
             <div className="flex bg-neutral-100 dark:bg-neutral-950 p-0.75 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs mb-4">
               <button
                 type="button"
                 onClick={() => setTransactionType('Expense')}
                 className={`flex-1 py-2 rounded-lg font-bold text-center transition-all ${
                   transactionType === 'Expense' 
                     ? 'bg-white dark:bg-neutral-850 text-neutral-950 dark:text-white shadow-sm' 
                     : 'text-neutral-500 dark:text-neutral-450 hover:text-neutral-800'
                 }`}
               >
                 Expense
               </button>
               <button
                 type="button"
                 onClick={() => setTransactionType('Income')}
                 className={`flex-1 py-2 rounded-lg font-bold text-center transition-all ${
                   transactionType === 'Income' 
                     ? 'bg-white dark:bg-neutral-850 text-neutral-950 dark:text-white shadow-sm' 
                     : 'text-neutral-500 dark:text-neutral-450 hover:text-neutral-800'
                 }`}
               >
                 Income
               </button>
             </div>

             <form onSubmit={handleAddExpense} className="flex flex-col gap-4">
               <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-950/40 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 my-0.5">
                 <div>
                   <label className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200 block">Schedule pending transaction</label>
                   <span className="text-[9px] text-neutral-400 dark:text-neutral-500 block">Ask on due date instead of logging now</span>
                 </div>
                 <input 
                   type="checkbox"
                   checked={isScheduled}
                   onChange={(e) => setIsScheduled(e.target.checked)}
                   className="w-4 h-4 text-apple-blue rounded border-neutral-300 focus:ring-apple-blue cursor-pointer"
                 />
               </div>

               <div>
                 <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Amount (₹)</label>
                 <input 
                   type="text" 
                   pattern="[0-9]*\.?[0-9]*" 
                   inputMode="decimal"
                   placeholder="e.g. 500" 
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-md font-bold text-neutral-900 dark:text-white"
                   required
                 />
               </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue text-neutral-900 dark:text-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                {!isScheduled && (
                  <div>
                    <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Account</label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full bg-white dark:bg-neutral-950 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue text-neutral-900 dark:text-white"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {isScheduled && (
                  <div>
                    <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Due Date</label>
                    <input
                      type="date"
                      value={scheduledDueDate}
                      onChange={(e) => setScheduledDueDate(e.target.value)}
                      className="w-full bg-white dark:bg-neutral-950 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue text-neutral-900 dark:text-white"
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Description</label>
                <input 
                  type="text" 
                  placeholder="What was this for?" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Attach Receipt Image</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleReceiptChange}
                  className="w-full text-xs text-neutral-500 mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-neutral-105 file:text-neutral-700 dark:file:bg-neutral-800 dark:file:text-neutral-300 hover:file:bg-neutral-200 dark:hover:file:bg-neutral-700 file:cursor-pointer"
                />
                {receiptBase64 && (
                  <div className="mt-2 text-[10px] text-apple-green font-semibold italic">
                    ✓ Image attached successfully
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-apple-blue text-white py-3 rounded-xl text-sm font-bold mt-2 shadow-md shadow-apple-blue/15 hover:bg-apple-blue/90 transition-colors"
              >
                Log Expense
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Write Journal Modal */}
      {activeModal === 'journal' && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-xl shadow-2xl relative h-[88vh] sm:h-[90vh] overflow-y-auto no-scrollbar animate-slide-up sm:animate-none">
            {/* iOS Grab Bar */}
            <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto mb-4 sm:hidden" />
            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Today's Daily Log</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>

            <form onSubmit={handleSaveJournal} className="flex flex-col gap-6">
              {/* Group 1: Mental & Emotional Wellbeing */}
              <div className="bg-neutral-50/50 dark:bg-neutral-900/30 p-5 rounded-2xl border border-neutral-100 dark:border-neutral-900/80 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-900/60 pb-2">
                  <Brain className="w-4 h-4 text-pink-500 stroke-[2.5px]" />
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">Mental & Emotional Wellbeing</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-450 dark:text-neutral-500 uppercase block mb-2">Mood Indicator</label>
                    <div className="flex gap-2">
                      {(['😊', '😄', '😐', '😔', '😢'] as const).map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setMood(emoji)}
                          className={`text-xl p-2 rounded-xl border transition-all cursor-pointer ${
                            mood === emoji 
                              ? 'bg-apple-blue/10 border-apple-blue scale-110' 
                              : 'bg-white border-neutral-200 hover:bg-neutral-50 dark:bg-neutral-950 dark:border-neutral-850'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-[10px] font-bold text-neutral-455 dark:text-neutral-500 uppercase mb-1">
                      <span>Stress Level</span>
                      <span className="text-apple-red font-bold">{stress}/5</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={stress}
                      onChange={(e) => setStress(Number(e.target.value))}
                      className="w-full accent-apple-blue cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-neutral-400 dark:text-neutral-500 font-bold px-1">
                      <span>Calm</span>
                      <span>Stressed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 2: Sleep & Recovery */}
              <div className="bg-neutral-50/50 dark:bg-neutral-900/30 p-5 rounded-2xl border border-neutral-100 dark:border-neutral-900/80 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-900/60 pb-2">
                  <Moon className="w-4 h-4 text-indigo-400 stroke-[2.5px]" />
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">Sleep & Recovery</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-450 dark:text-neutral-500 uppercase block mb-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-apple-blue" /> Sleep Hours
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={sleepHours}
                      onChange={(e) => setSleepHours(Number(e.target.value))}
                      className="w-full bg-white dark:bg-neutral-950 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-apple-blue text-xs text-neutral-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-[10px] font-bold text-neutral-450 dark:text-neutral-500 uppercase mb-1.5">
                      <span>Energy Rating</span>
                      <span className="text-apple-orange font-bold">{energy}/5</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={energy}
                      onChange={(e) => setEnergy(Number(e.target.value))}
                      className="w-full accent-apple-blue cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-neutral-400 dark:text-neutral-500 font-bold px-1">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 3: Consumables & Counters */}
              <div className="bg-neutral-50/50 dark:bg-neutral-900/30 p-5 rounded-2xl border border-neutral-100 dark:border-neutral-900/80 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-900/60 pb-2">
                  <Cigarette className="w-4 h-4 text-amber-600 stroke-[2px]" />
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">Consumables & Counters</span>
                </div>

                <div className="flex justify-between items-center bg-white dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-850">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-650 dark:text-amber-500">
                      <Cigarette className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-neutral-800 dark:text-white block">Cigarettes smoked</span>
                      <span className="text-[10px] text-neutral-450 dark:text-neutral-550">Log your daily count to track metrics</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => setCigarettes(c => Math.max(0, c - 1))}
                      className="w-8 h-8 rounded-full border border-neutral-300 dark:border-neutral-700 flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 active:scale-95 transition-transform cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-extrabold text-lg text-neutral-905 dark:text-white min-w-[20px] text-center">
                      {cigarettes}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCigarettes(c => c + 1)}
                      className="w-8 h-8 rounded-full border border-neutral-300 dark:border-neutral-700 flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 active:scale-95 transition-transform cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Group 4: Daily Journal Notes */}
              <div className="bg-neutral-50/50 dark:bg-neutral-900/30 p-5 rounded-2xl border border-neutral-100 dark:border-neutral-900/80 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-900/60 pb-2">
                  <BookOpen className="w-4 h-4 text-emerald-500 stroke-[2px]" />
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">Journal Editor</span>
                </div>
                
                <textarea
                  rows={6}
                  placeholder="How was today? Write your thoughts, struggles, or breakthroughs... (supports markdown)"
                  value={journalContent}
                  onChange={(e) => setJournalContent(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-950 p-4 rounded-xl border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-sm leading-relaxed text-neutral-900 dark:text-white animate-fade-in"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-apple-blue text-white py-3 rounded-xl text-sm font-bold shadow-md shadow-apple-blue/15 hover:bg-apple-blue/90 transition-colors mt-2"
              >
                Save Daily Log
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Toggle Habits Modal */}
      {activeModal === 'habits' && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-sm shadow-2xl relative max-h-[85vh] sm:max-h-[90vh] overflow-y-auto animate-slide-up sm:animate-none">
            {/* iOS Grab Bar */}
            <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto mb-4 sm:hidden" />
            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Today's Habits</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-5">Mark off completed habits for today</p>

            <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
              {[...habits].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(habit => {
                const isCompleted = todayLogs.some(l => l.habitId === habit.id && l.completed);
                return (
                  <button
                    key={habit.id}
                    onClick={() => toggleHabit(habit.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                      isCompleted 
                        ? 'bg-apple-blue border-apple-blue text-white shadow-md shadow-apple-blue/15' 
                        : 'bg-white border-neutral-350 hover:bg-neutral-50 dark:bg-neutral-950 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <HabitIconHelper iconName={habit.icon} className="w-4 h-4" />
                      <span className="text-sm font-semibold">{habit.name}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      isCompleted 
                        ? 'border-white bg-white/20' 
                        : 'border-neutral-400 bg-transparent'
                    }`}>
                      {isCompleted && <div className="w-2.5 h-2.5 rounded-sm bg-white" />}
                    </div>
                  </button>
                );
              })}
              {habits.length === 0 && (
                <div className="text-center text-xs text-neutral-500 dark:text-neutral-400 py-6">
                  No active habits. Create some in Settings!
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 py-3 rounded-xl text-sm font-bold hover:bg-neutral-850 dark:hover:bg-neutral-200 transition-colors mt-6 shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
