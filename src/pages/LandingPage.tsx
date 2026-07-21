import React, { useState } from 'react';
import { 
  Sparkles, 
  Zap, 
  CheckSquare, 
  CreditCard, 
  CalendarDays, 
  BarChart3, 
  ArrowRight, 
  ShieldCheck, 
  Database, 
  Cloud, 
  Lock, 
  LogIn, 
  Compass, 
  Repeat, 
  Moon, 
  Flame, 
  Star,
  Check
} from 'lucide-react';
import { signInWithGoogle } from '../config/firebase';

interface LandingPageProps {
  onExploreDemo: () => void;
}

export function LandingPage({ onExploreDemo }: LandingPageProps) {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (err: any) {
      alert('Sign-In Error: ' + (err?.message || 'Could not complete Google Login. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070d18] text-white selection:bg-[#26bba3]/30 selection:text-[#26bba3] font-sans relative overflow-x-hidden">
      {/* Dynamic Background Mesh Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#26bba3]/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[30rem] h-[30rem] bg-indigo-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-[#14b8a6]/10 rounded-full blur-[120px]" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-20 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/app-icon.png" alt="Dayledge Logo" className="w-10 h-10 rounded-xl shadow-lg border border-white/10" />
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
              Dayledge <span className="text-[10px] font-bold uppercase bg-[#26bba3]/20 text-[#26bba3] border border-[#26bba3]/30 px-2 py-0.5 rounded-full">Life OS</span>
            </span>
            <span className="text-[10px] text-neutral-400 font-medium tracking-wide">Financial Discipline & Habit Engine</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onExploreDemo}
            className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-300 hover:text-white hover:bg-white/5 border border-white/10 transition-all cursor-pointer"
          >
            Explore Local Demo
          </button>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#26bba3] text-neutral-950 hover:bg-[#209f8b] shadow-lg shadow-[#26bba3]/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <span>Connecting...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In with Google</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-12 pb-16 text-center flex flex-col items-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-[#26bba3] mb-6 backdrop-blur-md animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-[#26bba3]" />
          <span>Local-First Offline Speed + Encrypted Cloud Sync</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.15] mb-6">
          Master Your Habits, Debt, & <span className="bg-gradient-to-r from-[#26bba3] via-teal-300 to-indigo-400 bg-clip-text text-transparent">Financial Discipline</span>.
        </h1>

        {/* Subtitle */}
        <p className="text-base md:text-lg text-neutral-300 max-w-2xl font-normal leading-relaxed mb-8">
          Dayledge is a premium personal Life OS designed to track daily expenses, manage credit card utilization limits, log habit streaks, and monitor daily recovery metrics—all in one unified, sleek dashboard.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-14">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-[#26bba3] text-neutral-950 font-extrabold text-sm hover:bg-[#209f8b] shadow-xl shadow-[#26bba3]/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95"
          >
            <LogIn className="w-4 h-4" />
            <span>Start Your Life OS Free</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onExploreDemo}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white/5 text-white font-bold text-sm border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Compass className="w-4 h-4 text-neutral-400" />
            <span>Try Demo Without Account</span>
          </button>
        </div>

        {/* Feature Cards Grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-5 text-left mb-16">
          {/* Feature 1 */}
          <div className="bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-5 backdrop-blur-xl hover:border-[#26bba3]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#26bba3]/15 text-[#26bba3] flex items-center justify-center mb-4">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">30% Credit Utilization Guard</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Automated financial health score (0-100) tracking credit card billing cycles, debt-to-limit ratios, and 30-60-90 day payoff schedules.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-5 backdrop-blur-xl hover:border-[#26bba3]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mb-4">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Full-Width Habit Heatmaps</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Visual activity heatmap matrix tracking monthly habit streaks, completion counts, and longest discipline streaks.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-5 backdrop-blur-xl hover:border-[#26bba3]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-4">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Integrated Daily Check-in</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Combine mood emoji tracking, sleep recovery hours, cigarettes stepper, and expense logs in an intuitive Apple Calendar view.
            </p>
          </div>
        </div>

        {/* Visual App Showcase Card */}
        <div className="w-full bg-[#0d1b2a]/90 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden text-left mb-16">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#26bba3]/20 text-[#26bba3] text-xs font-extrabold mb-4 border border-[#26bba3]/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% Private & Local-First</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-4">
                Your Data Stays On Your Device
              </h2>
              <p className="text-xs md:text-sm text-neutral-300 leading-relaxed mb-6">
                Dayledge stores all your transactions, habit logs, and personal journals inside your browser using IndexedDB. Cloud sync to Google Firebase is 100% optional so your financial data remains completely under your control.
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 text-neutral-200">
                  <div className="w-4 h-4 rounded-full bg-[#26bba3]/20 text-[#26bba3] flex items-center justify-center text-[10px] font-bold">✓</div>
                  <span>Instant Offline Access</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-200">
                  <div className="w-4 h-4 rounded-full bg-[#26bba3]/20 text-[#26bba3] flex items-center justify-center text-[10px] font-bold">✓</div>
                  <span>Google Cloud Sync</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-200">
                  <div className="w-4 h-4 rounded-full bg-[#26bba3]/20 text-[#26bba3] flex items-center justify-center text-[10px] font-bold">✓</div>
                  <span>Export & Backup JSON</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-200">
                  <div className="w-4 h-4 rounded-full bg-[#26bba3]/20 text-[#26bba3] flex items-center justify-center text-[10px] font-bold">✓</div>
                  <span>Dark & Light Themes</span>
                </div>
              </div>
            </div>

            <div className="w-full md:w-80 shrink-0">
              <img 
                src="/og-image.png" 
                alt="Dayledge Dashboard Preview" 
                className="w-full rounded-2xl border border-white/15 shadow-2xl hover:scale-105 transition-transform" 
              />
            </div>
          </div>
        </div>

        {/* Testimonial Quote */}
        <div className="max-w-xl mx-auto text-center border-t border-white/10 pt-10 pb-6">
          <p className="text-sm md:text-base italic text-neutral-300 font-medium mb-3">
            "Discipline is choosing between what you want now and what you want most."
          </p>
          <span className="text-xs font-bold text-[#26bba3] uppercase tracking-wider">— Dayledge Life OS</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-6 text-center text-xs text-neutral-500">
        <p>© 2026 Dayledge Life OS. Built for financial discipline & habit mastery.</p>
      </footer>
    </div>
  );
}
