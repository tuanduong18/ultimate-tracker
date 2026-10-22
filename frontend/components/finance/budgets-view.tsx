'use client';

import { useCallback, useState } from 'react';

import { BudgetSection } from '@/components/finance/budget-section';
import { monthStart } from '@/lib/dates';
import { useExpensesChanged } from '@/lib/finance-events';
import { useCollection } from '@/lib/hooks/use-collection';
import { useFinanceBasics } from '@/lib/hooks/use-finance-basics';
import type { BudgetProgress } from '@/lib/types/finance';

/**
 * The Budgets tab: every budget for a month, with how much of each is spent.
 *
 * Spending is measured per month, so the month is part of the request — moving
 * it is a new fetch. An expense logged from the header moves a bar, so that
 * refetches too.
 */
export function BudgetsView() {
  const [month, setMonth] = useState(() => monthStart());
  const budgets = useCollection<BudgetProgress>(`/finance/budgets/progress?month=${month}`);
  const { categories, currencies, defaultCurrency } = useFinanceBasics();

  useExpensesChanged(budgets.reload);
  const onChange = useCallback(() => {}, []);

  return (
    <BudgetSection
      budgets={budgets}
      month={month}
      onMonthChange={setMonth}
      categories={categories.items}
      currencies={currencies}
      defaultCurrency={defaultCurrency}
      onChange={onChange}
    />
  );
}
