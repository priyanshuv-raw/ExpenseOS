import { db, type Expense, type FixedExpense } from './db';
import { differenceInMonths, parse, format, addMonths } from 'date-fns';

/**
 * Runs on app startup. Checks if there are auto-generate fixed expenses
 * that need to be created for the months between lastGeneratedMonth and currentMonth.
 */
export async function runFixedExpensesEngine() {
  const fixedExpenses = await db.fixedExpenses.filter(f => f.autoGenerate === true).toArray();
  if (fixedExpenses.length === 0) return;

  const today = new Date();
  const currentMonthStr = format(today, 'yyyy-MM'); // e.g. "2026-07"

  for (const item of fixedExpenses) {
    let lastMonth = item.lastGeneratedMonth; // e.g. "2026-07"
    
    // If it's already generated for the current month (or future), skip
    if (lastMonth >= currentMonthStr) continue;

    // Parse the last month and current month to find difference
    const lastDate = parse(lastMonth + '-01', 'yyyy-MM-dd', new Date());
    const currentDate = parse(currentMonthStr + '-01', 'yyyy-MM-dd', new Date());
    
    const monthsToGenerate = differenceInMonths(currentDate, lastDate);
    if (monthsToGenerate <= 0) continue;

    let tempMonth = lastDate;
    
    // Generate expenses for each missing month
    for (let i = 0; i < monthsToGenerate; i++) {
      tempMonth = addMonths(tempMonth, 1);
      const targetMonthStr = format(tempMonth, 'yyyy-MM');
      const targetYear = format(tempMonth, 'yyyy');
      const targetMonthName = format(tempMonth, 'MMMM');
      
      // Determine day formatting
      const dayStr = item.dueDate < 10 ? '0' + item.dueDate : '' + item.dueDate;
      const expenseDate = `${targetMonthStr}-${dayStr}`;

      // Default transaction details based on seed name
      let accountId = 'axis';
      let paymentType: 'Cash' | 'UPI' | 'Credit Card' | 'Debit Card' = 'UPI';
      
      if (item.name.toLowerCase().includes('salary')) {
        accountId = 'hdfc';
        paymentType = 'UPI';
      } else if (item.name.toLowerCase().includes('netflix')) {
        accountId = 'hdfc';
        paymentType = 'Credit Card';
      } else if (item.name.toLowerCase().includes('mobile')) {
        accountId = 'wallet';
        paymentType = 'UPI';
      } else if (item.name.toLowerCase().includes('broadband')) {
        accountId = 'axis';
        paymentType = 'UPI';
      } else if (item.name.toLowerCase().includes('rent')) {
        accountId = 'axis';
        paymentType = 'UPI';
      }

      // Generate the Expense entry
      const newExpense: Expense = {
        id: crypto.randomUUID(),
        amount: item.amount,
        category: item.category as any,
        account: accountId,
        paymentType: paymentType,
        description: `${item.name} (${targetMonthName} ${targetYear})`,
        date: expenseDate,
        time: '09:00'
      };

      // Add to expenses table
      await db.expenses.add(newExpense);

      // Update account balance
      const accountObj = await db.accounts.get(accountId);
      if (accountObj) {
        if (item.category === 'Income') {
          accountObj.balance += item.amount;
        } else {
          accountObj.balance -= item.amount;
        }
        await db.accounts.put(accountObj);
      }

      // Update outstanding card balance if paid via credit card
      if (paymentType === 'Credit Card') {
        const creditCardName = accountId === 'hdfc' ? 'HDFC Regalia Card' : 'Axis Credit Card';
        const cardObj = await db.outstanding.filter(o => o.name.includes(creditCardName) || o.type === 'Credit Card').first();
        if (cardObj) {
          cardObj.outstandingAmount += item.amount;
          await db.outstanding.put(cardObj);
        }
      }
    }

    // Update the lastGeneratedMonth on the FixedExpense item
    item.lastGeneratedMonth = currentMonthStr;
    await db.fixedExpenses.put(item);
  }
}
