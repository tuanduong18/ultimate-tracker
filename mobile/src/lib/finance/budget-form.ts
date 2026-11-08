import { monthStart } from '@/lib/dates';
import { DEFAULT_WARN_AT } from '@/lib/finance/budgets';
import type { Budget, BudgetPeriod } from '@/lib/finance/types';
import { amountProblem } from '@/lib/money';

/**
 * A budget as its form holds it, the checks it runs on submit, and what it sends — the phone's
 * copies of the web's budget-form.tsx rules and words, field for field.
 */

export interface BudgetValues {
  period: BudgetPeriod;
  name: string;
  amount: string;
  currency: string;
  /** Monthly: the 1st of the first month. Custom: the first day. */
  starts_on: string;
  /** Monthly: the 1st of the last month, or '' for ongoing. Custom: the last day ('' until set). */
  ends_on: string;
  all_spending: boolean;
  category_ids: string[];
  /** A share of the cap (1–99), or null for no early warning. */
  warn_at_percent: number | null;
}

/**
 * Where the form starts: the budget's own values when editing; otherwise a monthly budget from
 * the month on screen, warning at 80%, over chosen categories — or over all spending when there
 * are no categories to choose, as on the web.
 */
export function budgetValues(
  budget: Budget | null | undefined,
  defaults: { currency: string; month: string; hasCategories: boolean }
): BudgetValues {
  if (budget) {
    return {
      period: budget.period,
      name: budget.name,
      amount: budget.amount,
      currency: budget.currency,
      starts_on: budget.starts_on,
      // A stored monthly end is the month's last day; the form holds months by their 1st.
      ends_on:
        budget.period === 'monthly' && budget.ends_on
          ? monthStart(budget.ends_on)
          : (budget.ends_on ?? ''),
      all_spending: budget.all_spending,
      category_ids: budget.categories.map((category) => category.id),
      warn_at_percent: budget.warn_at_percent,
    };
  }
  return {
    period: 'monthly',
    name: '',
    amount: '',
    currency: defaults.currency,
    starts_on: monthStart(defaults.month),
    ends_on: '',
    all_spending: !defaults.hasCategories,
    category_ids: [],
    warn_at_percent: DEFAULT_WARN_AT,
  };
}

/** Switching between monthly and custom keeps the start, snapped to its month for monthly. */
export function withPeriod(values: BudgetValues, period: BudgetPeriod): BudgetValues {
  if (period === values.period) return values;
  return period === 'monthly'
    ? {
        ...values,
        period,
        starts_on: monthStart(values.starts_on),
        ends_on: values.ends_on ? monthStart(values.ends_on) : '',
      }
    : { ...values, period, ends_on: '' };
}

export type BudgetProblems = Partial<
  Record<'name' | 'amount' | 'starts_on' | 'ends_on' | 'category_ids', string>
>;

/** What is wrong, field by field, in the web's words and order — checked on submit. */
export function budgetProblems(values: BudgetValues): BudgetProblems {
  const monthly = values.period === 'monthly';
  const problems: BudgetProblems = {};
  if (!values.name.trim()) problems.name = 'Enter a name for the budget.';
  const amount = amountProblem(values.amount);
  if (amount) problems.amount = amount;
  if (!values.starts_on)
    problems.starts_on = monthly ? 'Pick the first month.' : 'Pick a start date.';
  if (!monthly && !values.ends_on) {
    problems.ends_on = 'A custom budget needs an end date.';
  } else if (values.ends_on && values.starts_on && values.ends_on < values.starts_on) {
    problems.ends_on = monthly
      ? 'The last month must be on or after the first.'
      : 'The end date must be on or after the start date.';
  }
  if (!values.all_spending && values.category_ids.length === 0) {
    problems.category_ids = 'Pick at least one category, or choose All spending.';
  }
  return problems;
}

/**
 * The body POST and PATCH send — the web's. A monthly budget's months go as their 1sts and the
 * server rounds the last to its month's end; an ongoing one and "don't warn early" go as explicit
 * nulls, so an edit can clear them. The categories are left out of an all-spending budget, which
 * the API refuses to have both.
 */
export function budgetPayload(values: BudgetValues) {
  return {
    name: values.name.trim(),
    amount: values.amount.trim(),
    currency: values.currency,
    period: values.period,
    starts_on: values.starts_on,
    ends_on: values.ends_on || null,
    all_spending: values.all_spending,
    ...(values.all_spending ? {} : { category_ids: values.category_ids }),
    warn_at_percent: values.warn_at_percent,
  };
}
