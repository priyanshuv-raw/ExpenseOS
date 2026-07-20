import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Expense, type JournalEntry } from '../db/db';
import { Card } from '../components/Card';
import { Search, Calendar, FileText, Receipt, ArrowRight, X, Image as ImageIcon, ChevronRight, Trash2 } from 'lucide-react';
import { DailyPage } from './DailyPage';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'expenses' | 'journals'>('all');
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);
  
  // Receipt popup state
  const [activeReceiptSrc, setActiveReceiptSrc] = useState<string | null>(null);

  // Fetch all databases
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const journals = useLiveQuery(() => db.journal.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  // Transaction deletion confirmations
  const [deleteTxConfirmId, setDeleteTxConfirmId] = useState<string | null>(null);

  const handleDeleteTx = async (tx: Expense) => {
    if (deleteTxConfirmId !== tx.id) {
      setDeleteTxConfirmId(tx.id);
      setTimeout(() => {
        setDeleteTxConfirmId(prev => prev === tx.id ? null : prev);
      }, 3000);
      return;
    }

    try {
      await db.expenses.delete(tx.id);

      // Restore Account balance
      const account = await db.accounts.get(tx.account);
      if (account) {
        if (tx.category === 'Income') {
          account.balance -= tx.amount;
        } else {
          account.balance += tx.amount;
        }
        await db.accounts.put(account);
      }

      // Adjust Credit Card outstanding if needed
      const isCreditCard = tx.paymentType === 'Credit Card' || account?.name.toLowerCase().includes('card') || account?.icon === 'card';
      if (isCreditCard && tx.category !== 'Income') {
        const activeCard = await db.outstanding.filter(o => o.type === 'Credit Card').first();
        if (activeCard) {
          activeCard.outstandingAmount = Math.max(0, activeCard.outstandingAmount - tx.amount);
          await db.outstanding.put(activeCard);
        }
      }

      setDeleteTxConfirmId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter lists based on query
  const getFilteredResults = () => {
    const q = query.toLowerCase().trim();

    // 1. Expenses matching
    const filteredExpenses = expenses.filter(e => {
      const accName = accounts.find(a => a.id === e.account)?.name || '';
      return (
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.date.toLowerCase().includes(q) ||
        e.paymentType.toLowerCase().includes(q) ||
        accName.toLowerCase().includes(q)
      );
    });

    // 2. Journals matching
    const filteredJournals = journals.filter(j => {
      return (
        j.content.toLowerCase().includes(q) ||
        j.mood.toLowerCase().includes(q) ||
        j.date.toLowerCase().includes(q) ||
        (j.sleepTime || '').toLowerCase().includes(q)
      );
    });

    // Merge into chronological feed
    const results: ({ type: 'expense'; date: string; data: Expense } | { type: 'journal'; date: string; data: JournalEntry })[] = [];

    if (filter === 'all' || filter === 'expenses') {
      filteredExpenses.forEach(exp => results.push({ type: 'expense', date: exp.date, data: exp }));
    }
    if (filter === 'all' || filter === 'journals') {
      filteredJournals.forEach(j => results.push({ type: 'journal', date: j.date, data: j }));
    }

    // Sort descending chronologically
    return results.sort((a, b) => b.date.localeCompare(a.date));
  };

  const results = getFilteredResults();

  return (
    <div className="space-y-6">
      <div className="border-b border-neutral-100 dark:border-neutral-900 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Global Search</h1>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
          Spotlight search across journals, expense categories, transactions, dates, and accounts.
        </p>
      </div>

      {/* Spotlight Search input */}
      <div className="relative">
        <Search className="absolute left-4.5 top-3.5 w-5 h-5 text-neutral-400" />
        <input
          type="text"
          placeholder="Search descriptions, content, dates (YYYY-MM-DD), mood emojis..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-white dark:bg-neutral-900/60 apple-border pl-12 pr-6 py-4 rounded-2xl text-md focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white apple-shadow"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'expenses', 'journals'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
              filter === tab
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-transparent shadow-sm'
                : 'bg-white text-neutral-500 hover:text-neutral-900 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-neutral-850'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Results timeline */}
      <div className="relative border-l border-neutral-150 dark:border-neutral-850 pl-5 ml-2.5 space-y-4">
        {results.map((item, idx) => {
          if (item.type === 'expense') {
            const exp = item.data;
            const accName = accounts.find(a => a.id === exp.account)?.name || 'Account';
            const isCredit = exp.category === 'Income';

            return (
              <div key={`exp-${exp.id}`} className="relative group">
                {/* Timeline node */}
                <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-neutral-200 border-2 border-white dark:border-neutral-950 dark:bg-neutral-800" />

                <Card className="p-4 flex justify-between items-center bg-white/60 dark:bg-neutral-900/10">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-350">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-neutral-850 dark:text-white flex items-center gap-1.5">
                        {exp.description}
                        <span className="text-[9px] font-bold text-neutral-400 bg-neutral-50 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                          {exp.category}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-1">
                        {exp.date} • {exp.time} • paid via {exp.paymentType} ({accName})
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {exp.receiptImage && (
                      <button
                        onClick={() => setActiveReceiptSrc(exp.receiptImage!)}
                        className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-450 hover:text-neutral-700"
                        title="View Receipt"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    )}
                    <span className={`font-black text-sm ${isCredit ? 'text-emerald-500' : 'text-neutral-900 dark:text-white'}`}>
                      {isCredit ? '+' : '-'}₹{exp.amount.toLocaleString()}
                    </span>
                    {deleteTxConfirmId === exp.id ? (
                      <button
                        onClick={() => handleDeleteTx(exp)}
                        className="bg-apple-red text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-sm hover:bg-red-650 transition-all animate-pulse-slow"
                      >
                        Delete?
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeleteTx(exp)}
                        className="p-1 text-neutral-450 hover:text-apple-red transition-colors"
                        title="Delete Transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </Card>
              </div>
            );
          } else {
            const journal = item.data;
            return (
              <div key={`journal-${journal.date}`} className="relative group">
                {/* Timeline node */}
                <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-neutral-950 dark:bg-white border-2 border-white dark:border-neutral-950" />

                <Card 
                  onClick={() => setSelectedDayStr(journal.date)}
                  className="p-4 bg-white/60 dark:bg-neutral-900/10 cursor-pointer flex justify-between items-start"
                >
                  <div className="flex items-start gap-3 w-full">
                    <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-350">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-xs text-neutral-850 dark:text-white flex items-center gap-2">
                        Journal Log
                        {journal.mood && <span className="text-sm leading-none">{journal.mood}</span>}
                        <span className="text-[9px] font-bold text-neutral-400 bg-neutral-50 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                          Bedtime: {journal.sleepTime || '23:00'}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-1">
                        {journal.date} • Sleep: {journal.sleepTime || '23:00'} to {journal.wakeTime} ({journal.sleepHours} hrs)
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-2.5 line-clamp-2 leading-relaxed">
                        {journal.content}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400 mt-1 self-center" />
                </Card>
              </div>
            );
          }
        })}

        {results.length === 0 && (
          <div className="text-center py-10 text-xs text-neutral-400 italic">
            No entries matching "{query}" found in data stores.
          </div>
        )}
      </div>

      {/* Selected day journal details */}
      {selectedDayStr && (
        <DailyPage dateStr={selectedDayStr} onClose={() => setSelectedDayStr(null)} />
      )}

      {/* Receipt Image Popup Modal */}
      {activeReceiptSrc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setActiveReceiptSrc(null)}>
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-3 rounded-2xl max-w-lg w-full relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setActiveReceiptSrc(null)}
              className="absolute top-4 right-4 bg-black/40 text-white rounded-full p-1 hover:bg-black/60"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={activeReceiptSrc} alt="Receipt Attachment" className="w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
