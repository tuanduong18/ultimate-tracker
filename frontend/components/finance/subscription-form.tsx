'use client';

import { useState } from 'react';

import { CurrencySelect } from '@/components/finance/currency-select';
import { amountProblem, type BillingInterval, type Category } from '@/lib/types/finance';

export interface SubscriptionValues {
  name: string;
  amount: string;
  currency: string;
  interval_unit: BillingInterval;
  /** A string while typed; the section parses it on submit. */
  interval_count: string;
  /** Empty means uncategorised. */
  category_id: string;
  started_on: string;
  /** Empty means no free trial. */
  trial_ends_on: string;
  /** Empty means live. Only offered when editing. */
  cancelled_on: string;
}

const UNITS: { value: BillingInterval; label: string }[] = [
  { value: 'day', label: 'Day(s)' },
  { value: 'week', label: 'Week(s)' },
  { value: 'month', label: 'Month(s)' },
  { value: 'year', label: 'Year(s)' },
];

/**
 * The category a new subscription starts on: the user's "Subscriptions", if
 * they still have one by that name in any case.
 *
 * Done here rather than by the server so the choice is visible and editable
 * before saving, and so renaming or deleting that category breaks nothing —
 * there is simply nothing to preselect.
 */
export function preselectedCategoryId(categories: Category[]): string {
  return categories.find((c) => c.name.trim().toLowerCase() === 'subscriptions')?.id ?? '';
}

interface SubscriptionFormProps {
  /** Unique per rendered form — two forms sharing label ids break both. */
  idPrefix: string;
  initial: SubscriptionValues;
  categories: Category[];
  currencies: string[];
  /** Editing an existing subscription, which is the only time cancelling makes sense. */
  editing: boolean;
  busy: boolean;
  onSubmit: (values: SubscriptionValues) => void;
  onCancel: () => void;
}

/** Add or edit one subscription. */
export function SubscriptionForm({
  idPrefix,
  initial,
  categories,
  currencies,
  editing,
  busy,
  onSubmit,
  onCancel,
}: SubscriptionFormProps) {
  const [values, setValues] = useState<SubscriptionValues>(initial);
  const [localError, setLocalError] = useState<string | null>(null);

  function set<K extends keyof SubscriptionValues>(field: K, value: SubscriptionValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  /** The rules the API enforces, checked here so the trip is not wasted. */
  function problem(): string | null {
    const amount = amountProblem(values.amount);
    if (amount) return amount;
    if (!/^\d+$/.test(values.interval_count.trim()) || Number(values.interval_count) < 1)
      return 'Bill every 1 or more — a whole number.';
    if (values.trial_ends_on && values.trial_ends_on <= values.started_on)
      return 'The trial must end after the start date.';
    if (values.cancelled_on && values.cancelled_on < values.started_on)
      return 'The cancellation date must be on or after the start date.';
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
      <div>
        <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-name`}>
          Name
        </label>
        <input
          // Opening the form replaces whatever held focus (the row, or nothing);
          // start where the typing starts.
          autoFocus
          id={`${idPrefix}-name`}
          className="mt-1 w-full rounded-sm border px-2 py-1.5 text-sm"
          required
          maxLength={80}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-amount`}>
            Amount
          </label>
          <input
            id={`${idPrefix}-amount`}
            className="mt-1 w-full rounded-sm border px-2 py-1.5 text-sm"
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
          <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-count`}>
            Every
          </label>
          <input
            id={`${idPrefix}-count`}
            className="mt-1 w-full rounded-sm border px-2 py-1.5 text-sm"
            inputMode="numeric"
            required
            value={values.interval_count}
            onChange={(e) => set('interval_count', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-unit`}>
            Unit
          </label>
          <select
            id={`${idPrefix}-unit`}
            className="mt-1 w-full rounded-sm border px-2 py-1.5 text-sm"
            value={values.interval_unit}
            onChange={(e) => set('interval_unit', e.target.value as BillingInterval)}
          >
            {UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-started`}>
            Started
          </label>
          <input
            id={`${idPrefix}-started`}
            type="date"
            className="mt-1 w-full rounded-sm border px-2 py-1.5 text-sm"
            required
            value={values.started_on}
            onChange={(e) => set('started_on', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-trial`}>
            Free trial ends
          </label>
          <input
            id={`${idPrefix}-trial`}
            type="date"
            className="mt-1 w-full rounded-sm border px-2 py-1.5 text-sm"
            value={values.trial_ends_on}
            onChange={(e) => set('trial_ends_on', e.target.value)}
          />
        </div>

        <div className={editing ? undefined : 'col-span-2'}>
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

        {editing && (
          <div>
            <label className="block text-xs text-fg-muted" htmlFor={`${idPrefix}-cancelled`}>
              Cancelled on
            </label>
            <input
              id={`${idPrefix}-cancelled`}
              type="date"
              className="mt-1 w-full rounded-sm border px-2 py-1.5 text-sm"
              value={values.cancelled_on}
              onChange={(e) => set('cancelled_on', e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:px-4"
        >
          Save
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
