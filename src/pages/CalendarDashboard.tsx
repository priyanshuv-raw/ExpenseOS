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

  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');
  const [selectedDayStr, setSelectedDayStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showDailyPageModal, setShowDailyPageModal] = useState(false);

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
    if (viewMode === 'month' || viewMode === 'agenda') {
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
          {/* Month / Week / Agenda toggle */}
          <div className="flex bg-neutral-100 dark:bg-neutral-900 p-0.75 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === 'month' 
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm' 
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === 'week' 
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm' 
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === 'agenda' 
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm' 
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'
              }`}
            >
              Agenda
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={handlePrev}
              className="p-2 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-850 dark:text-neutral-400 transition-colors border-r border-neutral-200 dark:border-neutral-800 cursor-pointer"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3.5 py-2 text-xs font-bold text-neutral-700 dark:text-neutral-350 hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors border-r border-neutral-200 dark:border-neutral-800 cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-2 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-850 dark:text-neutral-400 transition-colors cursor-pointer"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CALENDAR VIEW MODE (MONTH / WEEK / AGENDA) */}
      {viewMode === 'agenda' ? (
        <div className="flex flex-col gap-2.5">
          {days.filter(d => isSameMonth(d, currentDate)).map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const isSelToday = isToday(date);
            const metrics = getDayMetrics(date);
            const hasData = metrics.totalSpent > 0 || metrics.journalWritten || metrics.dueDebts.length > 0 || metrics.dueFixedExpenses.length > 0;

            return (
              <Card
                key={dateStr}
                onClick={() => {
                  setSelectedDayStr(dateStr);
                  setShowDailyPageModal(true);
                }}
                className={`p-3.5 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-4 border ${
                  selectedDayStr === dateStr
                    ? 'ring-2 ring-apple-blue border-transparent bg-white dark:bg-[#0d1b2a] shadow-md'
                    : 'bg-white/80 dark:bg-[#0d1b2a]/60 border-neutral-200/60 dark:border-neutral-800/80 hover:border-apple-blue/40'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-[140px]">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    isSelToday ? 'bg-apple-blue text-white shadow-md' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                  }`}>
                    {format(date, 'd')}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-neutral-900 dark:text-white block">{format(date, 'EEEE')}</span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-semibold">{format(date, 'MMM d, yyyy')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap justify-end">
                  {metrics.mood && <span className="text-base select-none">{metrics.mood}</span>}

                  {metrics.totalSpent > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      ₹{metrics.totalSpent.toLocaleString()}
                    </span>
                  )}

                  {metrics.journalWritten && metrics.sleepHours > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                      💤 {metrics.sleepHours}h
                    </span>
                  )}

                  {metrics.dueDebts.length > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {metrics.dueDebts.length} Debt Due
                    </span>
                  )}

                  {metrics.dueFixedExpenses.length > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      {metrics.dueFixedExpenses.length} Bill Due
                    </span>
                  )}

                  {!hasData && (
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-600 italic">No logs</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <>
          {/* DESKTOP CALENDAR VIEW (md: and above) - UNTOUCHED APPLE CALENDAR GRID */}
          <div className="hidden md:flex flex-col gap-4">
            {/* Desktop Week Day Labels */}
            <div className="grid grid-cols-7 gap-3 text-center border-b border-neutral-100 dark:border-neutral-800/80 pb-2">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                <span key={d} className="text-[11px] font-extrabold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                  {d}
                </span>
              ))}
            </div>

            {/* Desktop Full Apple Calendar Grid */}
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
                    onClick={() => {
                      setSelectedDayStr(dateStr);
                      setShowDailyPageModal(true);
                    }}
                    className={`min-h-[105px] flex flex-col justify-between cursor-pointer text-left select-none relative transition-all duration-200 rounded-2xl p-3 ${
                      !isCurrentMonth 
                        ? 'opacity-20 pointer-events-none' 
                        : 'bg-white/80 dark:bg-[#0d1b2a]/60 border-neutral-200/60 dark:border-neutral-800/80 hover:border-apple-blue/40 hover:shadow-md'
                    } ${
                      isSelToday 
                        ? 'ring-2 ring-apple-blue border-transparent bg-white dark:bg-[#0d1b2a] shadow-lg shadow-apple-blue/10' 
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                        isSelToday 
                          ? 'bg-apple-blue text-white shadow-md shadow-apple-blue/30 scale-105' 
                          : 'text-neutral-700 dark:text-neutral-200'
                      }`}>
                        {format(date, 'd')}
                      </span>
                      {metrics.mood && (
                        <span className="text-sm select-none leading-none drop-shadow-xs">{metrics.mood}</span>
                      )}
                    </div>

                    {/* Desktop Detailed Chips */}
                    <div className="flex flex-col gap-1 w-full mt-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        {metrics.totalSpent > 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-tight ${
                            metrics.totalSpent <= 450
                              ? 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-950/60 border border-emerald-500/20'
                              : 'text-apple-red dark:text-red-400 bg-apple-red/10 dark:bg-red-950/60 border border-red-500/20'
                          }`}>
                            ₹{metrics.totalSpent.toLocaleString()}
                          </span>
                        )}
                        {metrics.journalWritten && metrics.sleepHours > 0 && (
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/60 border border-indigo-500/20 px-1.5 py-0.5 rounded tracking-tight">
                            💤{metrics.sleepHours}h
                          </span>
                        )}
                        {metrics.journalWritten && metrics.cigarettes > 0 && (
                          <span className="text-[10px] font-bold text-orange-600 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/60 border border-orange-500/20 px-1.5 py-0.5 rounded tracking-tight">
                            🚬{metrics.cigarettes}
                          </span>
                        )}
                      </div>

                      {metrics.dueDebts.length > 0 && (
                        <div className="flex flex-col gap-0.5">
                          {metrics.dueDebts.map(debt => (
                            <div
                              key={debt.id}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold leading-none truncate border ${
                                debt.direction === 'lent'
                                  ? 'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                                  : 'bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300 border-red-500/20'
                              }`}
                              title={`${debt.direction === 'lent' ? '↗ Receivable' : '↙ Pay'}: ${debt.name} — ₹${debt.outstandingAmount.toLocaleString()}`}
                            >
                              <span>{debt.direction === 'lent' ? '↗' : '↙'}</span>
                              <span className="truncate">{debt.name.length > 8 ? debt.name.slice(0, 8) + '…' : debt.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {metrics.dueFixedExpenses.length > 0 && (
                        <div className="flex flex-col gap-0.5">
                          {metrics.dueFixedExpenses.map(fe => {
                            const isIncome = fe.category === 'Income';
                            return (
                              <div
                                key={fe.id}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold leading-none truncate border ${
                                  isIncome
                                    ? 'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                                    : 'bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300 border-red-500/20'
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

                      {metrics.habitPercent > 0 && (
                        <div className="w-full mt-auto pt-1">
                          <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-apple-teal rounded-full transition-all duration-350"
                              style={{ width: `${metrics.habitPercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* MOBILE CALENDAR VIEW (md:hidden) */}
          <div className="md:hidden flex flex-col gap-4">
            <Card className="p-4 rounded-3xl bg-white dark:bg-[#0d1b2a] border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col gap-3">
              {/* Calendar Picker Header */}
              <div className="flex items-center justify-between pb-1">
                <button
                  onClick={handlePrev}
                  className="p-2 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                  aria-label="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-neutral-900 dark:text-white tracking-tight">
                    {formattedMonthYear}
                  </h2>
                  <button
                    onClick={handleToday}
                    className="text-[10px] font-bold text-apple-blue bg-apple-blue/10 dark:bg-apple-blue/20 px-2 py-0.5 rounded-full border border-apple-blue/20 cursor-pointer"
                  >
                    Today
                  </button>
                </div>

                <button
                  onClick={handleNext}
                  className="p-2 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                  aria-label="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Weekday Single Letter Header: S M T W T F S */}
              <div className="grid grid-cols-7 gap-1 text-center border-b border-neutral-100 dark:border-neutral-800/60 pb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <span key={i} className="text-xs font-bold text-neutral-400 dark:text-neutral-500">
                    {d}
                  </span>
                ))}
              </div>

              {/* Date Grid matching screenshot layout */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {days.map((date, idx) => {
                  const isCurrentMonth = isSameMonth(date, currentDate);
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const isSelected = selectedDayStr === dateStr;
                  const isSelToday = isToday(date);
                  const metrics = getDayMetrics(date);

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDayStr(dateStr)}
                      className="flex flex-col items-center justify-center cursor-pointer py-1 select-none group"
                    >
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs transition-all ${
                        isSelected
                          ? 'bg-neutral-900 text-white dark:bg-apple-blue dark:text-white font-black shadow-md scale-105'
                          : !isCurrentMonth
                          ? 'text-neutral-300 dark:text-neutral-700 font-medium'
                          : isSelToday
                          ? 'border-2 border-apple-blue text-apple-blue font-extrabold'
                          : 'text-neutral-800 dark:text-neutral-200 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                      }`}>
                        {format(date, 'd')}
                      </div>

                      {/* Activity Indicator Dots below date */}
                      <div className="flex items-center gap-1 h-2 mt-0.5">
                        {metrics.totalSpent > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-apple-red" />
                        )}
                        {metrics.habitPercent > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-apple-teal" />
                        )}
                        {metrics.journalWritten && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        )}
                        {(metrics.dueDebts.length > 0 || metrics.dueFixedExpenses.length > 0) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* SELECTED DATE DETAILS PANEL (Renders directly below calendar on mobile) */}
            {selectedDayStr && (() => {
              const selectedDateObj = parseISO(selectedDayStr);
              const selectedMetrics = getDayMetrics(selectedDateObj);
              const selectedDayExpenses = expenses.filter(e => e.date === selectedDayStr);

              return (
                <div className="flex flex-col gap-4 mt-1">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-sm font-extrabold text-neutral-800 dark:text-neutral-200 tracking-tight">
                      Details — {format(selectedDateObj, 'MMMM d, yyyy')}
                    </h3>
                    <button
                      onClick={() => setShowDailyPageModal(true)}
                      className="text-xs font-bold text-apple-blue hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Full Day Log <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Details Cards Container */}
                  <div className="grid grid-cols-1 gap-3">
                    {/* Card 1: Daily Check-in & Recovery */}
                    <Card className="p-4 rounded-2xl flex flex-col justify-between gap-3 bg-white dark:bg-[#0d1b2a] border border-neutral-200/80 dark:border-neutral-800">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                          Daily Check-in
                        </span>
                        {selectedMetrics.mood && (
                          <span className="text-xl">{selectedMetrics.mood}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center pt-1">
                        <div className="bg-neutral-50 dark:bg-neutral-900/60 p-2 rounded-xl border border-neutral-100 dark:border-neutral-800">
                          <span className="text-[9px] font-bold text-neutral-400 block">Spent</span>
                          <span className={`text-sm font-black ${selectedMetrics.totalSpent > 0 ? 'text-apple-red' : 'text-neutral-700 dark:text-neutral-300'}`}>
                            ₹{selectedMetrics.totalSpent.toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-neutral-50 dark:bg-neutral-900/60 p-2 rounded-xl border border-neutral-100 dark:border-neutral-800">
                          <span className="text-[9px] font-bold text-neutral-400 block">Sleep</span>
                          <span className="text-sm font-black text-indigo-500">
                            {selectedMetrics.sleepHours ? `${selectedMetrics.sleepHours}h` : '—'}
                          </span>
                        </div>
                        <div className="bg-neutral-50 dark:bg-neutral-900/60 p-2 rounded-xl border border-neutral-100 dark:border-neutral-800">
                          <span className="text-[9px] font-bold text-neutral-400 block">Habits</span>
                          <span className="text-sm font-black text-apple-teal">
                            {selectedMetrics.habitPercent}%
                          </span>
                        </div>
                      </div>
                    </Card>

                    {/* Card 2: Transactions / Expenses */}
                    <Card className="p-4 rounded-2xl flex flex-col gap-3 bg-white dark:bg-[#0d1b2a] border border-neutral-200/80 dark:border-neutral-800">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                          Expenses ({selectedDayExpenses.length})
                        </span>
                        <span className="text-xs font-black text-neutral-900 dark:text-white">
                          Total: ₹{selectedMetrics.totalSpent.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
                        {selectedDayExpenses.length > 0 ? (
                          selectedDayExpenses.map(exp => (
                            <div key={exp.id} className="flex justify-between items-center text-xs py-1 border-b border-neutral-100 dark:border-neutral-800/60 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                                  {exp.category}
                                </span>
                                <span className="font-semibold text-neutral-800 dark:text-neutral-200">{exp.description || exp.category}</span>
                              </div>
                              <span className="font-bold text-apple-red">₹{exp.amount.toLocaleString()}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-neutral-400 italic">No expenses logged for this date.</span>
                        )}
                      </div>
                    </Card>

                    {/* Card 3: Due Bills & Debts */}
                    {(selectedMetrics.dueDebts.length > 0 || selectedMetrics.dueFixedExpenses.length > 0) && (
                      <Card className="p-4 rounded-2xl flex flex-col gap-2.5 bg-white dark:bg-[#0d1b2a] border border-neutral-200/80 dark:border-neutral-800">
                        <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                          Scheduled Payments & Due Bills
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {selectedMetrics.dueDebts.map(d => (
                            <span key={d.id} className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              {d.direction === 'lent' ? '↗ Receivable' : '↙ Debt Due'}: {d.name} (₹{d.outstandingAmount.toLocaleString()})
                            </span>
                          ))}
                          {selectedMetrics.dueFixedExpenses.map(fe => (
                            <span key={fe.id} className="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                              {fe.category === 'Income' ? '↑ Recurring Income' : '↓ Recurring Bill'}: {fe.name} (₹{fe.amount.toLocaleString()})
                            </span>
                          ))}
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* Sliding daily drawer page */}
      {showDailyPageModal && selectedDayStr && (
        <DailyPage 
          dateStr={selectedDayStr} 
          onClose={() => setShowDailyPageModal(false)} 
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
