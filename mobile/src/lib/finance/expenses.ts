import { formatDate } from '@/lib/dates';
import { UNCATEGORISED } from '@/lib/finance/categories';
import type { Category, Expense } from '@/lib/finance/types';
import { amountProblem } from '@/lib/money';

/**
 * An expense as the form holds it, and the rules shared by the form, its rows and their tests —
 * the phone's copies of the web's expense-form.tsx payload and expense-section.tsx row text.
 */

/** The form's fields as typed: strings throughout, '' for an empty optional one. */
export interface ExpenseValues {
  amount: string;
  currency: string;
  /** '' is Uncategorised. */
  category_id: string;
  description: string;
  spent_on: string;
}

/**
 * Where the form starts: the expense's own values when editing; otherwise empty, in the
 * person's preferred currency, on the first category in their order, dated today.
 */
export function expenseValues(
  expense: Expense | null | undefined,
  defaults: { currency: string; categoryId: string; today: string }
): ExpenseValues {
  if (expense) {
    return {
      amount: expense.amount,
      currency: expense.currency,
      category_id: expense.category_id ?? '',
      description: expense.description ?? '',
      spent_on: expense.spent_on,
    };
  }
  return {
    amount: '',
    currency: defaults.currency,
    category_id: defaults.categoryId,
    description: '',
    spent_on: defaults.today,
  };
}

/** What is wrong, field by field — checked on submit, never while typing. */
export function expenseProblems(values: ExpenseValues): { amount?: string } {
  const amount = amountProblem(values.amount);
  return amount ? { amount } : {};
}

/**
 * The body POST and PATCH send — the web's, so both clients write the same thing. Every field is
 * sent, an empty description and Uncategorised as explicit nulls, so an edit can clear them.
 */
export function expensePayload(values: ExpenseValues) {
  return {
    amount: values.amount.trim(),
    currency: values.currency,
    category_id: values.category_id || null,
    description: values.description.trim() || null,
    spent_on: values.spent_on,
  };
}

/**
 * How a row reads, category first: its description, or its category when it has none, then the
 * category and the date — or just the date, when the first line already named the category.
 * Never "No description": the category is the better first line.
 */
export function expenseLines(
  expense: Expense,
  category: Category | undefined
): { title: string; detail: string; categoryName: string } {
  const categoryName = category?.name ?? UNCATEGORISED;
  const date = formatDate(expense.spent_on);
  return expense.description
    ? { title: expense.description, detail: `${categoryName} · ${date}`, categoryName }
    : { title: categoryName, detail: date, categoryName };
}

/** What the expense is called in a confirmation: its description, or "Food expense, 7 Nov 2026". */
export function expenseName(expense: Expense, category: Category | undefined): string {
  return (
    expense.description ||
    `${category?.name ?? UNCATEGORISED} expense, ${formatDate(expense.spent_on)}`
  );
}
