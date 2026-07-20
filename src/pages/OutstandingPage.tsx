import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type OutstandingDebt } from '../db/db';
import { Card } from '../components/Card';
import { Plus, X, Landmark, AlertTriangle, CheckCircle, HandMetal, CreditCard, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export function OutstandingPage() {
  const outstandingList = useLiveQuery(() => db.outstanding.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  // Add Liability States
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<OutstandingDebt['type']>('Credit Card');
  const [amount, setAmount] = useState('');
  const [interest, setInterest] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [minDue, setMinDue] = useState('');

  // Pay Liability States
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payAccountId, setPayAccountId] = useState('hdfc');

  // Edit / Delete / Direction Liability States
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [cardLimit, setCardLimit] = useState('100000');
  const [direction, setDirection] = useState<'borrowed' | 'lent'>('borrowed');

  // Calculations
  const activeDebts = outstandingList.filter(d => d.status === 'active' && (d.direction || 'borrowed') === 'borrowed');
  const totalOutstanding = activeDebts.reduce((sum, d) => sum + d.outstandingAmount, 0);

  const activeReceivables = outstandingList.filter(d => d.status === 'active' && d.direction === 'lent');
  const totalReceivables = activeReceivables.reduce((sum, d) => sum + d.outstandingAmount, 0);

  // CC Limit is calculated dynamically by summing up individual cardLimits (fallback to 100,000 if not set)
  const ccDebts = activeDebts.filter(d => d.type === 'Credit Card');
  const ccTotalOutstanding = ccDebts.reduce((sum, d) => sum + d.outstandingAmount, 0);
  const ccTotalLimit = ccDebts.reduce((sum, d) => sum + (d.cardLimit || 100000), 0) || 100000;
  const ccUtilization = ccTotalLimit > 0 ? Math.round((ccTotalOutstanding / ccTotalLimit) * 100) : 0;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;

    const newDebt: OutstandingDebt = {
      id: crypto.randomUUID(),
      name,
      type,
      outstandingAmount: Number(amount),
      interest: Number(interest) || 0,
      dueDate: dueDate || format(new Date(), 'yyyy-MM-dd'),
      minimumDue: Number(minDue) || 0,
      status: 'active',
      paymentHistory: [],
      cardLimit: type === 'Credit Card' ? (Number(cardLimit) || 100000) : undefined,
      direction: direction
    };

    await db.outstanding.add(newDebt);

    // Reset Form
    setName('');
    setAmount('');
    setInterest('');
    setDueDate('');
    setMinDue('');
    setCardLimit('100000');
    setDirection('borrowed');
    setShowAddForm(false);
  };

  const handleStartEdit = (debt: OutstandingDebt) => {
    setEditingDebtId(debt.id);
    setName(debt.name);
    setType(debt.type);
    setAmount(debt.outstandingAmount.toString());
    setInterest(debt.interest.toString());
    setDueDate(debt.dueDate);
    setMinDue(debt.minimumDue.toString());
    setCardLimit(debt.cardLimit?.toString() || '100000');
    setDirection(debt.direction || 'borrowed');
    setShowAddForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebtId || !name || !amount) return;

    const debt = await db.outstanding.get(editingDebtId);
    if (!debt) return;

    const updated: OutstandingDebt = {
      ...debt,
      name,
      type,
      outstandingAmount: Number(amount),
      interest: Number(interest) || 0,
      dueDate: dueDate || format(new Date(), 'yyyy-MM-dd'),
      minimumDue: Number(minDue) || 0,
      cardLimit: type === 'Credit Card' ? (Number(cardLimit) || 100000) : undefined,
      direction: direction
    };

    await db.outstanding.put(updated);
    
    // Reset Form
    setEditingDebtId(null);
    setName('');
    setAmount('');
    setInterest('');
    setDueDate('');
    setMinDue('');
    setCardLimit('100000');
    setDirection('borrowed');
    setShowAddForm(false);
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => {
        setDeleteConfirmId(prev => prev === id ? null : prev);
      }, 3000);
      return;
    }

    try {
      await db.outstanding.delete(id);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Failed to delete liability:", err);
    }
  };

  const handleCloseModal = () => {
    setEditingDebtId(null);
    setName('');
    setAmount('');
    setInterest('');
    setDueDate('');
    setMinDue('');
    setCardLimit('100000');
    setDirection('borrowed');
    setShowAddForm(false);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtId || !payAmount || isNaN(Number(payAmount))) return;

    const amt = Number(payAmount);
    const debt = await db.outstanding.get(selectedDebtId);
    const payAccountObj = await db.accounts.get(payAccountId);

    if (!debt || !payAccountObj || amt <= 0) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isLent = debt.direction === 'lent';

    // Update bank account balance based on borrowing direction
    if (isLent) {
      // They paid us back, bank account increases!
      payAccountObj.balance += amt;
    } else {
      // We paid them back, bank account decreases!
      payAccountObj.balance -= amt;
    }
    await db.accounts.put(payAccountObj);

    // Deduct from debt outstanding
    debt.outstandingAmount = Math.max(0, debt.outstandingAmount - amt);
    
    // Add payment history entry
    debt.paymentHistory.push({
      date: todayStr,
      amount: amt
    });

    if (debt.outstandingAmount === 0) {
      debt.status = 'paid';
    }

    await db.outstanding.put(debt);

    // Log the transaction in expenses
    const selectedAcc = accounts.find(a => a.id === payAccountId);
    const resolvedPaymentType = selectedAcc ? selectedAcc.name : 'Unknown';

    await db.expenses.add({
      id: crypto.randomUUID(),
      amount: amt,
      category: isLent ? 'Income' : 'Bills',
      account: payAccountId,
      paymentType: resolvedPaymentType,
      description: isLent ? `Repayment received: ${debt.name}` : `Debt payment: ${debt.name}`,
      date: todayStr,
      time: format(new Date(), 'HH:mm')
    });

    // Reset Form
    setPayAmount('');
    setSelectedDebtId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-neutral-100 dark:border-neutral-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Outstanding Debts/Receivables</h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            Track credit card balances, personal loans, and liabilities.
          </p>
        </div>

        <button
          onClick={() => { setEditingDebtId(null); setShowAddForm(true); }}
          className="flex items-center gap-1.5 bg-black text-white dark:bg-white dark:text-black hover:scale-[1.01] active:scale-[0.99] px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-transform"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Debt Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest block">Total Outstanding (Owed)</span>
            <span className="text-3xl font-black text-red-500 dark:text-red-400 mt-2 block">
              ₹{totalOutstanding.toLocaleString()}
            </span>
          </div>
          <div className="mt-4 flex gap-2 text-[10px] text-neutral-450 dark:text-neutral-500 leading-relaxed items-center border-t border-neutral-100 dark:border-neutral-900 pt-3">
            <AlertTriangle className="w-3.5 h-3.5 text-neutral-500" />
            <span>Includes {activeDebts.length} active liabilities you owe to others.</span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest block">Total Receivables (Lent)</span>
            <span className="text-3xl font-black text-emerald-500 dark:text-emerald-405 mt-2 block">
              ₹{totalReceivables.toLocaleString()}
            </span>
          </div>
          <div className="mt-4 flex gap-2 text-[10px] text-neutral-450 dark:text-neutral-500 leading-relaxed items-center border-t border-neutral-100 dark:border-neutral-900 pt-3">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 animate-pulse-slow" />
            <span>Includes {activeReceivables.length} pending loans others owe you.</span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-neutral-450 dark:text-neutral-500 font-bold uppercase tracking-widest block">Credit Card Utilization</span>
                <span className="text-3xl font-black text-neutral-900 dark:text-white mt-2 block">
                  {ccUtilization}%
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.75 rounded-md ${
                ccUtilization > 50 ? 'bg-red-55/10 text-red-550 dark:bg-red-950/20 dark:text-red-400' : 'bg-neutral-100 dark:bg-neutral-850 text-neutral-700 dark:text-neutral-300'
              }`}>
                {ccUtilization > 50 ? 'High' : 'Healthy'}
              </span>
            </div>
          </div>
          <div className="w-full bg-neutral-105 dark:bg-neutral-850 h-1.5 rounded-full overflow-hidden mt-4">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${ccUtilization > 50 ? 'bg-red-500' : 'bg-neutral-900 dark:bg-white'}`}
              style={{ width: `${Math.min(100, ccUtilization)}%` }}
            />
          </div>
          <span className="text-[9px] text-neutral-450 dark:text-neutral-550 font-semibold block mt-2">
            CC debt: ₹{ccTotalOutstanding.toLocaleString()} / Limit: ₹{ccTotalLimit.toLocaleString()}
          </span>
        </Card>
      </div>

      {/* Liabilities Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {outstandingList.map(debt => (
          <Card
            key={debt.id}
            className={`flex flex-col justify-between min-h-[160px] transition-all ${
              debt.status === 'paid' ? 'opacity-50' : ''
            } ${
              (debt.direction || 'borrowed') === 'lent'
                ? 'border-emerald-400/60 dark:border-emerald-600/40 ring-1 ring-emerald-400/20 dark:ring-emerald-600/20'
                : ''
            }`}
          >
            <div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider bg-neutral-100 dark:bg-neutral-850 px-2 py-0.75 rounded-md">
                    {debt.type}
                  </span>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                    (debt.direction || 'borrowed') === 'lent' 
                      ? 'bg-emerald-50 text-emerald-650 dark:bg-emerald-950/40 dark:text-emerald-400' 
                      : 'bg-red-50 text-red-650 dark:bg-red-950/40 dark:text-red-400'
                  }`}>
                    {(debt.direction || 'borrowed') === 'lent' ? 'Receivable' : 'Liability'}
                  </span>
                  {debt.status === 'paid' && (
                    <span className="text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Paid
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleStartEdit(debt)}
                    className="p-1 text-neutral-450 hover:text-apple-blue transition-colors"
                    title="Edit Debt"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {deleteConfirmId === debt.id ? (
                    <button
                      onClick={() => handleDelete(debt.id)}
                      className="bg-apple-red text-white px-2 py-0.5 rounded text-[9px] font-bold shadow-sm hover:bg-red-650 transition-all animate-pulse-slow"
                    >
                      Delete?
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDelete(debt.id)}
                      className="p-1 text-neutral-450 hover:text-apple-red transition-colors"
                      title="Delete Debt"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="text-md font-bold text-neutral-800 dark:text-white mt-2.5">{debt.name}</h3>

              <div className="text-[11px] text-neutral-455 dark:text-neutral-500 mt-1 flex flex-col gap-0.5">
                <span>Due Date: {debt.dueDate}</span>
                {debt.minimumDue > 0 && <span>Minimum Due: ₹{debt.minimumDue.toLocaleString()}</span>}
                {debt.status === 'active' && debt.type === 'Credit Card' && <span>Limit: ₹{(debt.cardLimit || 100000).toLocaleString()}</span>}
                {debt.status === 'active' && debt.interest > 0 && <span>Interest: {debt.interest}% p.a.</span>}
              </div>
            </div>

            <div className="border-t border-neutral-100 dark:border-neutral-900 pt-3 mt-4 flex justify-between items-center">
              <div>
                <span className="text-[9px] text-neutral-400 dark:text-neutral-500 block uppercase font-bold">
                  {(debt.direction || 'borrowed') === 'lent' ? 'Receivable' : 'Outstanding'}
                </span>
                <span className={`text-md font-extrabold ${
                  (debt.direction || 'borrowed') === 'lent'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-neutral-900 dark:text-white'
                }`}>
                  ₹{debt.outstandingAmount.toLocaleString()}
                </span>
              </div>
              
              {debt.status === 'active' && (
                <button
                  onClick={() => setSelectedDebtId(debt.id)}
                  className={`text-white hover:scale-[1.02] active:scale-[0.98] px-3.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition-transform ${
                    debt.direction === 'lent'
                      ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                      : 'bg-apple-blue shadow-apple-blue/10'
                  }`}
                >
                  {debt.direction === 'lent' ? 'Got It' : 'Pay Debt'}
                </button>
              )}
            </div>
          </Card>
        ))}

        {outstandingList.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-neutral-200 dark:border-neutral-850 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-2">
            <CreditCard className="w-8 h-8 text-neutral-400" />
            <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">No liabilities found</p>
            <p className="text-xs text-neutral-400">You are completely debt free! Log credit cards or loans to keep tabs on due dates.</p>
          </div>
        )}
      </div>

      {/* Add Liability Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
             <button 
               onClick={handleCloseModal}
               className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
             >
               <X className="w-5 h-5" />
             </button>
             <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">
               {editingDebtId ? 'Edit Debt / Liability' : 'Add Debt / Liability'}
             </h2>
             
             <form onSubmit={editingDebtId ? handleUpdate : handleAdd} className="flex flex-col gap-4">
               <div>
                 <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Direction</label>
                 <div className="flex bg-neutral-100 dark:bg-neutral-950 p-0.75 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs mt-1">
                   <button
                     type="button"
                     onClick={() => setDirection('borrowed')}
                     className={`flex-1 py-2 rounded-lg font-bold text-center transition-all ${
                       direction === 'borrowed' 
                         ? 'bg-white dark:bg-neutral-850 text-neutral-950 dark:text-white shadow-sm' 
                         : 'text-neutral-550 dark:text-neutral-450 hover:text-neutral-850'
                     }`}
                   >
                     I Owe Them (Liability)
                   </button>
                   <button
                     type="button"
                     onClick={() => setDirection('lent')}
                     className={`flex-1 py-2 rounded-lg font-bold text-center transition-all ${
                       direction === 'lent' 
                         ? 'bg-white dark:bg-neutral-850 text-neutral-950 dark:text-white shadow-sm' 
                         : 'text-neutral-550 dark:text-neutral-450 hover:text-neutral-850'
                     }`}
                   >
                     They Owe Me (Receivable)
                   </button>
                 </div>
               </div>

               <div>
                 <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Liability Name / Friend Name</label>
                 <input 
                   type="text" 
                   placeholder="e.g. HDFC Regalia, Car Loan, Amit" 
                   value={name}
                   onChange={(e) => setName(e.target.value)}
                   className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                   required
                 />
               </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Debt Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-white dark:bg-neutral-950 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue text-neutral-900 dark:text-white"
                  >
                    <option value="Credit Card">Credit Card</option>
                    <option value="Loan">Loan</option>
                    <option value="Friend">Friend</option>
                    <option value="Family">Family</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Owed Amount (₹)</label>
                  <input 
                    type="number" 
                    placeholder="Amount Owed" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Interest Rate (% p.a.)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 8.5" 
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Minimum Due (₹)</label>
                  <input 
                    type="number" 
                    placeholder="Min payment due" 
                    value={minDue}
                    onChange={(e) => setMinDue(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Due Date</label>
                <input 
                  type="date" 
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                />
              </div>

              {type === 'Credit Card' && (
                <div>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Credit Card Limit (₹)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 150000" 
                    value={cardLimit}
                    onChange={(e) => setCardLimit(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-apple-blue text-white py-3 rounded-xl text-sm font-bold mt-2 shadow-md shadow-apple-blue/15 hover:bg-apple-blue/90 transition-colors"
              >
                {editingDebtId ? 'Update Liability' : 'Log Liability'}
              </button>
             </form>
           </div>
         </div>
       )}

       {/* Pay Debt Modal */}
       {selectedDebtId && (() => {
         const selectedDebtObj = outstandingList.find(d => d.id === selectedDebtId);
         const isLentMode = selectedDebtObj?.direction === 'lent';

        return (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-fade-in">
              <button 
                onClick={() => setSelectedDebtId(null)}
                className="absolute top-5 right-5 text-neutral-450 hover:text-neutral-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                {isLentMode ? 'Collect Repayment' : 'Log Debt Payment'}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-5">
                {isLentMode ? 'Record returned funds to increase your account balance.' : 'Make a payment to reduce your outstanding balance.'}
              </p>
              
              <form onSubmit={handlePayment} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                    {isLentMode ? 'Amount Received (₹)' : 'Amount to Pay (₹)'}
                  </label>
                  <input 
                    type="number" 
                    placeholder="e.g. 5000" 
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                    {isLentMode ? 'Deposit to Account' : 'Deduct From Account'}
                  </label>
                  <select
                    value={payAccountId}
                    onChange={(e) => setPayAccountId(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue text-neutral-900 dark:text-white"
                    required
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (Bal: ₹{acc.balance})</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-apple-blue text-white py-3 rounded-xl text-sm font-bold mt-2 shadow-md shadow-apple-blue/15 hover:bg-apple-blue/90 transition-colors"
                >
                  {isLentMode ? 'Confirm Receipt' : 'Log Payment'}
                </button>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
