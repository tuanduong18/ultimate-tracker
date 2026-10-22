'use client';

import { useCallback } from 'react';

import { ExpenseSection } from '@/components/finance/expense-section';
import { useExpensesChanged } from '@/lib/finance-events';
import { useCollection } from '@/lib/hooks/use-collection';
import { useFinanceBasics } from '@/lib/hooks/use-finance-basics';
import type { Expense } from '@/lib/types/finance';

/**
 * The Transactions tab: every expense, newest first.
 *
 * Nothing on this page is an aggregate, so its own writes leave nothing else
 * stale; an expense added from the header does, and is picked up here.
 */
export function AllExpenses() {
  const expenses = useCollection<Expense>('/finance/expenses');
  const { categories, currencies } = useFinanceBasics();

  useExpensesChanged(expenses.reload);
  const onChange = useCallback(() => {}, []);

  return (
    <ExpenseSection
      expenses={expenses}
      categories={categories.items}
      currencies={currencies}
      onChange={onChange}
      title="All expenses"
    />
  );
}
