import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Card } from '../components/Card';
import { HealthScoreModal } from '../components/HealthScoreModal';
import { 
  AreaChart, Area, 
  BarChart, Bar, 
  PieChart, Pie, Cell, 
  LineChart, Line, 
  XAxis, YAxis, 
  CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend 
} from 'recharts';
import { format, startOfMonth, eachDayOfInterval, subDays } from 'date-fns';
import { Sparkles, TrendingUp, Heart, FileText, Smile } from 'lucide-react';

export function AnalyticsPage() {
  const [showHealthModal, setShowHealthModal] = useState(false);
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const fixedExpenses = useLiveQuery(() => db.fixedExpenses.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const outstanding = useLiveQuery(() => db.outstanding.toArray()) || [];
  const habits = useLiveQuery(() => db.habits.toArray()) || [];
  const logs = useLiveQuery(() => db.habitLogs.toArray()) || [];
  const journals = useLiveQuery(() => db.journal.toArray()) || [];
  const dailyBudgetSetting = useLiveQuery(() => db.settings.get('dailyBudget'));
  const dailyBudget = dailyBudgetSetting ? Number(dailyBudgetSetting.value) : 450;

  // Theme support helper (Vibrant Apple system colors)
  const isDarkMode = document.documentElement.classList.contains('dark');
  const colors = [
    '#007aff', // Apple Blue
    '#34c759', // Apple Green
    '#af52de', // Apple Purple
    '#ff9500', // Apple Orange
    '#ff3b30', // Apple Red
    '#00c7be', // Apple Teal
    '#ff2d55', // Apple Pink
    '#5856d6'  // Apple Indigo
  ];

  // ================= 1. DAILY SPENDING HISTORY (Current Month) =================
  const today = new Date();
  const currentMonthStart = startOfMonth(today);
  const daysInMonth = eachDayOfInterval({ start: currentMonthStart, end: today });
  
  const dailySpendingData = daysInMonth.map(day => {
    const dStr = format(day, 'yyyy-MM-dd');
    const daySpend = expenses
      .filter(e => e.date === dStr && e.category !== 'Income')
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      date: format(day, 'dd MMM'),
      Spent: daySpend
    };
  });

  // ================= 2. CASH FLOW (Income vs Expense) =================
  const currentMonthStr = format(today, 'yyyy-MM');
  const monthExpensesList = expenses.filter(e => e.date.startsWith(currentMonthStr));
  
  const totalIncome = monthExpensesList
    .filter(e => e.category === 'Income')
    .reduce((sum, e) => sum + e.amount, 0);
  
  const totalExpense = monthExpensesList
    .filter(e => e.category !== 'Income')
    .reduce((sum, e) => sum + e.amount, 0);

  const cashFlowData = [
    { name: 'Income', Amount: totalIncome },
    { name: 'Expenses', Amount: totalExpense }
  ];

  // ================= 3. CATEGORY PIE CHART =================
  const categoryMap: { [cat: string]: number } = {};
  expenses
    .filter(e => e.category !== 'Income')
    .forEach(e => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    });

  const categoryPieData = Object.keys(categoryMap).map(cat => ({
    name: cat,
    value: categoryMap[cat]
  })).sort((a, b) => b.value - a.value);

  // ================= 4. ACCOUNT BALANCES =================
  const accountBalancesData = accounts.map(acc => ({
    name: acc.name,
    Balance: acc.balance
  }));

  // ================= 5. OUTSTANDING TREND =================
  // Generate active liabilities breakups
  const debtBreakupData = outstanding
    .filter(o => o.status === 'active')
    .map(o => ({
      name: o.name,
      Outstanding: o.outstandingAmount,
      direction: o.direction || 'borrowed'
    }));

  // ================= 6. HABIT COMPLETION PERFORMANCE =================
  const habitCompletionData = habits
    .filter(h => h.active)
    .map(h => {
      const habitLogs = logs.filter(l => l.habitId === h.id);
      const completed = habitLogs.filter(l => l.completed).length;
      const rate = habitLogs.length > 0 ? Math.round((completed / habitLogs.length) * 100) : 0;
      return {
        name: h.name,
        Rate: rate
      };
    }).sort((a, b) => b.Rate - a.Rate);

  // ================= 7. FINANCIAL HEALTH SCORE OVERVIEW =================
  const calculateFinancialScore = () => {
    if (expenses.length === 0) return 85;
    
    // Compare standard monthly budget conformance
    const totalOutflow = expenses
      .filter(e => e.category !== 'Income' && e.date.startsWith(currentMonthStr))
      .reduce((sum, e) => sum + e.amount, 0);
      
    const budgetAllowance = 1500 * today.getDate(); // 1500 per day
    if (totalOutflow <= budgetAllowance) return 92;
    if (totalOutflow <= budgetAllowance * 1.2) return 78;
    if (totalOutflow <= budgetAllowance * 1.5) return 60;
    return 45;
  };

  const calculateHabitHealthScore = () => {
    const monthLogs = logs.filter(l => l.date.startsWith(currentMonthStr));
    if (monthLogs.length === 0) return 80;
    const completed = monthLogs.filter(l => l.completed).length;
    return Math.round((completed / monthLogs.length) * 100);
  };

  const financeScore = calculateFinancialScore();
  const habitsScore = calculateHabitHealthScore();
  const overallHealthScore = Math.round((financeScore * 0.6) + (habitsScore * 0.4));

  // Journaling Frequency metric
  const journalFrequency = journals.filter(j => j.date.startsWith(currentMonthStr)).length;

  return (
    <div className="space-y-6 pb-10">
      <div className="border-b border-neutral-100 dark:border-neutral-900 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Analytics</h1>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
          Deep-dive statistics on habits, budget compliance, balances, and wellness.
        </p>
      </div>

      {/* Wellness Scores Widget row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card 
          onClick={() => setShowHealthModal(true)}
          className="flex items-center gap-4 cursor-pointer hover:border-apple-purple/40 hover:scale-[1.02] active:scale-[0.99] transition-all"
        >
          <div className="p-3 bg-apple-purple/10 dark:bg-apple-purple/20 rounded-xl text-apple-purple">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider block">Life OS Health Score</span>
            <span className="text-xl font-black mt-0.5 block text-neutral-900 dark:text-white">{overallHealthScore}/100</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-neutral-100 dark:bg-neutral-850 rounded-xl text-neutral-900 dark:text-white">
            <Smile className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider block">Habit Discipline Rating</span>
            <span className="text-xl font-black mt-0.5 block">{habitsScore}% completion</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-neutral-100 dark:bg-neutral-850 rounded-xl text-neutral-900 dark:text-white">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider block">Journal Count (This Month)</span>
            <span className="text-xl font-black mt-0.5 block">{journalFrequency} entries logged</span>
          </div>
        </Card>
      </div>

      {/* Daily Spending & Inflow vs Outflow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Spending */}
        <Card className="lg:col-span-2 p-5 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-neutral-850 dark:text-white">Daily Spending Trend (July)</h3>
            <span className="text-[10px] text-neutral-400">Chronological history of expenses</span>
          </div>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySpendingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007aff" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#007aff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e1e1e' : '#f5f5f5'} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#888' }} />
                <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#888' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#171717' : '#ffffff', 
                    border: '1px solid #88888820', 
                    borderRadius: 12,
                    fontSize: 11
                  }} 
                />
                <Area type="monotone" dataKey="Spent" stroke="#007aff" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpent)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Cash Flow comparison */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-neutral-850 dark:text-white">Cash Flow Balance</h3>
            <span className="text-[10px] text-neutral-400">Total Income vs Total Spending</span>
          </div>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e1e1e' : '#f5f5f5'} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#888' }} />
                <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#888' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#171717' : '#ffffff', 
                    border: '1px solid #88888820', 
                    borderRadius: 12,
                    fontSize: 11
                  }} 
                />
                <Bar dataKey="Amount" radius={[8, 8, 0, 0]}>
                  {cashFlowData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#34c759' : '#ff3b30'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Category Pie & Account Balance Horizontal Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Pie */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-neutral-850 dark:text-white">Spending by Category</h3>
            <span className="text-[10px] text-neutral-400">Allocation breakdown of expenses</span>
          </div>
          <div className="w-full h-64 flex flex-col sm:flex-row items-center justify-around">
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#171717' : '#ffffff', 
                      border: '1px solid #88888820', 
                      borderRadius: 12,
                      fontSize: 11
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="text-[11px] flex flex-col gap-2 max-h-48 overflow-y-auto pl-4 border-l border-neutral-100 dark:border-neutral-900 no-scrollbar">
              {categoryPieData.slice(0, 5).map((entry, idx) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                  <span className="text-neutral-500 font-medium">{entry.name}:</span>
                  <span className="font-bold text-neutral-950 dark:text-white">₹{entry.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Habits compliance list */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-neutral-850 dark:text-white">Habit Performance Rates</h3>
            <span className="text-[10px] text-neutral-400">Discipline rate by individual habit</span>
          </div>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={habitCompletionData.slice(0, 5)} layout="vertical" margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e1e1e' : '#f5f5f5'} />
                <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#888' }} />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#888' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#171717' : '#ffffff', 
                    border: '1px solid #88888820', 
                    borderRadius: 12,
                    fontSize: 11
                  }} 
                />
                <Bar dataKey="Rate" radius={[0, 6, 6, 0]}>
                  {habitCompletionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Account Balances & Debts Split lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Balances comparison */}
        <Card className="p-5">
          <h3 className="text-sm font-bold text-neutral-850 dark:text-white mb-4">Account Funds distribution</h3>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={accountBalancesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e1e1e' : '#f5f5f5'} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#888' }} />
                <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#888' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#171717' : '#ffffff', 
                    border: '1px solid #88888820', 
                    borderRadius: 12,
                    fontSize: 11
                  }} 
                />
                <Bar dataKey="Balance" fill={isDarkMode ? '#ffffff' : '#171717'} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Debts outstanding trend */}
        <Card className="p-5">
          <h3 className="text-sm font-bold text-neutral-850 dark:text-white mb-4">Debt Split Outlines</h3>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={debtBreakupData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e1e1e' : '#f5f5f5'} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#888' }} />
                <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#888' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#171717' : '#ffffff', 
                    border: '1px solid #88888820', 
                    borderRadius: 12,
                    fontSize: 11
                  }} 
                />
                <Bar dataKey="Outstanding" radius={[6, 6, 0, 0]}>
                  {debtBreakupData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.direction === 'lent' ? '#10b981' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Health Score Modal */}
      <HealthScoreModal
        isOpen={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        currentDate={today}
        expenses={expenses}
        fixedExpenses={fixedExpenses}
        outstanding={outstanding}
        habitsLogs={logs}
        activeHabits={habits}
        dailyBudget={dailyBudget}
      />
    </div>
  );
}
