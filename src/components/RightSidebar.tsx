import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { format, startOfDay } from 'date-fns';
import { HabitIconHelper } from '../utils/icons';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  CalendarDays, 
  Award,
  Wallet2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

interface RightSidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedDate?: Date;
}

export function RightSidebar({ isOpen, setIsOpen, selectedDate = new Date() }: RightSidebarProps) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const monthKey = format(selectedDate, 'yyyy-MM');
  const monthLabel = format(selectedDate, 'MMMM yyyy');
  const monthName = format(selectedDate, 'MMMM');

  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  // Reactively query all expenses
  const allExpenses = useLiveQuery(() => db.expenses.toArray()) || [];

  // Reactively query accounts
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  
  // Reactively query outstanding debts
  const outstandingList = useLiveQuery(() => db.outstanding.toArray()) || [];

  // Filter expenses for selected calendar month
  const monthExpenses = allExpenses.filter(e => e.date && e.date.startsWith(monthKey));
  const monthIncome = monthExpenses.filter(e => e.category === 'Income').reduce((sum, e) => sum + e.amount, 0);
  const monthSpent = monthExpenses.filter(e => e.category !== 'Income').reduce((sum, e) => sum + e.amount, 0);
  const monthNetSavings = monthIncome - monthSpent;

  // Reactively query today's expenses
  const todayExpenses = monthExpenses.filter(e => e.date === todayStr && e.category !== 'Income');

  // Reactively query today's habits logs
  const todayHabitLogs = useLiveQuery(() => 
    db.habitLogs.filter(log => log.date === todayStr).toArray()
  ) || [];

  // Reactively query active habits
  const activeHabits = useLiveQuery(() => 
    db.habits.filter(h => h.active === true).toArray()
  ) || [];

  // Calculate Streak
  const allLogs = useLiveQuery(() => db.habitLogs.toArray()) || [];

  // 1. Calculations - Balances
  const totalAssets = accounts.reduce((sum, a) => sum + a.balance, 0);

  const isDueInMonth = (dueDate?: string) => {
    if (!dueDate) return true;
    const d = String(dueDate);
    if (d.startsWith(monthKey)) return true;
    if (/^\d{1,2}$/.test(d)) return true;
    return false;
  };

  // Outstanding Liabilities (I Owe) for selected month
  const activeLiabilities = outstandingList.filter(o => 
    o.status === 'active' && 
    (o.direction || 'borrowed') === 'borrowed' && 
    isDueInMonth(o.dueDate)
  );
  const monthOwe = activeLiabilities.reduce((sum, o) => sum + o.outstandingAmount, 0);

  // Receivables (Others Owe Me) for selected month
  const activeReceivables = outstandingList.filter(o => 
    o.status === 'active' && 
    o.direction === 'lent' && 
    isDueInMonth(o.dueDate)
  );
  const monthReceivables = activeReceivables.reduce((sum, o) => sum + o.outstandingAmount, 0);

  // Net Worth: Total Accounts Balance
  const netWorth = totalAssets;

  // 2. Budget Calculations
  const dbBudgetSetting = useLiveQuery(() => db.settings.get('dailyBudget'));
  const dailyBudget = dbBudgetSetting ? Number(dbBudgetSetting.value) : 1500;
  const spentToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const remainingBudget = Math.max(0, dailyBudget - spentToday);
  const budgetPercentage = Math.min(100, (spentToday / dailyBudget) * 100);

  // 3. Habits calculations
  const totalHabitsCount = activeHabits.length || 10;
  const completedTodayCount = todayHabitLogs.filter(l => l.completed).length;
  const habitCompletionPercent = Math.round((completedTodayCount / totalHabitsCount) * 100);

  // Calculate habit streak (overall consecutive days with at least 3 habits done, or any habit logged)
  // Let's compute streak of "any habit completed" in last days
  const getStreak = () => {
    if (allLogs.length === 0) return 0;
    
    // Group logs by date
    const dateLogsMap: { [date: string]: number } = {};
    allLogs.forEach(log => {
      if (log.completed) {
        dateLogsMap[log.date] = (dateLogsMap[log.date] || 0) + 1;
      }
    });

    let streak = 0;
    let checkDate = new Date();
    
    while (true) {
      const checkStr = format(checkDate, 'yyyy-MM-dd');
      if (dateLogsMap[checkStr] && dateLogsMap[checkStr] > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // If it's today and we haven't completed any habit yet, check yesterday to continue streak
        if (checkStr === todayStr) {
          checkDate.setDate(checkDate.getDate() - 1);
          const yesterdayStr = format(checkDate, 'yyyy-MM-dd');
          if (dateLogsMap[yesterdayStr] && dateLogsMap[yesterdayStr] > 0) {
            continue;
          }
        }
        break;
      }
    }
    return streak;
  };

  const currentStreak = getStreak();

  // Helper to determine the next calendar occurrence of a fixed monthly due day
  const getNextDueDateForFixed = (dueDay: number) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed
    
    // Build date for this month
    let targetDate = new Date(currentYear, currentMonth, dueDay);
    
    // If the date has already passed today, shift it to next month
    const todayStart = new Date(currentYear, currentMonth, today.getDate());
    if (targetDate < todayStart) {
      targetDate = new Date(currentYear, currentMonth + 1, dueDay);
    }
    return targetDate;
  };

  // Upcoming items from fixed expenses, outstanding debts, and receivables
  const upcomingPayments = useLiveQuery(async () => {
    if (!db.fixedExpenses || !db.outstanding) return [];

    const fixed = await db.fixedExpenses.toArray();
    const debts = await db.outstanding.filter(d => d.status === 'active').toArray();
    
    const list: { name: string; amount: number; date: Date; type: string; isLent?: boolean }[] = [];
    
    // 1. Add Fixed Expenses (only non-Income ones)
    fixed
      .filter(f => f.category !== 'Income')
      .forEach(f => {
        list.push({
          name: f.name,
          amount: f.amount,
          date: getNextDueDateForFixed(f.dueDate),
          type: 'Fixed Bill'
        });
      });
      
    // 2. Add Outstanding Debts & Receivables
    debts.forEach(d => {
      let parsedDate = new Date();
      try {
        if (d.dueDate) {
          parsedDate = new Date(d.dueDate);
        }
      } catch (e) {
        // Fallback
      }
      list.push({
        name: d.name,
        amount: d.outstandingAmount,
        date: parsedDate,
        type: d.type,
        isLent: d.direction === 'lent'
      });
    });
    
    // Sort chronologically ascending
    return list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }) || [];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)} 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm animate-fade-in"
        />
      )}

      {/* Desktop Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`hidden md:flex fixed top-6 right-6 z-20 w-8 h-8 rounded-full items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-all`}
      >
        {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Sidebar container */}
      <aside 
        className={`w-80 max-w-[85vw] h-screen fixed right-0 top-0 border-l border-neutral-100 dark:border-neutral-900 bg-white/95 dark:bg-neutral-950/95 md:bg-white/50 md:dark:bg-neutral-950/50 backdrop-blur-xl p-6 overflow-y-auto z-50 md:z-10 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="pt-8 flex flex-col gap-6 no-scrollbar">
          {/* Section: Financial Summary */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Financial Summary</h2>
              <span className="text-[10px] font-bold text-apple-blue bg-apple-blue/10 dark:bg-apple-blue/20 px-2 py-0.5 rounded-full">
                {monthLabel}
              </span>
            </div>

            <div className="bg-neutral-50/50 dark:bg-neutral-900/30 rounded-2xl p-4 border border-neutral-100 dark:border-neutral-900">
              {/* Selected Month Savings / Net */}
              <div className="mb-4">
                <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{monthName} Net</span>
                <div className={`text-2xl font-bold tracking-tight mt-0.5 ${monthNetSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {monthNetSavings >= 0 ? '+' : ''}₹{monthNetSavings.toLocaleString()}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-850 text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block font-medium">Income</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">+₹{monthIncome.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block font-medium">Spent</span>
                    <span className="font-extrabold text-red-500 dark:text-red-400">-₹{monthSpent.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Account details separately */}
              <div className="flex flex-col gap-2 border-t border-b border-neutral-100 dark:border-neutral-900 py-3 mb-3 text-xs">
                <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider block mb-1">Accounts</span>
                {accounts.map(acc => (
                  <div key={acc.id} className="flex justify-between">
                    <span className="text-neutral-450 dark:text-neutral-400 font-medium">{acc.name}</span>
                    <span className="font-semibold text-neutral-850 dark:text-white">₹{acc.balance.toLocaleString()}</span>
                  </div>
                ))}
                {accounts.length === 0 && (
                  <span className="text-[10px] text-neutral-400 italic">No accounts configured</span>
                )}
              </div>

              {/* Amount I Owe and Receivables */}
              <div className="flex flex-col gap-2 text-xs pb-3 border-b border-neutral-100 dark:border-neutral-900 mb-3">
                <div className="flex justify-between">
                  <span className="text-neutral-450 dark:text-neutral-400 font-medium">Amount I Owe</span>
                  <span className="font-semibold text-red-500 dark:text-red-400">₹{monthOwe.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-450 dark:text-neutral-400 font-medium">Receivables</span>
                  <span className="font-semibold text-emerald-500 dark:text-emerald-450">₹{monthReceivables.toLocaleString()}</span>
                </div>
              </div>

              {/* Total Net Worth at the bottom */}
              <div className="pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider block">Total Net Worth</span>
                  <span className="text-base font-extrabold text-neutral-900 dark:text-white">
                    ₹{netWorth.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Today's Budget */}
          <div>
            <h2 className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3">Today's Budget</h2>
            <div className="bg-neutral-50/50 dark:bg-neutral-900/30 rounded-2xl p-4 border border-neutral-100 dark:border-neutral-900 flex flex-col gap-3">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">Remaining</span>
                  <div className="text-lg font-bold text-neutral-850 dark:text-white mt-0.5">
                    ₹{remainingBudget.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">Spent Today</span>
                  <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mt-0.5">
                    ₹{spentToday.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${spentToday > dailyBudget ? 'bg-red-500' : 'bg-black dark:bg-white'}`}
                  style={{ width: `${budgetPercentage}%` }}
                />
              </div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                Daily allowance: ₹{dailyBudget}
              </span>
            </div>
          </div>

          {/* Section: Upcoming Payments */}
          <div>
            <h2 className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3">Upcoming Payments</h2>
            <div className="flex flex-col gap-2">
              {(() => {
                const visibleUpcoming = showAllUpcoming ? upcomingPayments : upcomingPayments.slice(0, 3);
                return visibleUpcoming.map((item, i) => {
                  const isLent = item.isLent;
                  const formattedDate = format(item.date, 'dd-MMM-yy');
                  return (
                    <div key={`bill-${i}`} className="bg-neutral-50/50 dark:bg-neutral-900/30 rounded-xl px-4 py-2.5 border border-neutral-100 dark:border-neutral-900 flex justify-between items-center text-xs animate-fade-in">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${isLent ? 'bg-emerald-500' : 'bg-red-400'}`} />
                        <div>
                          <div className="font-semibold text-neutral-800 dark:text-neutral-200">{item.name}</div>
                          <div className="text-[10px] text-neutral-400 dark:text-neutral-500">
                            {isLent ? 'Repayment' : 'Payment'} on {formattedDate}
                          </div>
                        </div>
                      </div>
                      <span className={`font-semibold ${isLent ? 'text-emerald-500' : 'text-neutral-900 dark:text-white'}`}>
                        {isLent ? '+' : ''}₹{item.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                });
              })()}
              {upcomingPayments.length === 0 && (
                <div className="text-center text-xs text-neutral-455 dark:text-neutral-500 py-3">No payments due soon</div>
              )}
              {upcomingPayments.length > 3 && (
                <button
                  onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                  className="w-full text-center text-[10px] font-bold text-apple-blue hover:underline mt-1 pt-2 border-t border-neutral-100 dark:border-neutral-900/60 transition-all cursor-pointer"
                >
                  {showAllUpcoming ? 'Show Less' : `Show All (${upcomingPayments.length})`}
                </button>
              )}
            </div>
          </div>

          {/* Section: Habits & Streaks */}
          <div>
            <h2 className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3">Habits & Streaks</h2>
            <div className="bg-neutral-50/50 dark:bg-neutral-900/30 rounded-2xl p-4 border border-neutral-100 dark:border-neutral-900 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">Today's Progress</span>
                  <div className="text-xl font-bold text-neutral-800 dark:text-white mt-0.5">
                    {habitCompletionPercent}%
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2.5 py-1.5 rounded-xl">
                  <Award className="w-4 h-4 text-neutral-800 dark:text-neutral-200" />
                  <div>
                    <div className="text-[9px] text-neutral-400 dark:text-neutral-500 font-bold uppercase leading-none">Streak</div>
                    <div className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mt-0.5 leading-none">{currentStreak} Days</div>
                  </div>
                </div>
              </div>

              {/* Mini visual summary of today's completed habits */}
              <div className="border-t border-neutral-100 dark:border-neutral-900 pt-3">
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider font-bold block mb-2">Logs ({completedTodayCount}/{totalHabitsCount})</span>
                <div className="flex flex-wrap gap-1">
                  {[...activeHabits].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(habit => {
                    const completed = todayHabitLogs.some(log => log.habitId === habit.id && log.completed);
                    return (
                      <span 
                        key={habit.id} 
                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold select-none inline-flex items-center gap-1 transition-all ${
                          completed 
                            ? 'bg-apple-teal text-white shadow-sm shadow-apple-teal/15 font-bold' 
                            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800/90 dark:text-neutral-200 border border-neutral-200/50 dark:border-neutral-700/60'
                        }`}
                      >
                        <HabitIconHelper iconName={habit.icon} className={`w-3 h-3 shrink-0 ${completed ? 'text-white' : 'text-neutral-500 dark:text-neutral-300'}`} />
                        <span>{habit.name}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
