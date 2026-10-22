'use client';

import { useCallback, useState } from 'react';

import { BudgetSection } from '@/components/finance/budget-section';
import { ExpenseSection } from '@/components/finance/expense-section';
import {
  ALL_CATEGORIES,
  selectionQuery,
  type CategorySelection,
} from '@/components/finance/category-filter';
import { granularityFor } from '@/components/finance/range-control';
import { SpendByCategoryChart } from '@/components/finance/spend-by-category-chart';
import { SpendByPeriodChart } from '@/components/finance/spend-by-period-chart';
import { SummaryTiles } from '@/components/finance/summary-tiles';
import { monthRange, monthStart, sameDaysLastMonth, shiftRange, todayIso } from '@/lib/dates';
import { useExpensesChanged } from '@/lib/finance-events';
import { useCollection, useResource } from '@/lib/hooks/use-collection';
import { useFinanceBasics } from '@/lib/hooks/use-finance-basics';
import type {
  BudgetProgress,
  CategoryBreakdown,
  Expense,
  PeriodBreakdown,
  Subscription,
  Summary,
} from '@/lib/types/finance';

/** The newest few, which is as many as the panel can show without scrolling far. */
const LATEST_EXPENSES = 8;

/**
 * The Finance overview: owns its fetches and lays the panels out.
 *
 * The overview is for looking: headline tiles, the two charts, then the
 * newest expenses beside this month's budgets — the two lists that move every
 * day. Subscriptions and categories change rarely and have their own tabs.
 *
 * The collections live here rather than in the panels because they are not
 * independent: logging an expense moves both charts and a budget bar. Panels
 * mutate and then say so; deciding what went stale is this component's job.
 * An expense added from the Add expense dialog announces itself the same way.
 *
 * Layout narrows in steps rather than squeezing: two charts side by side from
 * xl, the two lists side by side from lg, everything one column below that.
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

  const { categories, currencies, defaultCurrency } = useFinanceBasics();
  const expenses = useCollection<Expense>('/finance/expenses');

  // Carries everything the plain budget list does plus what has been spent, so
  // the bars and the edit forms cannot disagree after a write.
  // The month the Budgets panel is showing. Part of the path, so moving it is
  // a new fetch rather than a filter over one: a monthly budget's spend has to
  // be measured again for each month.
  const [budgetMonth, setBudgetMonth] = useState(() => monthStart());
  const budgets = useCollection<BudgetProgress>(`/finance/budgets/progress?month=${budgetMonth}`);
  const subscriptions = useCollection<Subscription>('/finance/subscriptions');

  // Each chart refetches when its own range or filter moves: the path is the
  // hook's dependency, so either is a new resource rather than a manual reload.
  const categoryFilter = selectionQuery(categorySelection);
  const previousCategoryRange = shiftRange(categoryRange, -1);

  const byCategory = useResource<CategoryBreakdown>(
    `/finance/summary/by-category?start_date=${categoryRange.start}` +
      `&end_date=${categoryRange.end}${categoryFilter}`
  );
  // The same window, one length earlier — the left-hand ring, and the "last"
  // share in each legend row. Fetched rather than derived: the API converts
  // currencies, and last period's totals are not a subset of this period's.
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

  // An expense added from the header: the list and everything it moves.
  useExpensesChanged(() => {
    void reloadExpenses();
    onExpensesChanged();
  });

  return (
    <div className="space-y-4">
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

      {/* Fixed-height rows from lg keep each list scrolling inside its own
          panel, so the two stay side by side however long either grows.
          Below lg they stack and simply grow with their content. */}
      <div className="grid gap-4 lg:auto-rows-[30rem] lg:grid-cols-2">
        <div className="min-h-0">
          <ExpenseSection
            expenses={expenses}
            categories={categories.items}
            currencies={currencies}
            onChange={onExpensesChanged}
            title="Latest expenses"
            limit={LATEST_EXPENSES}
            seeAllHref="/finance/expenses"
          />
        </div>

        <div className="min-h-0">
          <BudgetSection
            budgets={budgets}
            month={budgetMonth}
            onMonthChange={setBudgetMonth}
            categories={categories.items}
            currencies={currencies}
            defaultCurrency={defaultCurrency}
            onChange={onBudgetsChanged}
          />
        </div>
      </div>
    </div>
  );
}
