'use client';

import { useState } from 'react';

import { CurrencySelect } from '@/components/finance/currency-select';
import { DeleteButton } from '@/components/finance/delete-button';
import { api } from '@/lib/api-client';
import { formatDate, todayIso } from '@/lib/dates';
import { describeError, type Collection } from '@/lib/hooks/use-collection';
import { amountProblem, formatMoney, type Category, type Expense } from '@/lib/types/finance';

interface ExpenseValues {
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

function ExpenseForm({
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
      className="flex flex-wrap items-end gap-3 border-b border-gray-200 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const problem = amountProblem(values.amount);
        setLocalError(problem);
        if (!problem) onSubmit(values);
      }}
    >
      <div>
        <label className="block text-sm" htmlFor={`${idPrefix}-amount`}>
          Amount
        </label>
        <input
          id={`${idPrefix}-amount`}
          className="mt-1 w-28 rounded border px-3 py-2"
          // Text, not number: a number input hands back a float, and the trailing
          // zero a currency's scale may depend on does not survive the round trip.
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
        <label className="block text-sm" htmlFor={`${idPrefix}-date`}>
          Date
        </label>
        <input
          id={`${idPrefix}-date`}
          type="date"
          className="mt-1 rounded border px-3 py-2"
          required
          value={values.spent_on}
          onChange={(e) => set('spent_on', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm" htmlFor={`${idPrefix}-category`}>
          Category
        </label>
        <select
          id={`${idPrefix}-category`}
          className="mt-1 rounded border px-3 py-2"
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

      <div className="min-w-40 flex-1">
        <label className="block text-sm" htmlFor={`${idPrefix}-description`}>
          Description
        </label>
        <input
          id={`${idPrefix}-description`}
          className="mt-1 w-full rounded border px-3 py-2"
          maxLength={500}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        Save
      </button>
      <button type="button" className="px-2 py-2 text-sm underline" onClick={onCancel}>
        Cancel
      </button>

      {localError && (
        <p role="alert" className="w-full text-sm text-red-600">
          {localError}
        </p>
      )}
    </form>
  );
}

interface ExpenseSectionProps {
  expenses: Collection<Expense>;
  categories: Category[];
  currencies: string[];
  /** The profile's display currency — the one they most likely spend in. */
  defaultCurrency: string;
  /** Money moved, so the totals above are stale. */
  onChange: () => void;
}

export function ExpenseSection({
  expenses,
  categories,
  currencies,
  defaultCurrency,
  onChange,
}: ExpenseSectionProps) {
  const { items, loading, error, reload, setError } = expenses;
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = new Map(categories.map((category) => [category.id, category]));

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

  /** An empty field means "not filled in", which the API spells as null. */
  function payload(values: ExpenseValues) {
    return {
      amount: values.amount.trim(),
      currency: values.currency,
      category_id: values.category_id || null,
      description: values.description.trim() || null,
      spent_on: values.spent_on,
    };
  }

  async function handleCreate(values: ExpenseValues) {
    const created = await run(
      () => api.post('/finance/expenses', payload(values)),
      'Could not save that expense.'
    );
    if (created) setAdding(false);
  }

  async function handleUpdate(id: string, values: ExpenseValues) {
    const updated = await run(
      () => api.patch(`/finance/expenses/${id}`, payload(values)),
      'Could not update that expense.'
    );
    if (updated) setEditingId(null);
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Recent expenses</h2>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          onClick={() => {
            setEditingId(null);
            setAdding((open) => !open);
          }}
        >
          {adding ? 'Cancel' : 'Add expense'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-3 rounded-lg border border-gray-200">
        {adding && (
          <ExpenseForm
            idPrefix="new-expense"
            initial={{
              amount: '',
              currency: defaultCurrency,
              category_id: '',
              description: '',
              spent_on: todayIso(),
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
          !adding && <p className="p-6 text-center text-sm text-gray-500">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {items.map((expense) =>
              editingId === expense.id ? (
                <li key={expense.id}>
                  <ExpenseForm
                    idPrefix={`expense-${expense.id}`}
                    initial={{
                      amount: expense.amount,
                      currency: expense.currency,
                      category_id: expense.category_id ?? '',
                      description: expense.description ?? '',
                      spent_on: expense.spent_on,
                    }}
                    categories={categories}
                    currencies={currencies}
                    busy={busy}
                    onSubmit={(values) => void handleUpdate(expense.id, values)}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li key={expense.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-28 shrink-0 text-sm text-gray-500">
                    {formatDate(expense.spent_on)}
                  </span>

                  <span className="flex-1 truncate text-sm">
                    {expense.description || <span className="text-gray-400">No description</span>}
                  </span>

                  <span className="flex items-center gap-2 text-sm text-gray-500">
                    <span
                      aria-hidden
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: byId.get(expense.category_id ?? '')?.colour ?? '#e5e7eb',
                      }}
                    />
                    {byId.get(expense.category_id ?? '')?.name ?? 'Uncategorised'}
                  </span>

                  <span className="w-32 shrink-0 text-right text-sm font-medium">
                    {formatMoney(expense.amount, expense.currency)}
                  </span>

                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => {
                      setAdding(false);
                      setEditingId(expense.id);
                    }}
                  >
                    Edit
                  </button>
                  <DeleteButton
                    prompt="Delete this expense?"
                    busy={busy}
                    onConfirm={() =>
                      void run(
                        () => api.delete(`/finance/expenses/${expense.id}`),
                        'Could not delete that expense.'
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
