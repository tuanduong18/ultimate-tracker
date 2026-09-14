'use client';

import { useCallback, useMemo } from 'react';

import { BudgetSection } from '@/components/finance/budget-section';
import { CategorySection } from '@/components/finance/category-section';
import { ExpenseSection } from '@/components/finance/expense-section';
import { SpendByCategoryChart } from '@/components/finance/spend-by-category-chart';
import { SpendByWeekChart } from '@/components/finance/spend-by-week-chart';
import { monthLabel, monthRange } from '@/lib/dates';
import { useCollection, useResource } from '@/lib/hooks/use-collection';
import type {
  BudgetProgress,
  Category,
  CategoryBreakdown,
  Expense,
  WeeklyBreakdown,
} from '@/lib/types/finance';
import type { Profile } from '@/lib/types/profile';

/** The newest few, which is as many as the panel can show without scrolling far. */
const LATEST_EXPENSES = 10;

/**
 * Owns every finance fetch on the page, and lays the four panels out.
 *
 * The collections live here rather than in the panels that render them because
 * they are not independent: the expense and budget forms pick from the same
 * categories, logging an expense moves both charts and a budget bar, and
 * deleting a category rewrites rows in every other list. Panels mutate and then
 * say so; deciding what went stale is this component's job, and having that in
 * one place is what keeps the page honest after a write.
 *
 * Layout is two charts across the top and a 2-4-4 split beneath them —
 * categories, expenses, budgets.
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
  const currencies = useCollection<string>('/finance/currencies');
  const profile = useResource<Profile>('/auth/me');

  // Carries everything the plain budget list does plus what has been spent, so
  // the bars and the edit forms cannot disagree after a write.
  const budgets = useCollection<BudgetProgress>('/finance/budgets/progress');

  const range = `start_date=${period.start}&end_date=${period.end}`;
  const byCategory = useResource<CategoryBreakdown>(`/finance/summary/by-category?${range}`);
  const byWeek = useResource<WeeklyBreakdown>(`/finance/summary/by-week?${range}`);

  const reloadExpenses = expenses.reload;
  const reloadBudgets = budgets.reload;
  const reloadByCategory = byCategory.reload;
  const reloadByWeek = byWeek.reload;

  /**
   * Both charts, which move whenever any money does.
   *
   * Each is computed server-side — mixed currencies are the whole reason for
   * that — so neither can be patched here; they have to come back from the API.
   * The list a panel owns is not reloaded here because the panel that did the
   * writing has already done it.
   */
  const reloadAggregates = useCallback(() => {
    void reloadByCategory();
    void reloadByWeek();
  }, [reloadByCategory, reloadByWeek]);

  /** An expense moved, so the budget bars it counts against moved with it. */
  const onExpensesChanged = useCallback(() => {
    reloadAggregates();
    void reloadBudgets();
  }, [reloadAggregates, reloadBudgets]);

  /**
   * A budget changed. Only the aggregates here: BudgetSection reloads the bars
   * itself, and asking for them again would be a second identical request.
   */
  const onBudgetsChanged = reloadAggregates;

  /**
   * A category changed. Deleting one sets its expenses' category_id to null and
   * drops it from every budget that covered it — both server-side, so both
   * lists have to come back from the API rather than be patched here. The pie
   * moves too: that spend lands in the uncategorised slice.
   */
  const onCategoriesChanged = useCallback(() => {
    void reloadExpenses();
    onExpensesChanged();
  }, [reloadExpenses, onExpensesChanged]);

  // USD only until /auth/me lands; the picker on /profile is what changes it.
  const defaultCurrency = profile.data?.display_currency ?? 'USD';

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SpendByCategoryChart breakdown={byCategory} period={period.label} />
        <SpendByWeekChart breakdown={byWeek} period={period.label} />
      </div>

      {/* 2-4-4 across ten columns; stacked below lg, where side by side would
          leave every panel too narrow to read. */}
      <div className="grid gap-4 lg:h-[30rem] lg:grid-cols-10">
        <div className="min-h-0 lg:col-span-2">
          <CategorySection categories={categories} onChange={onCategoriesChanged} />
        </div>

        <div className="min-h-0 lg:col-span-4">
          <ExpenseSection
            expenses={expenses}
            categories={categories.items}
            currencies={currencies.items}
            defaultCurrency={defaultCurrency}
            onChange={onExpensesChanged}
            limit={LATEST_EXPENSES}
            seeAllHref="/finance/expenses"
          />
        </div>

        <div className="min-h-0 lg:col-span-4">
          <BudgetSection
            budgets={budgets}
            categories={categories.items}
            currencies={currencies.items}
            defaultCurrency={defaultCurrency}
            onChange={onBudgetsChanged}
          />
        </div>
      </div>
    </div>
  );
}
