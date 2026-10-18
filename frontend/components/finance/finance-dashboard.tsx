'use client';

import { useCallback, useState } from 'react';

import { BudgetSection } from '@/components/finance/budget-section';
import { CategorySection } from '@/components/finance/category-section';
import { ExpenseSection } from '@/components/finance/expense-section';
import {
  ALL_CATEGORIES,
  selectionQuery,
  type CategorySelection,
} from '@/components/finance/category-filter';
import { granularityFor } from '@/components/finance/range-control';
import { SpendByCategoryChart } from '@/components/finance/spend-by-category-chart';
import { SpendByPeriodChart } from '@/components/finance/spend-by-period-chart';
import { SubscriptionSection } from '@/components/finance/subscription-section';
import { SummaryTiles } from '@/components/finance/summary-tiles';
import { monthRange, sameDaysLastMonth, shiftRange, todayIso } from '@/lib/dates';
import { useCollection, useResource } from '@/lib/hooks/use-collection';
import type {
  BudgetProgress,
  Category,
  CategoryBreakdown,
  Expense,
  PeriodBreakdown,
  Subscription,
  Summary,
} from '@/lib/types/finance';
import type { Profile } from '@/lib/types/profile';

/** The newest few, which is as many as the panel can show without scrolling far. */
const LATEST_EXPENSES = 10;

/**
 * Owns every finance fetch on the page, and lays the six panels out.
 *
 * The collections live here rather than in the panels that render them because
 * they are not independent: the expense and budget forms pick from the same
 * categories, logging an expense moves both charts and a budget bar, and
 * deleting a category rewrites rows in every other list. Panels mutate and then
 * say so; deciding what went stale is this component's job, and having that in
 * one place is what keeps the page honest after a write.
 *
 * Layout narrows in steps rather than squeezing. On wide screens: two charts
 * across the top and a 2-4-3-3 row beneath — categories, expenses,
 * subscriptions, budgets. Below 2xl that row becomes two (categories with
 * expenses, subscriptions with budgets); below xl the charts stack; below md
 * everything is one column, in that same reading order.
 */
export function FinanceDashboard() {
  // A range each, rather than one shared by both charts. They answer different
  // questions — "when did it go" and "what did it go on" — and those are worth
  // asking over different windows: this week's days against the month's
  // categories, say. Both start on the current month.
  const [periodRange, setPeriodRange] = useState(monthRange);
  const [categoryRange, setCategoryRange] = useState(monthRange);

  // Everything is included until someone says otherwise, and a filter belongs
  // to the chart it narrows: hiding rent to read the small spending on one
  // chart should not silently reshape the other.
  const [periodSelection, setPeriodSelection] = useState<CategorySelection>(ALL_CATEGORIES);
  const [categorySelection, setCategorySelection] = useState<CategorySelection>(ALL_CATEGORIES);

  const categories = useCollection<Category>('/finance/categories');
  const expenses = useCollection<Expense>('/finance/expenses');
  const currencies = useCollection<string>('/finance/currencies');
  const profile = useResource<Profile>('/auth/me');

  // Carries everything the plain budget list does plus what has been spent, so
  // the bars and the edit forms cannot disagree after a write.
  const budgets = useCollection<BudgetProgress>('/finance/budgets/progress');
  const subscriptions = useCollection<Subscription>('/finance/subscriptions');

  // Each chart refetches when its own range or filter moves: the path is the
  // hook's dependency, so either is a new resource rather than a manual reload.
  const categoryFilter = selectionQuery(categorySelection);
  const previousCategoryRange = shiftRange(categoryRange, -1);

  const byCategory = useResource<CategoryBreakdown>(
    `/finance/summary/by-category?start_date=${categoryRange.start}` +
      `&end_date=${categoryRange.end}${categoryFilter}`
  );
  // The same window, one length earlier — the left-hand pie. Fetched rather
  // than derived: the API converts currencies, and last period's totals are not
  // a subset of this period's.
  const byCategoryBefore = useResource<CategoryBreakdown>(
    `/finance/summary/by-category?start_date=${previousCategoryRange.start}` +
      `&end_date=${previousCategoryRange.end}${categoryFilter}`
  );
  const byPeriod = useResource<PeriodBreakdown>(
    `/finance/summary/by-period?start_date=${periodRange.start}&end_date=${periodRange.end}` +
      `&granularity=${granularityFor(periodRange)}${selectionQuery(periodSelection)}`
  );

  // The headline tiles: this calendar month, and the same days of last month
  // to compare it against. Fixed to the calendar rather than to either chart's
  // range — "this month" is the question the tiles answer.
  const [thisMonth] = useState(monthRange);
  const [lastMonthSoFar] = useState(() => sameDaysLastMonth());
  const [today] = useState(todayIso);
  const summary = useResource<Summary>(
    `/finance/summary?start_date=${thisMonth.start}&end_date=${thisMonth.end}`
  );
  const summaryBefore = useResource<Summary>(
    `/finance/summary?start_date=${lastMonthSoFar.start}&end_date=${lastMonthSoFar.end}`
  );

  const reloadExpenses = expenses.reload;
  const reloadSummary = summary.reload;
  const reloadSummaryBefore = summaryBefore.reload;
  const reloadBudgets = budgets.reload;
  const reloadSubscriptions = subscriptions.reload;
  const reloadByCategory = byCategory.reload;
  const reloadByCategoryBefore = byCategoryBefore.reload;
  const reloadByPeriod = byPeriod.reload;

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
    void reloadByCategoryBefore();
    void reloadByPeriod();
    void reloadSummary();
    void reloadSummaryBefore();
  }, [
    reloadByCategory,
    reloadByCategoryBefore,
    reloadByPeriod,
    reloadSummary,
    reloadSummaryBefore,
  ]);

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
   * A subscription changed. Nothing else moves: editing one writes no expense —
   * only a renewal does — and SubscriptionSection reloads its own list.
   */
  const onSubscriptionsChanged = useCallback(() => {}, []);

  /**
   * A category changed. Deleting one sets the category_id of its expenses and
   * subscriptions to null and drops it from every budget that covered it — all
   * server-side, so those lists have to come back from the API rather than be
   * patched here. The pie moves too: that spend lands in the uncategorised slice.
   */
  const onCategoriesChanged = useCallback(() => {
    void reloadExpenses();
    void reloadSubscriptions();
    onExpensesChanged();
  }, [reloadExpenses, reloadSubscriptions, onExpensesChanged]);

  // USD only until /auth/me lands; the picker on /profile is what changes it.
  const defaultCurrency = profile.data?.display_currency ?? 'USD';

  return (
    <div className="mt-6 space-y-4">
      <SummaryTiles
        current={summary}
        previous={summaryBefore}
        previousRange={lastMonthSoFar}
        subscriptions={subscriptions.items}
        subscriptionsLoading={subscriptions.loading}
        today={today}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <SpendByCategoryChart
          current={byCategory}
          previous={byCategoryBefore}
          range={categoryRange}
          onRangeChange={setCategoryRange}
          categories={categories.items}
          selection={categorySelection}
          onSelectionChange={setCategorySelection}
        />
        <SpendByPeriodChart
          breakdown={byPeriod}
          range={periodRange}
          onRangeChange={setPeriodRange}
          categories={categories.items}
          selection={periodSelection}
          onSelectionChange={setPeriodSelection}
        />
      </div>

      {/* Twelve columns from md: 5-7 then 6-6 in two fixed-height rows, and
          2-4-3-3 in one row from 2xl, where four fit without any being too
          narrow to read. Fixed rows keep each panel scrolling its own list.
          Below md the panels stack and simply grow with their content. */}
      <div className="grid gap-4 md:auto-rows-[30rem] md:grid-cols-12">
        <div className="min-h-0 md:col-span-5 2xl:col-span-2">
          <CategorySection categories={categories} onChange={onCategoriesChanged} />
        </div>

        <div className="min-h-0 md:col-span-7 2xl:col-span-4">
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

        <div className="min-h-0 md:col-span-6 2xl:col-span-3">
          <SubscriptionSection
            subscriptions={subscriptions}
            categories={categories.items}
            currencies={currencies.items}
            defaultCurrency={defaultCurrency}
            onChange={onSubscriptionsChanged}
          />
        </div>

        <div className="min-h-0 md:col-span-6 2xl:col-span-3">
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
