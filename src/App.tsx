import React, { useState, useEffect } from 'react';
import { db, seedDatabase } from './db/db';
import { runFixedExpensesEngine } from './db/fixedExpensesEngine';
import { Sidebar } from './components/Sidebar';
import { RightSidebar } from './components/RightSidebar';
import { FloatingAddButton } from './components/FloatingAddButton';
import { MobileHeader } from './components/MobileHeader';
import { MobileTabBar } from './components/MobileTabBar';
import { auth, onAuthStateChanged, type User } from './config/firebase';

// Pages
import { CalendarDashboard } from './pages/CalendarDashboard';
import { FixedExpensesPage } from './pages/FixedExpensesPage';
import { AccountsPage } from './pages/AccountsPage';
import { OutstandingPage } from './pages/OutstandingPage';
import { HabitsPage } from './pages/HabitsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  const [activeTab, setActiveTab] = useState<string>('calendar');
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(false);
  const [isMobileLeftOpen, setIsMobileLeftOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [dbInitialized, setDbInitialized] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  // Open right sidebar by default on desktop screens
  useEffect(() => {
    if (window.innerWidth >= 768) {
      setIsRightSidebarOpen(true);
    }
  }, []);

  // Initialize DB and Seed
  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Seed database with defaults if empty
        await seedDatabase();

        // 2. Run monthly fixed expenses engine
        await runFixedExpensesEngine();

        // 3. Load active theme from settings
        const storedTheme = await db.settings.get('theme');
        if (storedTheme) {
          const activeTheme = storedTheme.value;
          setTheme(activeTheme);
          if (activeTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        } else {
          // Default to system preference
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            setTheme('dark');
            document.documentElement.classList.add('dark');
          }
        }

        setDbInitialized(true);
      } catch (err) {
        console.error('Error initializing DB/LifeOS application:', err);
      }
    };

    initApp();
  }, []);

  const toggleTheme = async () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Update Settings DB
    await db.settings.put({ key: 'theme', value: nextTheme });
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('dayledge_sidebar_collapsed') === 'true';
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('dayledge_sidebar_collapsed', String(next));
      return next;
    });
  };

  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  // Switch pages based on active tab
  const renderPage = () => {
    switch (activeTab) {
      case 'calendar':
        return <CalendarDashboard currentDate={calendarDate} setCurrentDate={setCalendarDate} />;
      case 'fixed-expenses':
        return <FixedExpensesPage />;
      case 'accounts':
        return <AccountsPage />;
      case 'outstanding':
        return <OutstandingPage />;
      case 'habits':
        return <HabitsPage />;
      case 'statistics':
        return <AnalyticsPage />;
      case 'search':
        return <SearchPage />;
      case 'settings':
        return <SettingsPage theme={theme} setTheme={setTheme} />;
      default:
        return <CalendarDashboard currentDate={calendarDate} setCurrentDate={setCalendarDate} />;
    }
  };

  if (!dbInitialized) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neutral-900 dark:border-white"></div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider mt-4">
          Loading workspace
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      {/* Mobile Top Header */}
      <MobileHeader 
        user={user}
        onOpenLeftSidebar={() => setIsMobileLeftOpen(true)}
        onOpenRightSidebar={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        theme={theme}
        toggleTheme={toggleTheme}
        activeTab={activeTab}
      />

      {/* Navigation Left Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        theme={theme} 
        toggleTheme={toggleTheme} 
        isMobileOpen={isMobileLeftOpen}
        onCloseMobile={() => setIsMobileLeftOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      {/* Main Content Workspace Layout */}
      <main 
        className={`pt-16 md:pt-6 pb-24 md:pb-12 px-3 md:px-8 transition-all duration-300 ml-0 ${
          isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        } ${
          isRightSidebarOpen ? 'mr-0 md:mr-80' : 'mr-0'
        }`}
      >
        <div className="max-w-5xl mx-auto">
          {renderPage()}
        </div>
      </main>

      {/* Summary Right Sidebar */}
      <RightSidebar 
        isOpen={isRightSidebarOpen} 
        setIsOpen={setIsRightSidebarOpen} 
        selectedDate={calendarDate}
      />

      {/* iOS Bottom Tab Bar */}
      <MobileTabBar 
        activeTab={activeTab === 'fixed-expenses' ? 'fixed' : activeTab === 'statistics' ? 'analytics' : activeTab}
        setActiveTab={(t) => {
          if (t === 'fixed') setActiveTab('fixed-expenses');
          else if (t === 'analytics') setActiveTab('statistics');
          else setActiveTab(t);
        }}
      />

      {/* Action floating buttons drawer */}
      <FloatingAddButton />
    </div>
  );
}

export default App;
