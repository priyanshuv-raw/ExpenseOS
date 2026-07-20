import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Habit, type HabitLog } from '../db/db';
import { Card } from '../components/Card';
import { 
  format, 
  subDays, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  isSameDay, 
  parseISO 
} from 'date-fns';
import { 
  Plus, X, Award, Settings, Check, Trash2, Zap, GripVertical
} from 'lucide-react';
import { HABIT_ICONS, HabitIconHelper } from '../utils/icons';

export function HabitsPage() {
  const habits = useLiveQuery(() => db.habits.toArray()) || [];
  const logs = useLiveQuery(() => db.habitLogs.toArray()) || [];

  // Edit habits states
  const [showConfig, setShowConfig] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedIconName, setSelectedIconName] = useState('target');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);

  // Heatmap and Date calculations
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Last 7 days for the quick-log grid matrix
  const last7Days = eachDayOfInterval({
    start: subDays(today, 6),
    end: today
  }).reverse(); // Latest today first

  // Month days for heatmap
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const currentMonthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculations - Streaks
  const calculateStreaks = (habitId: string) => {
    const habitLogs = logs
      .filter(l => l.habitId === habitId && l.completed)
      .map(l => l.date)
      .sort(); // Ascending dates

    if (habitLogs.length === 0) return { current: 0, longest: 0 };

    const completedDates = new Set(habitLogs);

    // Calculate Longest Streak
    let longest = 0;
    let currentTemp = 0;
    let dateRunner = startOfMonth(parseISO(habitLogs[0]));
    const maxDate = new Date();

    while (dateRunner <= maxDate) {
      const runnerStr = format(dateRunner, 'yyyy-MM-dd');
      if (completedDates.has(runnerStr)) {
        currentTemp++;
        if (currentTemp > longest) longest = currentTemp;
      } else {
        currentTemp = 0;
      }
      dateRunner.setDate(dateRunner.getDate() + 1);
    }

    // Calculate Current Streak
    let current = 0;
    let checkDate = new Date();
    
    while (true) {
      const checkStr = format(checkDate, 'yyyy-MM-dd');
      if (completedDates.has(checkStr)) {
        current++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        if (checkStr === todayStr) {
          checkDate.setDate(checkDate.getDate() - 1);
          const yesterdayStr = format(checkDate, 'yyyy-MM-dd');
          if (completedDates.has(yesterdayStr)) {
            continue;
          }
        }
        break;
      }
    }

    return { current, longest };
  };

  const toggleHabitLog = async (dateStr: string, habitId: string) => {
    const existing = logs.find(l => l.date === dateStr && l.habitId === habitId);
    if (existing) {
      existing.completed = !existing.completed;
      await db.habitLogs.put(existing);
    } else {
      const newLog: HabitLog = {
        date: dateStr,
        habitId,
        completed: true
      };
      await db.habitLogs.add(newLog);
    }
  };

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    const newHabit: Habit = {
      id: crypto.randomUUID(),
      name: newHabitName.trim(),
      isDefault: false,
      active: true,
      createdAt: todayStr,
      icon: selectedIconName,
      order: habits.length
    };

    await db.habits.add(newHabit);
    setNewHabitName('');
    setSelectedIconName('target'); // Reset to default
  };

  const toggleHabitActive = async (habit: Habit) => {
    habit.active = !habit.active;
    await db.habits.put(habit);
  };

  const handleDeleteHabit = async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => {
        setDeleteConfirmId(prev => prev === id ? null : prev);
      }, 3000);
      return;
    }

    try {
      await db.habits.delete(id);
      await db.habitLogs.where('habitId').equals(id).delete();
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Failed to delete habit:", err);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedHabitId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedHabitId || draggedHabitId === targetId) return;

    const sorted = [...habits].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const draggedIndex = sorted.findIndex(h => h.id === draggedHabitId);
    const targetIndex = sorted.findIndex(h => h.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const [removed] = sorted.splice(draggedIndex, 1);
    sorted.splice(targetIndex, 0, removed);

    try {
      await db.transaction('rw', db.habits, async () => {
        for (let i = 0; i < sorted.length; i++) {
          sorted[i].order = i;
          await db.habits.put(sorted[i]);
        }
      });
    } catch (err) {
      console.error("Failed to reorder habits:", err);
    }

    setDraggedHabitId(null);
  };

  const activeHabitsList = habits.filter(h => h.active).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const sortedHabits = [...habits].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-neutral-100 dark:border-neutral-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Habits Tracker</h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            Build discipline with visual check matrices, heatmaps, and streak tracking.
          </p>
        </div>

        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all"
        >
          <Settings className="w-4 h-4 animate-spin-slow" /> {showConfig ? 'Hide Settings' : 'Configure Habits'}
        </button>
      </div>

      {/* Configuration panel */}
      {showConfig && (
        <Card className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 p-5 rounded-2xl">
          <h2 className="text-sm font-extrabold text-neutral-900 dark:text-white mb-4 uppercase tracking-wide">Manage Habits List</h2>
          <form onSubmit={handleCreateHabit} className="flex flex-col gap-4 mb-5 pb-5 border-b border-neutral-150 dark:border-neutral-850">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add custom habit e.g., Code, Exercise, Practice..."
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                className="flex-1 bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                required
              />
              <button
                type="submit"
                className="bg-apple-blue text-white hover:scale-105 active:scale-95 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Add Habit
              </button>
            </div>

            {/* Icon picker tray */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block mb-2">Select Habit Icon</label>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
                {Object.keys(HABIT_ICONS).map(iconName => {
                  const Icon = HABIT_ICONS[iconName];
                  const isSelected = selectedIconName === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setSelectedIconName(iconName)}
                      className={`p-2 rounded-lg border transition-all ${
                        isSelected 
                          ? 'bg-apple-blue border-apple-blue text-white shadow-sm scale-105' 
                          : 'bg-white border-neutral-200 hover:bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                      }`}
                      title={iconName}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </form>

          {/* Manage Habits Rows */}
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
            {sortedHabits.map(habit => (
              <div 
                key={habit.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, habit.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, habit.id)}
                onDragEnd={() => setDraggedHabitId(null)}
                className={`flex justify-between items-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-4 py-3 rounded-xl text-xs select-none transition-all ${
                  draggedHabitId === habit.id 
                    ? 'opacity-40 border-dashed border-apple-blue scale-[0.98]' 
                    : 'hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-neutral-300 dark:text-neutral-700 cursor-grab active:cursor-grabbing p-0.5 hover:text-neutral-500 transition-colors">
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-300">
                    <HabitIconHelper iconName={habit.icon} className="w-4 h-4" />
                  </div>
                  <span className={habit.active ? 'font-bold text-neutral-850 dark:text-neutral-200' : 'text-neutral-400 line-through'}>
                    {habit.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleHabitActive(habit)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${
                      habit.active 
                        ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200' 
                        : 'bg-neutral-200 text-neutral-400 dark:bg-neutral-850'
                    }`}
                  >
                    {habit.active ? 'Active' : 'Paused'}
                  </button>
                  
                  {/* Delete button with double-tap safety checks */}
                  {deleteConfirmId === habit.id ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteHabit(habit.id)}
                      className="bg-apple-red text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm shadow-apple-red/15 hover:bg-red-650 transition-all"
                    >
                      Delete?
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => handleDeleteHabit(habit.id)}
                      className="text-neutral-450 hover:text-apple-red p-1.5 transition-colors animate-fade-in"
                      title="Delete Habit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quick Check Matrix (Last 7 days) */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 bg-white/40 dark:bg-neutral-950/20 overflow-x-auto no-scrollbar">
        <h2 className="text-md font-bold text-neutral-900 dark:text-white mb-4">Quick Check Log Matrix (Last 7 Days)</h2>
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 pb-2">
              <th className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase py-2">Habit</th>
              {last7Days.map(date => (
                <th key={date.toISOString()} className="text-xs font-bold text-neutral-450 dark:text-neutral-500 uppercase text-center py-2">
                  {format(date, 'EEE dd')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeHabitsList.map(habit => (
              <tr key={habit.id} className="border-b border-neutral-100 dark:border-neutral-900/40 hover:bg-neutral-50/30 dark:hover:bg-neutral-900/20">
                <td className="text-xs font-bold text-neutral-900 dark:text-white py-3.5 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="text-apple-teal">
                      <HabitIconHelper iconName={habit.icon} className="w-4 h-4 text-apple-teal" />
                    </div>
                    <span className="text-neutral-900 dark:text-white font-bold">{habit.name}</span>
                  </div>
                </td>
                {last7Days.map(date => {
                  const dStr = format(date, 'yyyy-MM-dd');
                  const isCompleted = logs.some(l => l.date === dStr && l.habitId === habit.id && l.completed);
                  return (
                    <td key={dStr} className="text-center py-3">
                      <button
                        onClick={() => toggleHabitLog(dStr, habit.id)}
                        className={`w-7 h-7 mx-auto rounded-lg border flex items-center justify-center transition-all ${
                          isCompleted
                            ? 'bg-apple-teal border-apple-teal text-white scale-105 shadow-sm shadow-apple-teal/20'
                            : 'bg-white border-neutral-300 hover:bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-700 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3px]" />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {activeHabitsList.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-xs text-neutral-500 italic">
                  No active habits. Create or enable some habits above!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Habit Streak Cards & Heatmaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {activeHabitsList.map(habit => {
          const streak = calculateStreaks(habit.id);
          const habitLogsMap = new Set(
            logs.filter(l => l.habitId === habit.id && l.completed).map(l => l.date)
          );

          return (
            <Card key={habit.id} className="flex flex-col justify-between p-5 min-h-[175px]">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-apple-teal/10 text-apple-teal">
                      <HabitIconHelper iconName={habit.icon} className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white">{habit.name}</h3>
                  </div>
                  
                  <div className="flex gap-4 mt-3 ml-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-550">
                      <Zap className="w-3.5 h-3.5 text-apple-orange fill-apple-orange/20" />
                      <span>Streak: <strong>{streak.current}d</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-550">
                      <Award className="w-3.5 h-3.5 text-apple-blue" />
                      <span>Longest: <strong>{streak.longest}d</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Heatmap Calendar */}
              <div className="mt-5 border-t border-neutral-200 dark:border-neutral-800 pt-3">
                <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-2">
                  Monthly Heatmap
                </span>
                
                <div className="grid grid-cols-7 gap-1 w-max">
                  {currentMonthDays.map(date => {
                    const dStr = format(date, 'yyyy-MM-dd');
                    const done = habitLogsMap.has(dStr);
                    return (
                      <div
                        key={dStr}
                        title={`${format(date, 'MMM dd')}: ${done ? 'Completed' : 'Incomplete'}`}
                        className={`w-3.5 h-3.5 rounded-sm border ${
                          done 
                            ? 'bg-apple-teal border-apple-teal shadow-xs' 
                            : 'bg-neutral-100 border-neutral-300/30 dark:bg-neutral-950 dark:border-neutral-800'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
