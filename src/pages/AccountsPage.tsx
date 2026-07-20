import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Account, type Expense } from '../db/db';
import { Card } from '../components/Card';
import { 
  Plus, X, ArrowLeftRight, ArrowUpRight, ArrowDownRight, 
  Trash2, Edit2, Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { ACCOUNT_ICONS, AccountIconHelper } from '../utils/icons';

export function AccountsPage() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray()) || [];

  // Transfer Funds States
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [fromAccount, setFromAccount] = useState('axis');
  const [toAccount, setToAccount] = useState('hdfc');

  // Deletion confirmation states for transactions
  const [deleteTxConfirmId, setDeleteTxConfirmId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  
  // Selected Account for Transaction filtering
  const [selectedAccId, setSelectedAccId] = useState<string | null>(null);

  // Configure Accounts Panel States
  const [showConfig, setShowConfig] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null); // account ID if editing
  const [accName, setAccName] = useState('');
  const [accBalance, setAccBalance] = useState('');
  const [accIcon, setAccIcon] = useState('bank');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccount || !toAccount || !transferAmount || fromAccount === toAccount) return;

    const amountNum = Math.abs(Number(transferAmount));
    if (isNaN(amountNum) || amountNum <= 0) return;

    const source = await db.accounts.get(fromAccount);
    const destination = await db.accounts.get(toAccount);

    if (!source || !destination) return;

    if (source.balance < amountNum) {
      if (!confirm(`Warning: Source account has insufficient balance (₹${source.balance}). Proceed anyway?`)) {
        return;
      }
    }

    // Update balances
    source.balance -= amountNum;
    destination.balance += amountNum;

    await db.accounts.put(source);
    await db.accounts.put(destination);

    // Log the transaction
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const timeStr = format(now, 'HH:mm');

    const transferTx: Expense = {
      id: crypto.randomUUID(),
      amount: amountNum,
      category: 'Other',
      account: fromAccount,
      paymentType: fromAccount === 'cash' ? 'Cash' : 'UPI',
      description: `Transfer to ${destination.name} ${notes ? `(${notes})` : ''}`,
      date: todayStr,
      time: timeStr
    };

    const receiveTx: Expense = {
      id: crypto.randomUUID(),
      amount: amountNum,
      category: 'Income',
      account: toAccount,
      paymentType: toAccount === 'cash' ? 'Cash' : 'UPI',
      description: `Transfer from ${source.name} ${notes ? `(${notes})` : ''}`,
      date: todayStr,
      time: timeStr
    };

    await db.expenses.add(transferTx);
    await db.expenses.add(receiveTx);

    // Reset Form
    setTransferAmount('');
    setNotes('');
    setFromAccount('');
    setToAccount('');
    setShowTransfer(false);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim() || !accBalance) return;

    const balanceNum = Number(accBalance);
    if (isNaN(balanceNum)) return;

    if (isEditing) {
      // Edit mode
      const acc = await db.accounts.get(isEditing);
      if (acc) {
        const diff = balanceNum - acc.openingBalance;
        acc.name = accName.trim();
        acc.openingBalance = balanceNum;
        acc.balance += diff; // adjust current balance by opening balance delta
        acc.icon = accIcon;
        await db.accounts.put(acc);
      }
      setIsEditing(null);
    } else {
      // Add mode
      const newId = crypto.randomUUID();
      const newAcc: Account = {
        id: newId,
        name: accName.trim(),
        openingBalance: balanceNum,
        balance: balanceNum,
        icon: accIcon
      };
      await db.accounts.add(newAcc);
    }

    // Reset Form
    setAccName('');
    setAccBalance('');
    setAccIcon('bank');
  };

  const handleStartEdit = (acc: Account) => {
    setIsEditing(acc.id);
    setAccName(acc.name);
    setAccBalance(acc.openingBalance.toString());
    setAccIcon(acc.icon || 'bank');
  };

  const handleDeleteAccount = async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => {
        setDeleteConfirmId(prev => prev === id ? null : prev);
      }, 3000);
      return;
    }

    try {
      await db.accounts.delete(id);
      // Remove all expenses tied to this account
      const relatedExpenses = expenses.filter(e => e.account === id);
      for (const e of relatedExpenses) {
        if (e.id) await db.expenses.delete(e.id);
      }
      if (selectedAccId === id) setSelectedAccId(null);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Failed to delete account:", err);
    }
  };

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

  // Get filtered transactions for selected account
  const activeAccount = accounts.find(a => a.id === selectedAccId);
  const accountExpenses = selectedAccId 
    ? expenses.filter(e => e.account === selectedAccId)
    : expenses;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-neutral-100 dark:border-neutral-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Accounts</h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            Manage assets, opening balances, and perform local transfers between accounts.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (accounts.length >= 2) {
                setFromAccount(accounts[0].id);
                setToAccount(accounts[1].id);
              }
              setShowTransfer(true);
            }}
            className="flex items-center gap-1.5 bg-apple-blue text-white hover:scale-[1.01] active:scale-[0.99] px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-apple-blue/15 transition-transform"
          >
            <ArrowLeftRight className="w-4 h-4" /> Transfer Funds
          </button>
          
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Settings className="w-4 h-4 animate-spin-slow" /> {showConfig ? 'Hide Settings' : 'Configure Accounts'}
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <Card className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 p-5 rounded-2xl animate-fade-in">
          <h2 className="text-sm font-extrabold text-neutral-900 dark:text-white mb-4 uppercase tracking-wide">
            {isEditing ? 'Edit Account' : 'Add New Account'}
          </h2>
          <form onSubmit={handleSaveAccount} className="flex flex-col gap-4 mb-5 pb-5 border-b border-neutral-150 dark:border-neutral-850">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. ICICI Savings, Cash Wallet..."
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs mt-1 focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">
                  {isEditing ? 'Opening Balance (₹)' : 'Initial Balance (₹)'}
                </label>
                <input
                  type="number"
                  placeholder="e.g. 25000"
                  value={accBalance}
                  onChange={(e) => setAccBalance(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs mt-1 focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                  required
                />
              </div>
            </div>

            {/* Account Icon Picker */}
            <div>
              <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block mb-2">Select Account Icon</label>
              <div className="flex flex-wrap gap-2 p-1.5 bg-neutral-50 dark:bg-neutral-950/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
                {Object.keys(ACCOUNT_ICONS).map(iconName => {
                  const Icon = ACCOUNT_ICONS[iconName];
                  const isSelected = accIcon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setAccIcon(iconName)}
                      className={`p-2.5 rounded-lg border transition-all ${
                        isSelected 
                          ? 'bg-apple-blue border-apple-blue text-white shadow-sm scale-105' 
                          : 'bg-white border-neutral-200 hover:bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-400'
                      }`}
                      title={iconName}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-apple-blue text-white hover:scale-[1.01] active:scale-[0.99] px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-apple-blue/15"
              >
                {isEditing ? 'Save Changes' : 'Create Account'}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(null);
                    setAccName('');
                    setAccBalance('');
                    setAccIcon('bank');
                  }}
                  className="bg-neutral-250 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-750 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* Manage Accounts List */}
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
            {accounts.map(acc => (
              <div key={acc.id} className="flex justify-between items-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-4 py-3 rounded-xl text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-300">
                    <AccountIconHelper iconName={acc.icon} className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-850 dark:text-neutral-200 block">{acc.name}</span>
                    <span className="text-[10px] text-neutral-450">Current Balance: ₹{acc.balance.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartEdit(acc)}
                    className="p-1.5 text-neutral-450 hover:text-apple-blue transition-colors"
                    title="Edit Account"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {deleteConfirmId === acc.id ? (
                    <button
                      onClick={() => handleDeleteAccount(acc.id)}
                      className="bg-apple-red text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm shadow-apple-red/15 hover:bg-red-650 transition-all animate-pulse-slow"
                    >
                      Delete?
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleDeleteAccount(acc.id)}
                      className="p-1.5 text-neutral-455 hover:text-apple-red transition-colors animate-fade-in"
                      title="Delete Account"
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

      {/* Accounts List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {accounts.map(acc => {
          const isSelected = selectedAccId === acc.id;
          return (
            <Card
              key={acc.id}
              onClick={() => setSelectedAccId(isSelected ? null : acc.id)}
              className={`cursor-pointer transition-all ${
                isSelected 
                  ? 'ring-2 ring-apple-blue shadow-md' 
                  : 'bg-white/60 dark:bg-neutral-900/20'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-850 text-neutral-750 dark:text-neutral-200">
                  <AccountIconHelper iconName={acc.icon} className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-550 font-bold uppercase tracking-wider block">Opening</span>
                  <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">₹{acc.openingBalance.toLocaleString()}</span>
                </div>
              </div>

              <div className="mt-6">
                <span className="text-xs text-neutral-450 dark:text-neutral-500 block">Available Balance</span>
                <span className="text-xl font-black text-neutral-900 dark:text-white mt-1 block">
                  ₹{acc.balance.toLocaleString()}
                </span>
              </div>
              
              <div className="mt-3 flex justify-between items-center text-[10px] text-neutral-400 dark:text-neutral-500">
                <span>Account: {acc.name}</span>
                <span className="underline hover:text-neutral-700 dark:hover:text-neutral-300">
                  {isSelected ? 'Show All History' : 'Show Account History'}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Account Transactions Ledger */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 bg-white/40 dark:bg-neutral-950/20">
        <h2 className="text-md font-bold text-neutral-900 dark:text-white mb-4">
          {activeAccount ? `${activeAccount.name} Transaction History` : 'All Transactions History'}
        </h2>
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-2 no-scrollbar">
          {accountExpenses.map(tx => {
            const isCredit = tx.category === 'Income';
            return (
              <div key={tx.id} className="flex justify-between items-center bg-white/70 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-900/60 px-4 py-3 rounded-2xl text-xs animate-fade-in">
                <div>
                  <div className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                    {tx.description}
                    <span className="text-[9px] font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                      {tx.category}
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">
                    {tx.date} • {tx.time} via {tx.paymentType}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold text-sm ${isCredit ? 'text-emerald-500' : 'text-neutral-900 dark:text-white'}`}>
                    {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString()}
                  </span>
                  {deleteTxConfirmId === tx.id ? (
                    <button
                      onClick={() => handleDeleteTx(tx)}
                      className="bg-apple-red text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-sm hover:bg-red-650 transition-all animate-pulse-slow"
                    >
                      Delete?
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDeleteTx(tx)}
                      className="p-1 text-neutral-450 hover:text-apple-red transition-colors"
                      title="Delete Transaction"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {accountExpenses.length === 0 && (
            <div className="text-center py-10 text-xs text-neutral-450 italic">
              No transactions logged for this account.
            </div>
          )}
        </div>
      </div>

      {/* Transfer Funds Modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setShowTransfer(false)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Transfer Money</h2>
            
            <form onSubmit={handleTransfer} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">From Account</label>
                  <select
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue text-neutral-900 dark:text-white"
                    required
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">To Account</label>
                  <select
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue text-neutral-900 dark:text-white"
                    required
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Amount (₹)</label>
                <input 
                  type="number" 
                  placeholder="Amount to transfer" 
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Remarks / Notes</label>
                <input 
                  type="text" 
                  placeholder="Optional notes e.g., Monthly savings" 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-1 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue text-neutral-900 dark:text-white"
                />
              </div>

              {fromAccount === toAccount && (
                <p className="text-xs text-apple-red font-medium">Source and destination accounts must be different.</p>
              )}

              <button
                type="submit"
                disabled={fromAccount === toAccount}
                className="w-full bg-apple-blue text-white py-3 rounded-xl text-sm font-bold mt-2 shadow-md shadow-apple-blue/15 hover:bg-apple-blue/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                Execute Transfer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
