import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type JournalEntry, type Expense, type ScheduledTransaction, type FixedExpense } from '../db/db';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addMonths, 
  subMonths, 
  addWeeks, 
  subWeeks,
  isSameMonth, 
  isSameDay, 
  isToday, 
  parseISO 
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, BookOpen, Smile, Sparkles } from 'lucide-react';
import { Card } from '../components/Card';
import { DailyPage } from './DailyPage';
import { HealthScoreModal } from '../components/HealthScoreModal';

interface CalendarDashboardProps {
  currentDate?: Date;
  setCurrentDate?: React.Dispatch<React.SetStateAction<Date>>;
}

export function CalendarDashboard({ currentDate: propCurrentDate, setCurrentDate: propSetCurrentDate }: CalendarDashboardProps = {}) {
  const [internalDate, setInternalDate] = useState(new Date());
  const currentDate = propCurrentDate || internalDate;
  const setCurrentDate = propSetCurrentDate || setInternalDate;

  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);

  const [showHealthModal, setShowHealthModal] = useState(false);

  const formattedMonthYear = format(currentDate, 'MMMM yyyy');

  // Database queries
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const habitsLogs = useLiveQuery(() => db.habitLogs.toArray()) || [];
  const activeHabits = useLiveQuery(() => db.habits.filter(h => h.active === true).toArray()) || [];
  const journals = useLiveQuery(() => db.journal.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const outstanding = useLiveQuery(() => db.outstanding.filter(o => o.status === 'active').toArray()) || [];
  const fixedExpenses = useLiveQuery(() => db.fixedExpenses.toArray()) || [];
  const dailyBudgetSetting = useLiveQuery(() => db.settings.get('dailyBudget'));
  const dailyBudget = dailyBudgetSetting ? Number(dailyBudgetSetting.value) : 450;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const pendingNudges = useLiveQuery(() => 
    db.scheduledTransactions.filter(t => t.dueDate <= todayStr && t.status === 'pending').toArray()
  ) || [];

  // Nudge Actions States
  const [activeNudgeId, setActiveNudgeId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'yes' | 'no' | null>(null);
  const [nudgeAccountId, setNudgeAccountId] = useState('hdfc');
  const [nudgeNewDate, setNudgeNewDate] = useState(todayStr);

  const handleConfirmNudgeYes = async (nudge: ScheduledTransaction) => {
    try {
      const selectedAcc = accounts.find(a => a.id === nudgeAccountId);
      const resolvedPaymentType = selectedAcc ? selectedAcc.name : 'Unknown';
      const resolvedCategory = nudge.type === 'Income' ? 'Income' : nudge.category;

      const newExpense = {
        id: crypto.randomUUID(),
        amount: nudge.amount,
        category: resolvedCategory,
        account: nudgeAccountId,
        paymentType: resolvedPaymentType,
        description: nudge.name,
        date: nudge.dueDate,
        time: '12:00'
      };

      await db.expenses.add(newExpense);

      // Adjust Account balance
      const account = await db.accounts.get(nudgeAccountId);
      if (account) {
        if (resolvedCategory === 'Income') {
          account.balance += nudge.amount;
        } else {
          account.balance -= nudge.amount;
        }
        await db.accounts.put(account);
      }

      // If Credit Card, update outstanding
      if (resolvedPaymentType === 'Credit Card' || selectedAcc?.name.toLowerCase().includes('card') || selectedAcc?.icon === 'card') {
        const activeCard = await db.outstanding.filter(o => o.type === 'Credit Card').first();
        if (activeCard) {
          activeCard.outstandingAmount += nudge.amount;
          await db.outstanding.put(activeCard);
        }
      }

      // Mark completed
      await db.scheduledTransactions.update(nudge.id, { status: 'completed' });
      
      // Clear nudge state
      setActiveNudgeId(null);
      setActionType(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmNudgeNo = async (nudgeId: string) => {
    try {
      await db.scheduledTransactions.update(nudgeId, { dueDate: nudgeNewDate });
      setActiveNudgeId(null);
      setActionType(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar days
  const getDays = () => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(monthStart);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  };

  const days = getDays();

  // Metrics calculators
  const getDayMetrics = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // 1. Expenses
    const dayExpenses = expenses.filter(e => e.date === dateStr && e.category !== 'Income');
    const totalSpent = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

    // 2. Journal
    const journal = journals.find(j => j.date === dateStr);

    // 3. Habits
    const dayLogs = habitsLogs.filter(l => l.date === dateStr);
    const totalHabits = activeHabits.length || 10;
    const completedHabits = dayLogs.filter(l => l.completed).length;
    const habitPercent = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;

    // 4. Debts/Receivables due on this day
    const dueDebts = outstanding.filter(o => {
      // dueDate can be 'YYYY-MM-DD' or a day number string like '15'
      if (!o.dueDate) return false;
      const d = String(o.dueDate);
      // Full date match
      if (d === dateStr) return true;
      // Day-of-month match (e.g. '15' means the 15th of every month)
      if (/^\d{1,2}$/.test(d)) {
        const dayNum = parseInt(d, 10);
        return date.getDate() === dayNum;
      }
      return false;
    });

    // 5. Fixed expenses due on this day
    const dueFixedExpenses = fixedExpenses.filter(fe => {
      if (fe.repeat === 'Monthly') {
        return date.getDate() === fe.dueDate;
      }
      if (fe.repeat === 'Yearly' && fe.lastGeneratedMonth) {
        // lastGeneratedMonth is 'YYYY-MM'; match the same day & month each year
        const [, month] = fe.lastGeneratedMonth.split('-');
        return date.getDate() === fe.dueDate && (date.getMonth() + 1) === parseInt(month, 10);
      }
      return false;
    });

    return {
      totalSpent,
      journalWritten: !!journal,
      mood: journal?.mood || '',
      habitPercent,
      sleepHours: journal?.sleepHours || 0,
      energy: journal?.energy || 0,
      cigarettes: journal?.cigarettes || 0,
      stress: journal?.stress || 0,
      dueDebts,
      dueFixedExpenses,
    };
  };

  // Calculate Monthly Health Score (Bonus feature)
  // Health Score is calculated based on budget conformance and habit completion rate of the current month
  const calculateMonthHealthScore = () => {
    const monthStr = format(currentDate, 'yyyy-MM');
    const monthDays = expenses.filter(e => e.date.startsWith(monthStr));
    const monthLogs = habitsLogs.filter(l => l.date.startsWith(monthStr));
    
    if (monthLogs.length === 0 && monthDays.length === 0) return 85; // baseline

    // Habit Score (0-100)
    const completedCount = monthLogs.filter(l => l.completed).length;
    const totalLogsCount = monthLogs.length || 1;
    const habitScore = (completedCount / totalLogsCount) * 100;

    // Financial Budget Score (0-100)
    // Baseline budget: 1500 * days in month
    const totalDaysInMonth = days.filter(d => isSameMonth(d, currentDate)).length || 30;
    const budgetLimit = 1500 * totalDaysInMonth;
    const actualSpent = monthDays.filter(e => e.category !== 'Income').reduce((sum, e) => sum + e.amount, 0);
    const spentPercent = actualSpent / budgetLimit;
    
    let financeScore = 100;
    if (spentPercent > 1) {
      financeScore = Math.max(20, 100 - (spentPercent - 1) * 100);
    } else {
      financeScore = 100 - (spentPercent * 20); // standard scale down
    }

    return Math.round((habitScore * 0.4) + (financeScore * 0.6));
  };

  const healthScore = calculateMonthHealthScore();

  const getHealthScoreStyle = (score: number) => {
    if (score >= 85) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    if (score >= 70) return 'bg-apple-orange/10 text-apple-orange dark:text-apple-orange border-apple-orange/20';
    return 'bg-apple-red/10 text-apple-red dark:text-apple-red border-apple-red/20';
  };

  return (
    <div className="space-y-6">
      {/* Nudge Notification Area */}
      {pendingNudges.length > 0 && (
        <div className="flex flex-col gap-3">
          {pendingNudges.map(nudge => {
            const isInteracting = activeNudgeId === nudge.id;
            return (
              <div 
                key={nudge.id}
                className="bg-apple-blue/5 border border-apple-blue/15 dark:bg-apple-blue/5 dark:border-apple-blue/10 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in text-xs"
              >
                <div className="flex gap-3.5 items-start">
                  <div className="relative mt-0.5">
                    <span className="absolute inline-flex h-2 w-2 rounded-full bg-apple-blue opacity-75 animate-ping -top-0.5 -right-0.5" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-apple-blue -top-0.5 -right-0.5" />
                    <div className="p-2.5 rounded-xl bg-apple-blue/10 text-apple-blue">
                      <CalendarDays className="w-4 h-4 animate-pulse-slow" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-850 dark:text-neutral-200">
                      Transaction Notification Nudge
                    </h3>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {nudge.type === 'Income' ? 'Did you receive' : 'Did you pay'}{' '}
                      <span className="font-bold text-neutral-800 dark:text-neutral-100">
                        ₹{nudge.amount.toLocaleString()}
                      </span>{' '}
                      for <span className="font-bold text-neutral-800 dark:text-neutral-100">{nudge.name}</span> on{' '}
                      <span className="font-bold text-neutral-800 dark:text-neutral-100">{nudge.dueDate}</span>?
                    </p>
                  </div>
                </div>

                {!isInteracting ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setActiveNudgeId(nudge.id);
                        setActionType('yes');
                        if (accounts.length > 0) setNudgeAccountId(accounts[0].id);
                      }}
                      className="bg-apple-blue text-white px-4 py-2 rounded-xl font-bold shadow-sm shadow-apple-blue/10 hover:bg-blue-650 transition-all text-[11px]"
                    >
                      Yes, Log it
                    </button>
                    <button
                      onClick={() => {
                        setActiveNudgeId(nudge.id);
                        setActionType('no');
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setNudgeNewDate(format(tomorrow, 'yyyy-MM-dd'));
                      }}
                      className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 px-4 py-2 rounded-xl font-bold hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-all text-[11px]"
                    >
                      No, Reschedule
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-neutral-950 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 animate-fade-in">
                    {actionType === 'yes' ? (
                      <>
                        <span className="font-bold text-neutral-500 dark:text-neutral-400 text-[10px] uppercase">Select Account:</span>
                        <select
                          value={nudgeAccountId}
                          onChange={(e) => setNudgeAccountId(e.target.value)}
                          className="bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-750 text-xs focus:outline-none"
                        >
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleConfirmNudgeYes(nudge)}
                          className="bg-apple-blue text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-650 transition-all text-[11px]"
                        >
                          Confirm
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-neutral-500 dark:text-neutral-400 text-[10px] uppercase">New Date:</span>
                        <input
                          type="date"
                          value={nudgeNewDate}
                          onChange={(e) => setNudgeNewDate(e.target.value)}
                          className="bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-750 text-xs focus:outline-none"
                        />
                        <button
                          onClick={() => handleConfirmNudgeNo(nudge.id)}
                          className="bg-apple-blue text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-650 transition-all text-[11px]"
                        >
                          Save New Date
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setActiveNudgeId(null);
                        setActionType(null);
                      }}
                      className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white text-xs px-1 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Calendar Header Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {formattedMonthYear}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-apple-purple" />
            Monthly Financial Health Score: 
            <button
              onClick={() => setShowHealthModal(true)}
              className={`font-bold border px-2 py-0.5 rounded-md hover:scale-105 active:scale-95 transition-transform cursor-pointer ${getHealthScoreStyle(healthScore)}`}
              title="Click to view health issues & recommendations"
            >
              {healthScore}/100
            </button>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month / Week toggle */}
          <div className="flex bg-neutral-100 dark:bg-neutral-900 p-0.75 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === 'month' 
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm' 
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'
              }`}
            >
              Month View
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === 'week' 
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm' 
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'
              }`}
            >
              Week View
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={handlePrev}
              className="p-2 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-850 dark:text-neutral-400 transition-colors border-r border-neutral-200 dark:border-neutral-800"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3.5 py-2 text-xs font-bold text-neutral-700 dark:text-neutral-350 hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors border-r border-neutral-200 dark:border-neutral-800"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-2 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-850 dark:text-neutral-400 transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Week Day Labels */}
      <div className="grid grid-cols-7 gap-3 text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d} className="text-xs font-bold text-neutral-400 dark:text-neutral-550 uppercase tracking-widest">
            {d}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-3">
        {days.map((date, idx) => {
          const isCurrentMonth = isSameMonth(date, currentDate);
          const dateStr = format(date, 'yyyy-MM-dd');
          const isSelToday = isToday(date);
          const metrics = getDayMetrics(date);

          return (
            <Card
              key={idx}
              hoverEffect={isCurrentMonth}
              onClick={() => setSelectedDayStr(dateStr)}
              className={`min-h-[110px] flex flex-col justify-between cursor-pointer text-left select-none relative transition-all duration-200 ${
                !isCurrentMonth 
                  ? 'opacity-25 pointer-events-none' 
                  : 'bg-white/60 dark:bg-neutral-900/20'
              } ${
                isSelToday 
                  ? 'ring-2 ring-apple-blue border-transparent bg-white dark:bg-neutral-900 shadow-md shadow-apple-blue/5' 
                  : ''
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold ${
                  isSelToday 
                    ? 'text-apple-blue dark:text-apple-blue font-extrabold' 
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}>
                  {format(date, 'd')}
                </span>
                {/* Mood alongside date */}
                {metrics.mood && (
                  <span className="text-sm select-none leading-none">{metrics.mood}</span>
                )}
              </div>

              {/* Purple journal dot — top right */}
              {metrics.journalWritten && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-apple-purple" title="Journal Written" />
              )}

              {/* Day Metrics Node Indicators */}
              <div className="flex flex-col gap-1.5 mt-3">
                {/* Mobile Visual Dot Indicators */}
                <div className="flex md:hidden items-center justify-center gap-1 mt-auto pt-1">
                  {metrics.totalSpent > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-apple-red" />
                  )}
                  {metrics.dueFixedExpenses.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  )}
                  {metrics.dueDebts.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-apple-blue" />
                  )}
                  {metrics.habitPercent > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-apple-teal" />
                  )}
                </div>

                {/* Desktop Detailed Chips */}
                <div className="hidden md:flex flex-col gap-1 w-full">
                  {/* 1. Spent + Sleep + Cigs — single line */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {metrics.totalSpent > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-tight ${
                        metrics.totalSpent <= 450
                          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                          : 'text-apple-red dark:text-apple-red bg-apple-red/8'
                      }`}>
                        ₹{metrics.totalSpent.toLocaleString()}
                      </span>
                    )}
                    {metrics.journalWritten && metrics.sleepHours > 0 && (
                      <span className="text-[8px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1 py-0.5 rounded leading-none">
                        💤{metrics.sleepHours}h
                      </span>
                    )}
                    {metrics.journalWritten && metrics.cigarettes > 0 && (
                      <span className="text-[8px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1 py-0.5 rounded leading-none">
                        🚬{metrics.cigarettes}
                      </span>
                    )}
                  </div>

                  {/* 2. Debt / Receivable due pills */}
                  {metrics.dueDebts.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      {metrics.dueDebts.map(debt => (
                        <div
                          key={debt.id}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold leading-none truncate ${
                            debt.direction === 'lent'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                              : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                          }`}
                          title={`${debt.direction === 'lent' ? '↗ Receivable' : '↙ Pay'}: ${debt.name} — ₹${debt.outstandingAmount.toLocaleString()}`}
                        >
                          <span>{debt.direction === 'lent' ? '↗' : '↙'}</span>
                          <span className="truncate">{debt.name.length > 8 ? debt.name.slice(0, 8) + '…' : debt.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3. Fixed recurring due pills */}
                  {metrics.dueFixedExpenses.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      {metrics.dueFixedExpenses.map(fe => {
                        const isIncome = fe.category === 'Income';
                        return (
                          <div
                            key={fe.id}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold leading-none truncate ${
                              isIncome
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                            }`}
                            title={`${isIncome ? '↑ Income' : '↓ Expense'}: ${fe.name} — ₹${fe.amount.toLocaleString()} (${fe.repeat})`}
                          >
                            <span>{isIncome ? '↑' : '↓'}</span>
                            <span className="truncate">{fe.name.length > 8 ? fe.name.slice(0, 8) + '…' : fe.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 3. Habit bar */}
                  {metrics.habitPercent > 0 && (
                    <div className="flex items-center gap-1.5 mt-auto pt-1">
                      <div className="flex-1 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-apple-teal rounded-full transition-all duration-350"
                          style={{ width: `${metrics.habitPercent}%` }}
                        />
                      </div>
                      <span className="text-[8px] font-bold text-apple-teal leading-none">
                        {metrics.habitPercent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Sliding daily drawer page */}
      {selectedDayStr && (
        <DailyPage 
          dateStr={selectedDayStr} 
          onClose={() => setSelectedDayStr(null)} 
        />
      )}

      {/* Health Score Modal */}
      <HealthScoreModal
        isOpen={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        currentDate={currentDate}
        expenses={expenses}
        fixedExpenses={fixedExpenses}
        outstanding={outstanding}
        habitsLogs={habitsLogs}
        activeHabits={activeHabits}
        dailyBudget={dailyBudget}
      />
    </div>
  );
}
