'use client';

import { useState } from 'react';

import { CurrencySelect } from '@/components/finance/currency-select';
import { amountProblem, type Category } from '@/lib/types/finance';

export interface BudgetValues {
  name: string;
  amount: string;
  currency: string;
  starts_on: string;
  ends_on: string;
  category_ids: string[];
}

interface BudgetFormProps {
  idPrefix: string;
  initial: BudgetValues;
  categories: Category[];
  currencies: string[];
  busy: boolean;
  onSubmit: (values: BudgetValues) => void;
  onCancel: () => void;
}

/** Add or edit one budget, including the set of categories its cap covers. */
export function BudgetForm({
  idPrefix,
  initial,
  categories,
  currencies,
  busy,
  onSubmit,
  onCancel,
}: BudgetFormProps) {
  const [values, setValues] = useState<BudgetValues>(initial);
  const [localError, setLocalError] = useState<string | null>(null);

  function set<K extends keyof BudgetValues>(field: K, value: BudgetValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function toggleCategory(id: string) {
    setValues((current) => ({
      ...current,
      category_ids: current.category_ids.includes(id)
        ? current.category_ids.filter((existing) => existing !== id)
        : [...current.category_ids, id],
    }));
  }

  /** The three rules the API enforces, checked here so the trip is not wasted. */
  function problem(): string | null {
    const amount = amountProblem(values.amount);
    if (amount) return amount;
    if (values.ends_on < values.starts_on)
      return 'The end date must be on or after the start date.';
    if (values.category_ids.length === 0) return 'Pick at least one category for this budget.';
    return null;
  }

  return (
    <form
      className="space-y-3 border-b border-gray-200 bg-gray-50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const found = problem();
        setLocalError(found);
        if (!found) onSubmit(values);
      }}
    >
      <div>
        <label className="block text-xs text-gray-600" htmlFor={`${idPrefix}-name`}>
          Name
        </label>
        <input
          id={`${idPrefix}-name`}
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          required
          maxLength={80}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600" htmlFor={`${idPrefix}-amount`}>
            Amount
          </label>
          <input
            id={`${idPrefix}-amount`}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
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
          <label className="block text-xs text-gray-600" htmlFor={`${idPrefix}-starts`}>
            Starts
          </label>
          <input
            id={`${idPrefix}-starts`}
            type="date"
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            required
            value={values.starts_on}
            onChange={(e) => set('starts_on', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600" htmlFor={`${idPrefix}-ends`}>
            Ends
          </label>
          <input
            id={`${idPrefix}-ends`}
            type="date"
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            required
            value={values.ends_on}
            onChange={(e) => set('ends_on', e.target.value)}
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-xs text-gray-600">Categories it covers</legend>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={values.category_ids.includes(category.id)}
                onChange={() => toggleCategory(category.id)}
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

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
