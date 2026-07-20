import React from 'react';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, Lightbulb, Target } from 'lucide-react';
import { format } from 'date-fns';
import { type Expense, type FixedExpense, type OutstandingDebt, type HabitLog, type Habit } from '../db/db';

interface HealthScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate?: Date;
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
  outstanding: OutstandingDebt[];
  habitsLogs: HabitLog[];
  activeHabits: Habit[];
  dailyBudget?: number;
}

export function HealthScoreModal({
  isOpen,
  onClose,
  currentDate = new Date(),
  expenses,
  fixedExpenses,
  outstanding,
  habitsLogs,
  activeHabits,
  dailyBudget = 1500,
}: HealthScoreModalProps) {
  if (!isOpen) return null;

  const monthStr = format(currentDate, 'yyyy-MM');
  const monthName = format(currentDate, 'MMMM yyyy');

  // Filter expenses & logs for the target month
  const monthExpenses = expenses.filter(e => e.date && e.date.startsWith(monthStr));
  const monthIncome = monthExpenses.filter(e => e.category === 'Income').reduce((sum, e) => sum + e.amount, 0);
  const monthSpent = monthExpenses.filter(e => e.category !== 'Income').reduce((sum, e) => sum + e.amount, 0);

  // Budget calculations
  const totalDaysInMonth = 30;
  const monthlyBudgetLimit = dailyBudget * totalDaysInMonth;
  const budgetRatio = monthSpent / (monthlyBudgetLimit || 1);

  // Debt & Credit Card calculations
  const creditCards = outstanding.filter(o => o.status === 'active' && o.type === 'Credit Card');
  const totalCardLimit = creditCards.reduce((sum, c) => sum + (c.cardLimit || 100000), 0);
  const totalCardDebt = creditCards.reduce((sum, c) => sum + c.outstandingAmount, 0);
  const ccUtilization = totalCardLimit > 0 ? Math.round((totalCardDebt / totalCardLimit) * 100) : 0;

  const activeLiabilities = outstanding.filter(o => o.status === 'active' && (o.direction || 'borrowed') === 'borrowed');
  const totalDebt = activeLiabilities.reduce((sum, o) => sum + o.outstandingAmount, 0);

  // Habit calculations
  const monthHabitLogs = habitsLogs.filter(l => l.date && l.date.startsWith(monthStr));
  const completedHabits = monthHabitLogs.filter(l => l.completed).length;
  const habitCompletionRate = monthHabitLogs.length > 0 ? Math.round((completedHabits / monthHabitLogs.length) * 100) : 0;

  // Diagnostics & Issues Detection
  const issues: { title: string; desc: string; type: 'critical' | 'warning' | 'good' }[] = [];
  const recommendations: string[] = [];

  // Factor 1: Spending vs Budget
  if (monthSpent > monthlyBudgetLimit) {
    const overAmt = monthSpent - monthlyBudgetLimit;
    issues.push({
      title: `Over Monthly Budget by ₹${overAmt.toLocaleString()}`,
      desc: `Total monthly spend (₹${monthSpent.toLocaleString()}) exceeds your budget allowance of ₹${monthlyBudgetLimit.toLocaleString()}.`,
      type: 'critical',
    });
    recommendations.push(`Reduce non-essential expenses in categories like Shopping, Food, or Entertainment by ₹${overAmt.toLocaleString()}.`);
  } else if (monthSpent > monthlyBudgetLimit * 0.8) {
    issues.push({
      title: 'Approaching Monthly Budget Limit',
      desc: `You have used ${Math.round(budgetRatio * 100)}% of your ₹${monthlyBudgetLimit.toLocaleString()} monthly allowance.`,
      type: 'warning',
    });
    recommendations.push('Keep a tight daily spend limit for the remainder of the month to avoid exceeding your budget.');
  } else {
    issues.push({
      title: 'Spending Within Budget',
      desc: `You have spent ₹${monthSpent.toLocaleString()} out of ₹${monthlyBudgetLimit.toLocaleString()} allowance.`,
      type: 'good',
    });
  }

  // Factor 2: Income vs Expense Net
  if (monthIncome > 0 && monthSpent > monthIncome) {
    issues.push({
      title: `Negative Monthly Savings (-₹${(monthSpent - monthIncome).toLocaleString()})`,
      desc: 'Your total spending this month exceeds your recorded income.',
      type: 'critical',
    });
    recommendations.push('Review your recurring expenses and postpone optional purchases until cashflow becomes positive.');
  } else if (monthIncome === 0) {
    issues.push({
      title: 'No Recurring/Logged Income Found',
      desc: 'No income entries have been recorded for this month.',
      type: 'warning',
    });
    recommendations.push('Add your salary or freelance income under Fixed Recurring or Daily Expenses to reflect real cashflow.');
  } else {
    issues.push({
      title: `Positive Net Savings (+₹${(monthIncome - monthSpent).toLocaleString()})`,
      desc: 'Your monthly income successfully covers your total expenses.',
      type: 'good',
    });
  }

  // Factor 3: Credit Card Utilization & Debt
  if (ccUtilization > 50) {
    issues.push({
      title: `High Credit Card Utilization (${ccUtilization}%)`,
      desc: `Total credit card balance is ₹${totalCardDebt.toLocaleString()} out of ₹${totalCardLimit.toLocaleString()} total limit.`,
      type: 'critical',
    });
    recommendations.push('Pay down credit card balances to bring utilization under 30% to improve financial health & credit score.');
  } else if (ccUtilization > 30) {
    issues.push({
      title: `Moderate Credit Card Utilization (${ccUtilization}%)`,
      desc: 'Credit card utilization is slightly above the recommended 30% threshold.',
      type: 'warning',
    });
    recommendations.push('Consider clearing part of your card balance before the statement date.');
  } else if (totalDebt > 0) {
    issues.push({
      title: `Active Outstanding Debt (₹${totalDebt.toLocaleString()})`,
      desc: 'You have active loans or borrowed balances recorded.',
      type: 'warning',
    });
    recommendations.push('Allocate a portion of your monthly savings towards paying off high-interest debt early.');
  } else {
    issues.push({
      title: 'Zero Outstanding Debt',
      desc: 'No credit card debt or borrowed loans active.',
      type: 'good',
    });
  }

  // Factor 4: Habit Consistency
  if (habitCompletionRate < 50 && monthHabitLogs.length > 0) {
    issues.push({
      title: `Low Habit Completion (${habitCompletionRate}%)`,
      desc: 'Consistency across daily habit tracking is lower than target.',
      type: 'warning',
    });
    recommendations.push('Log at least 3 core habits daily (e.g. Drink Water, Workout, Good Sleep) to build discipline.');
  } else if (monthHabitLogs.length === 0) {
    issues.push({
      title: 'No Habit Logs Recorded Yet',
      desc: 'Start logging habits daily to track lifestyle discipline.',
      type: 'warning',
    });
    recommendations.push('Complete daily habit checkmarks in the Habits tab.');
  } else {
    issues.push({
      title: `Great Habit Consistency (${habitCompletionRate}%)`,
      desc: 'Strong daily habit execution across logged days.',
      type: 'good',
    });
  }

  // Score Calculation
  let finScore = 100;
  if (monthSpent > monthlyBudgetLimit) finScore -= 30;
  else if (monthSpent > monthlyBudgetLimit * 0.8) finScore -= 15;
  if (monthIncome > 0 && monthSpent > monthIncome) finScore -= 25;
  if (ccUtilization > 50) finScore -= 25;
  else if (ccUtilization > 30) finScore -= 15;

  const score = Math.max(15, Math.min(100, Math.round((finScore * 0.6) + (Math.max(30, habitCompletionRate) * 0.4))));

  const getScoreBadge = () => {
    if (score >= 85) return { label: 'Excellent', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' };
    if (score >= 70) return { label: 'Good', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' };
    return { label: 'Needs Attention', color: 'text-apple-red bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800' };
  };

  const badge = getScoreBadge();

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-apple-purple/10 dark:bg-apple-purple/20 rounded-2xl text-apple-purple">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Financial Health Breakdown</h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">Analysis & recommendations for {monthName}</p>
          </div>
        </div>

        {/* Score Summary Box */}
        <div className="bg-neutral-50 dark:bg-neutral-950 p-5 rounded-2xl border border-neutral-100 dark:border-neutral-850 flex items-center justify-between mb-6">
          <div>
            <span className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 block">Overall Health Score</span>
            <div className="text-3xl font-extrabold text-neutral-900 dark:text-white mt-1">
              {score} <span className="text-sm font-normal text-neutral-400">/ 100</span>
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${badge.color}`}>
            {badge.label}
          </span>
        </div>

        {/* Diagnostic Issues Section */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Detected Health Issues
          </h3>
          <div className="space-y-2.5">
            {issues.map((item, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  item.type === 'critical'
                    ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300'
                    : item.type === 'warning'
                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {item.type === 'critical' && <AlertTriangle className="w-4 h-4 text-apple-red shrink-0 mt-0.5" />}
                {item.type === 'warning' && <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                {item.type === 'good' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                <div>
                  <h4 className="text-xs font-bold mb-0.5">{item.title}</h4>
                  <p className="text-[11px] opacity-80 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How to Improve Section */}
        {recommendations.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-apple-blue" />
              Steps to Improve Score
            </h3>
            <div className="bg-apple-blue/5 dark:bg-apple-blue/10 rounded-2xl p-4 border border-apple-blue/15 space-y-2.5">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300">
                  <span className="text-apple-blue font-bold shrink-0">•</span>
                  <span className="font-medium leading-relaxed">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full bg-neutral-900 dark:bg-white text-white dark:text-black font-bold py-3 rounded-xl text-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-md"
        >
          Got It
        </button>
      </div>
    </div>
  );
}
