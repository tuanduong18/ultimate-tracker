import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { api } from '@/lib/api-client';
import type { DateRange } from '@/lib/dates';
import { describeError } from '@/lib/describe-error';
import { selectionQuery, type CategorySelection } from '@/lib/finance/categories';
import type {
  BudgetProgress,
  Category,
  CategoryBreakdown,
  Expense,
  Granularity,
  PeriodBreakdown,
  Subscription,
  Summary,
} from '@/lib/finance/types';
import type { Profile } from '@/lib/types/profile';

/**
 * Every Finance read the app makes, as hooks over one cache (lib/query.tsx), and the one way to
 * write. Paths and parameters are the web's, so both clients ask the API the same questions.
 *
 * Every key starts with 'finance', so a write invalidates the lot: an expense moves the totals,
 * the charts, the budgets' progress and the lists at once, and the data is small enough that
 * reloading all of it is cheaper than working out which part changed.
 */
export const financeKeys = {
  all: ['finance'] as const,
  categories: ['finance', 'categories'] as const,
  expenses: ['finance', 'expenses'] as const,
  budgetProgress: (month: string) => ['finance', 'budgets', 'progress', month] as const,
  subscriptions: ['finance', 'subscriptions'] as const,
  currencies: ['finance', 'currencies'] as const,
  summary: (range: DateRange) => ['finance', 'summary', range.start, range.end] as const,
  byCategory: (range: DateRange, selection: CategorySelection) =>
    ['finance', 'by-category', range.start, range.end, selectionQuery(selection)] as const,
  byPeriod: (range: DateRange, granularity: Granularity, selection: CategorySelection) =>
    [
      'finance',
      'by-period',
      range.start,
      range.end,
      granularity,
      selectionQuery(selection),
    ] as const,
};

export const profileKey = ['profile'] as const;

/** The largest page the API serves; a shorter page means it was the last. */
export const API_PAGE_LIMIT = 500;

/**
 * Every row of a paged list, walked page by page. The Transactions screen searches and filters
 * on the phone, which only works over all of them; a person logs a few a day, so this is a few
 * pages after years.
 */
export async function fetchEveryPage<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  const join = path.includes('?') ? '&' : '?';
  for (;;) {
    const page = await api.get<T[]>(`${path}${join}limit=${API_PAGE_LIMIT}&offset=${rows.length}`);
    rows.push(...page);
    if (page.length < API_PAGE_LIMIT) return rows;
  }
}

/** The person's categories, in their own order. */
export function useCategories() {
  return useQuery({
    queryKey: financeKeys.categories,
    queryFn: () => api.get<Category[]>('/finance/categories'),
  });
}

/** Every expense, newest first — the Overview's latest rows and the whole Transactions list. */
export function useExpenses() {
  return useQuery({
    queryKey: financeKeys.expenses,
    queryFn: () => fetchEveryPage<Expense>('/finance/expenses'),
  });
}

/**
 * The budgets that apply to `month` (its 1st), with spend measured against each. Stepping to
 * another month keeps the last month's cards up until the new ones land, rather than blanking.
 */
export function useBudgetProgress(month: string) {
  return useQuery({
    queryKey: financeKeys.budgetProgress(month),
    queryFn: () => api.get<BudgetProgress[]>(`/finance/budgets/progress?month=${month}`),
    placeholderData: keepPreviousData,
  });
}

/** Subscriptions in the server's order: live ones by next charge, then the cancelled. */
export function useSubscriptions() {
  return useQuery({
    queryKey: financeKeys.subscriptions,
    queryFn: () => api.get<Subscription[]>('/finance/subscriptions'),
  });
}

/** The currencies the API can convert — the only source of codes; never a hard-coded list. */
export function useCurrencies() {
  return useQuery({
    queryKey: financeKeys.currencies,
    queryFn: () => api.get<string[]>('/finance/currencies'),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** The profile: display and preferred currency. Fetching it also creates it on a first visit. */
export function useProfile() {
  return useQuery({ queryKey: profileKey, queryFn: () => api.get<Profile>('/auth/me') });
}

/** Spent, budgeted and remaining over a range, in the display currency. */
export function useSummary(range: DateRange) {
  return useQuery({
    queryKey: financeKeys.summary(range),
    queryFn: () =>
      api.get<Summary>(`/finance/summary?start_date=${range.start}&end_date=${range.end}`),
    placeholderData: keepPreviousData,
  });
}

/**
 * Spend per category over a range. `enabled: false` when nothing is selected — a query string
 * cannot say "no categories", so the chart says so instead of asking.
 */
export function useCategoryBreakdown(
  range: DateRange,
  selection: CategorySelection,
  enabled = true
) {
  return useQuery({
    queryKey: financeKeys.byCategory(range, selection),
    queryFn: () =>
      api.get<CategoryBreakdown>(
        `/finance/summary/by-category?start_date=${range.start}&end_date=${range.end}${selectionQuery(selection)}`
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Spend per day or week over a range, empty buckets included. */
export function usePeriodBreakdown(
  range: DateRange,
  granularity: Granularity,
  selection: CategorySelection,
  enabled = true
) {
  return useQuery({
    queryKey: financeKeys.byPeriod(range, granularity, selection),
    queryFn: () =>
      api.get<PeriodBreakdown>(
        `/finance/summary/by-period?start_date=${range.start}&end_date=${range.end}&granularity=${granularity}${selectionQuery(selection)}`
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * What a form needs before it can start: the categories, the currencies and the currency new
 * entries start in. Until the profile answers, new entries start in USD, as on the web.
 */
export function useFinanceBasics() {
  const categories = useCategories();
  const currencies = useCurrencies();
  const profile = useProfile();
  return {
    categories,
    currencies: currencies.data ?? [],
    defaultCurrency: profile.data?.preferred_currency ?? 'USD',
    loading: categories.isPending || currencies.isPending || profile.isPending,
  };
}

/**
 * A finance write: run it, then reload everything under 'finance' and wait for that reload, so
 * the screen the person returns to already shows what the server stored — never "saved" before
 * the server said so, and never a list that is one save behind.
 */
export function useFinanceWrite<TArgs, TResult = unknown>(
  write: (args: TArgs) => Promise<TResult>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => write(args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

/**
 * Deleting what an open screen is showing: the delete runs, and the reload waits until that
 * screen has closed. Reloading first would pull the deleted thing out from under its own form,
 * which would flash "That expense no longer exists" as it slid away. The server has already
 * confirmed the delete by then, and the list behind refetches as the form leaves.
 */
export function useFinanceDelete(path: string) {
  const queryClient = useQueryClient();
  const deleted = useRef(false);

  useEffect(
    () => () => {
      if (deleted.current) void queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
    [queryClient]
  );

  return useMutation({
    mutationFn: () => api.delete<void>(path),
    onSuccess: () => {
      deleted.current = true;
    },
  });
}

/** A load's failure as a sentence for its error state, or null while it hasn't failed. */
export function loadError(query: Pick<UseQueryResult, 'error'>, fallback: string): string | null {
  return query.error ? describeError(query.error, fallback) : null;
}
