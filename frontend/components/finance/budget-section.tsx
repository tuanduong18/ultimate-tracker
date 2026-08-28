'use client';

import { useState } from 'react';

import { CurrencySelect } from '@/components/finance/currency-select';
import { DeleteButton } from '@/components/finance/delete-button';
import { api } from '@/lib/api-client';
import { formatDate, monthRange } from '@/lib/dates';
import { describeError, type Collection } from '@/lib/hooks/use-collection';
import { amountProblem, formatMoney, type Budget, type Category } from '@/lib/types/finance';

interface BudgetValues {
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

function BudgetForm({
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
      className="space-y-3 border-b border-gray-200 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const found = problem();
        setLocalError(found);
        if (!found) onSubmit(values);
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <label className="block text-sm" htmlFor={`${idPrefix}-name`}>
            Name
          </label>
          <input
            id={`${idPrefix}-name`}
            className="mt-1 w-full rounded border px-3 py-2"
            required
            maxLength={80}
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm" htmlFor={`${idPrefix}-amount`}>
            Amount
          </label>
          <input
            id={`${idPrefix}-amount`}
            className="mt-1 w-28 rounded border px-3 py-2"
            inputMode="decimal"
            required
            value={values.amount}
            onChange={(e) => set('amount', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm" htmlFor={`${idPrefix}-currency`}>
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
          <label className="block text-sm" htmlFor={`${idPrefix}-starts`}>
            Starts
          </label>
          <input
            id={`${idPrefix}-starts`}
            type="date"
            className="mt-1 rounded border px-3 py-2"
            required
            value={values.starts_on}
            onChange={(e) => set('starts_on', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm" htmlFor={`${idPrefix}-ends`}>
            Ends
          </label>
          <input
            id={`${idPrefix}-ends`}
            type="date"
            className="mt-1 rounded border px-3 py-2"
            required
            value={values.ends_on}
            onChange={(e) => set('ends_on', e.target.value)}
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm">Categories it covers</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm">
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
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
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

interface BudgetSectionProps {
  budgets: Collection<Budget>;
  categories: Category[];
  currencies: string[];
  defaultCurrency: string;
  onChange: () => void;
}

export function BudgetSection({
  budgets,
  categories,
  currencies,
  defaultCurrency,
  onChange,
}: BudgetSectionProps) {
  const { items, loading, error, reload, setError } = budgets;
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // BudgetCreate requires at least one category id, so there is nothing to
  // create until one exists. Better to say so than to offer a form that 422s.
  const blocked = categories.length === 0;

  async function run(action: () => Promise<unknown>, fallback: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      onChange();
      return true;
    } catch (err: unknown) {
      setError(describeError(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function payload(values: BudgetValues) {
    return {
      name: values.name.trim(),
      amount: values.amount.trim(),
      currency: values.currency,
      starts_on: values.starts_on,
      ends_on: values.ends_on,
      category_ids: values.category_ids,
    };
  }

  async function handleCreate(values: BudgetValues) {
    const created = await run(
      () => api.post('/finance/budgets', payload(values)),
      'Could not save that budget.'
    );
    if (created) setAdding(false);
  }

  async function handleUpdate(id: string, values: BudgetValues) {
    const updated = await run(
      () => api.patch(`/finance/budgets/${id}`, payload(values)),
      'Could not update that budget.'
    );
    if (updated) setEditingId(null);
  }

  const thisMonth = monthRange();

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Budgets</h2>
        <button
          type="button"
          disabled={blocked}
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
          onClick={() => {
            setEditingId(null);
            setAdding((open) => !open);
          }}
        >
          {adding ? 'Cancel' : 'New budget'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-3 rounded-lg border border-gray-200">
        {adding && !blocked && (
          <BudgetForm
            idPrefix="new-budget"
            initial={{
              name: '',
              amount: '',
              currency: defaultCurrency,
              starts_on: thisMonth.start,
              ends_on: thisMonth.end,
              category_ids: [],
            }}
            categories={categories}
            currencies={currencies}
            busy={busy}
            onSubmit={(values) => void handleCreate(values)}
            onCancel={() => setAdding(false)}
          />
        )}

        {loading ? (
          <p className="p-6 text-center text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          !adding && (
            <p className="p-6 text-center text-sm text-gray-500">
              {blocked
                ? 'Add a category first — a budget caps spending across categories.'
                : 'No budgets yet. A budget caps spending across one or more categories.'}
            </p>
          )
        ) : (
          <ul className="divide-y divide-gray-200">
            {items.map((budget) =>
              editingId === budget.id ? (
                <li key={budget.id}>
                  <BudgetForm
                    idPrefix={`budget-${budget.id}`}
                    initial={{
                      name: budget.name,
                      amount: budget.amount,
                      currency: budget.currency,
                      starts_on: budget.starts_on,
                      ends_on: budget.ends_on,
                      category_ids: budget.categories.map((category) => category.id),
                    }}
                    categories={categories}
                    currencies={currencies}
                    busy={busy}
                    onSubmit={(values) => void handleUpdate(budget.id, values)}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li key={budget.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{budget.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(budget.starts_on)} – {formatDate(budget.ends_on)}
                      {budget.categories.length > 0 && (
                        <>
                          {' · '}
                          {budget.categories.map((category) => category.name).join(', ')}
                        </>
                      )}
                    </p>
                  </div>

                  <span className="w-32 shrink-0 text-right text-sm font-medium">
                    {formatMoney(budget.amount, budget.currency)}
                  </span>

                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => {
                      setAdding(false);
                      setEditingId(budget.id);
                    }}
                  >
                    Edit
                  </button>
                  <DeleteButton
                    prompt="Delete this budget?"
                    busy={busy}
                    onConfirm={() =>
                      void run(
                        () => api.delete(`/finance/budgets/${budget.id}`),
                        'Could not delete that budget.'
                      )
                    }
                  />
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
