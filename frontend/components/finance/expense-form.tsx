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

interface ExpenseFormProps {
  /** Unique per rendered form — two forms sharing label ids break both. */
  idPrefix: string;
  initial: ExpenseValues;
  categories: Category[];
  currencies: string[];
  busy: boolean;
  onSubmit: (values: ExpenseValues) => void;
  onCancel: () => void;
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
}: ExpenseFormProps) {
  const [values, setValues] = useState<ExpenseValues>(initial);
  const [localError, setLocalError] = useState<string | null>(null);

  function set<K extends keyof ExpenseValues>(field: K, value: ExpenseValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      className="space-y-3 border-b border-gray-200 bg-gray-50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const problem = amountProblem(values.amount);
        setLocalError(problem);
        if (!problem) onSubmit(values);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600" htmlFor={`${idPrefix}-amount`}>
            Amount
          </label>
          <input
            id={`${idPrefix}-amount`}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            // Text, not number: a number input hands back a float, and the trailing
            // zero a currency's scale may depend on does not survive the round trip.
            inputMode="decimal"
            required
            value={values.amount}
            onChange={(e) => set('amount', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600" htmlFor={`${idPrefix}-currency`}>
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
          <label className="block text-xs text-gray-600" htmlFor={`${idPrefix}-date`}>
            Date
          </label>
          <input
            id={`${idPrefix}-date`}
            type="date"
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            required
            value={values.spent_on}
            onChange={(e) => set('spent_on', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600" htmlFor={`${idPrefix}-category`}>
            Category
          </label>
          <select
            id={`${idPrefix}-category`}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
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
        <label className="block text-xs text-gray-600" htmlFor={`${idPrefix}-description`}>
          Description
        </label>
        <input
          id={`${idPrefix}-description`}
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          maxLength={500}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" className="text-sm underline" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {localError && (
        <p role="alert" className="text-sm text-red-600">
          {localError}
        </p>
      )}
    </form>
  );
}
