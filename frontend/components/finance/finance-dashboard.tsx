'use client';

import { useCallback, useMemo } from 'react';

import { BudgetSection } from '@/components/finance/budget-section';
import { CategorySection } from '@/components/finance/category-section';
import { ExpenseSection } from '@/components/finance/expense-section';
import { SummaryTiles } from '@/components/finance/summary-tiles';
import { monthLabel, monthRange } from '@/lib/dates';
import { useCollection, useResource } from '@/lib/hooks/use-collection';
import type { Budget, Category, Expense, Summary } from '@/lib/types/finance';
import type { Profile } from '@/lib/types/profile';

/**
 * Owns every finance fetch on the page.
 *
 * The four collections live here rather than in the sections that render them
 * because they are not independent: the expense and budget forms pick from the
 * same categories, and deleting a category rewrites rows in both other lists.
 * Sections mutate and then say so; deciding what went stale is this component's
 * job, and having it in one place is what keeps the page honest after a write.
 */
export function FinanceDashboard() {
  // Fixed to the current month for now. Pinned on mount so a session left open
  // across midnight on the last of the month keeps showing one coherent window.
  const period = useMemo(() => {
    const now = new Date();
    return { ...monthRange(now), label: monthLabel(now) };
  }, []);

  const categories = useCollection<Category>('/finance/categories');
  const expenses = useCollection<Expense>('/finance/expenses');
  const budgets = useCollection<Budget>('/finance/budgets');
  const currencies = useCollection<string>('/finance/currencies');
  const profile = useResource<Profile>('/auth/me');
  const summary = useResource<Summary>(
    `/finance/summary?start_date=${period.start}&end_date=${period.end}`
  );

  const reloadExpenses = expenses.reload;
  const reloadBudgets = budgets.reload;
  const reloadSummary = summary.reload;

  /** An expense or budget changed: only the totals can be out of date. */
  const onMoneyChanged = useCallback(() => {
    void reloadSummary();
  }, [reloadSummary]);

  /**
   * A category changed. Deleting one sets its expenses' category_id to null and
   * drops it from every budget that covered it — both server-side, so both
   * lists have to come back from the API rather than be patched here.
   */
  const onCategoriesChanged = useCallback(() => {
    void reloadExpenses();
    void reloadBudgets();
    void reloadSummary();
  }, [reloadExpenses, reloadBudgets, reloadSummary]);

  // USD only until /auth/me lands; the picker on /profile is what changes it.
  const defaultCurrency = profile.data?.display_currency ?? 'USD';

  return (
    <>
      <SummaryTiles summary={summary} period={period.label} />

      <BudgetSection
        budgets={budgets}
        categories={categories.items}
        currencies={currencies.items}
        defaultCurrency={defaultCurrency}
        onChange={onMoneyChanged}
      />

      <ExpenseSection
        expenses={expenses}
        categories={categories.items}
        currencies={currencies.items}
        defaultCurrency={defaultCurrency}
        onChange={onMoneyChanged}
      />

      <CategorySection categories={categories} onChange={onCategoriesChanged} />
    </>
  );
}
