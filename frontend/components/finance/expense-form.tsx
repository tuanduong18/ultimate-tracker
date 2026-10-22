'use client';

import { useState } from 'react';

import { CurrencySelect } from '@/components/finance/currency-select';
import { amountProblem, type Category } from '@/lib/types/finance';

export interface ExpenseValues {
  amount: string;
  currency: string;
  category_id: string;
  description: string;
  spent_on: string;
}

/**
 * The request body for a create or update. An empty field means "not filled
 * in", which the API spells as null.
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

interface ExpenseFormProps {
  /** Unique per rendered form — two forms sharing label ids break both. */
  idPrefix: string;
  initial: ExpenseValues;
  categories: Category[];
  currencies: string[];
  busy: boolean;
  onSubmit: (values: ExpenseValues) => void;
  onCancel: () => void;
  /**
   * The form's frame. Defaults to the recessed strip it wears inside a list;
   * the Add expense dialog passes its own, having a frame already.
   */
  className?: string;
  /** The submit button's word — "Add" where Save would be ambiguous. */
  submitLabel?: string;
}

/**
 * Add or edit one expense.
 *
 * Laid out as a wrapping two-column grid rather than a row: this now renders
 * inside a panel about two-fifths of the page wide as well as on the full-width
 * expenses page, and a single row of six fields is unusable in the first.
 */
export function ExpenseForm({
  idPrefix,
  initial,
  categories,
  currencies,
  busy,
  onSubmit,
  onCancel,
  className = 'space-y-3 border-b border-border bg-surface-muted p-4',
  submitLabel = 'Save',
}: ExpenseFormProps) {
  const [values, setValues] = useState<ExpenseValues>(initial);
  const [localError, setLocalError] = useState<string | null>(null);

  function set<K extends keyof ExpenseValues>(field: K, value: ExpenseValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const problem = amountProblem(values.amount);
        setLocalError(problem);
        if (!problem) onSubmit(values);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-amount`}>
            Amount
          </label>
          <input
            // Opening the form replaces whatever held focus (the row, or nothing);
            // start where the typing starts.
            autoFocus
            id={`${idPrefix}-amount`}
            className="mt-1 w-full rounded-sm border px-2 py-1.5 text-sm"
            // Text, not number: a number input hands back a float, and the trailing
            // zero a currency's scale may depend on does not survive the round trip.
            inputMode="decimal"
            required
            value={values.amount}
            onChange={(e) => set('amount', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-currency`}>
            Currency
          </label>
          <CurrencySelect
            id={`${idPrefix}-currency`}
            value={values.currency}
            currencies={currencies}
            onChange={(currency) => set('currency', currency)}
          />
        </div>

        <div>
          <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-date`}>
            Date
          </label>
          <input
            id={`${idPrefix}-date`}
            type="date"
            className="mt-1 w-full rounded-sm border px-2 py-1.5 text-sm"
            required
            value={values.spent_on}
            onChange={(e) => set('spent_on', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-category`}>
            Category
          </label>
          <select
            id={`${idPrefix}-category`}
            className="mt-1 w-full rounded-sm border px-2 py-1.5 text-sm"
            value={values.category_id}
            onChange={(e) => set('category_id', e.target.value)}
          >
            <option value="">Uncategorised</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-description`}>
          Description
        </label>
        <input
          id={`${idPrefix}-description`}
          className="mt-1 w-full rounded-sm border px-2 py-1.5 text-sm"
          maxLength={500}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:px-4"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          className="rounded-md px-1 text-sm underline pointer-coarse:min-h-11 pointer-coarse:px-3"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      {localError && (
        <p role="alert" className="text-sm text-negative">
          {localError}
        </p>
      )}
    </form>
  );
}
