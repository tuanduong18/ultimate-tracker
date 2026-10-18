'use client';

import clsx from 'clsx';
import { useState } from 'react';

import { CurrencySelect } from '@/components/finance/currency-select';
import { amountProblem, type BudgetPeriod, type Category } from '@/lib/types/finance';

export interface BudgetValues {
  name: string;
  amount: string;
  currency: string;
  period: BudgetPeriod;
  /** YYYY-MM-DD. For a monthly budget, the 1st of its first month. */
  starts_on: string;
  /** YYYY-MM-DD, or empty: an ongoing monthly budget has no end. */
  ends_on: string;
  category_ids: string[];
}

const PERIODS: { value: BudgetPeriod; label: string; hint: string }[] = [
  { value: 'monthly', label: 'Monthly', hint: 'Resets on the 1st of every month.' },
  { value: 'custom', label: 'Custom dates', hint: 'One cap over a range you pick.' },
];

/** "2026-10-01" → "2026-10" for a month input, and back again. */
const toMonth = (iso: string) => iso.slice(0, 7);
const fromMonth = (month: string) => (month ? `${month}-01` : '');

interface BudgetFormProps {
  idPrefix: string;
  initial: BudgetValues;
  categories: Category[];
  currencies: string[];
  busy: boolean;
  onSubmit: (values: BudgetValues) => void;
  onCancel: () => void;
}

/**
 * Add or edit one budget, including the set of categories its cap covers.
 *
 * The type comes first because it decides what the dates mean: a monthly
 * budget asks for months (and an optional last month), a custom one for exact
 * days. The server rounds monthly dates out to whole months either way.
 */
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
  const monthly = values.period === 'monthly';

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

  /** The rules the API enforces, checked here so the trip is not wasted. */
  function problem(): string | null {
    const amount = amountProblem(values.amount);
    if (amount) return amount;
    if (!values.starts_on) return monthly ? 'Pick the first month.' : 'Pick a start date.';
    if (!monthly && !values.ends_on) return 'A custom budget needs an end date.';
    if (values.ends_on && values.ends_on < values.starts_on)
      return monthly
        ? 'The last month must be on or after the first.'
        : 'The end date must be on or after the start date.';
    if (values.category_ids.length === 0) return 'Pick at least one category for this budget.';
    return null;
  }

  return (
    <form
      className="space-y-3 border-b border-border bg-surface-muted p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const found = problem();
        setLocalError(found);
        if (!found) onSubmit(values);
      }}
    >
      <fieldset>
        <legend className="text-xs text-fg-muted">Type</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {PERIODS.map((option) => (
            <label
              key={option.value}
              className={clsx(
                'flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm',
                values.period === option.value
                  ? 'border-primary bg-primary-soft'
                  : 'bg-surface hover:border-primary'
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="radio"
                  name={`${idPrefix}-period`}
                  value={option.value}
                  checked={values.period === option.value}
                  onChange={() => set('period', option.value)}
                  className="accent-primary"
                />
                {option.label}
              </span>
              <span className="mt-0.5 text-xs text-fg-muted">{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-name`}>
          Name
        </label>
        <input
          id={`${idPrefix}-name`}
          className="mt-1 w-full rounded-md border bg-surface px-2 py-1.5 text-sm"
          required
          maxLength={80}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-amount`}>
            {monthly ? 'Amount per month' : 'Amount'}
          </label>
          <input
            id={`${idPrefix}-amount`}
            className="mt-1 w-full rounded-md border bg-surface px-2 py-1.5 text-sm"
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

        {monthly ? (
          <>
            <div>
              <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-starts`}>
                First month
              </label>
              <input
                id={`${idPrefix}-starts`}
                type="month"
                className="mt-1 w-full rounded-md border bg-surface px-2 py-1.5 text-sm"
                required
                value={toMonth(values.starts_on)}
                onChange={(e) => set('starts_on', fromMonth(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-ends`}>
                Last month <span className="text-fg-subtle">(optional)</span>
              </label>
              <input
                id={`${idPrefix}-ends`}
                type="month"
                className="mt-1 w-full rounded-md border bg-surface px-2 py-1.5 text-sm"
                value={toMonth(values.ends_on)}
                onChange={(e) => set('ends_on', fromMonth(e.target.value))}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-starts`}>
                Starts
              </label>
              <input
                id={`${idPrefix}-starts`}
                type="date"
                className="mt-1 w-full rounded-md border bg-surface px-2 py-1.5 text-sm"
                required
                value={values.starts_on}
                onChange={(e) => set('starts_on', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-ends`}>
                Ends
              </label>
              <input
                id={`${idPrefix}-ends`}
                type="date"
                className="mt-1 w-full rounded-md border bg-surface px-2 py-1.5 text-sm"
                // Not `required`: problem() says why an end is needed, which the
                // browser's generic "fill out this field" bubble does not.
                value={values.ends_on}
                onChange={(e) => set('ends_on', e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <fieldset>
        <legend className="text-xs text-fg-muted">Categories it covers</legend>
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
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" className="text-sm underline" onClick={onCancel}>
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
