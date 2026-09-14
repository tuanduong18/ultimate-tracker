'use client';

import Link from 'next/link';
import { useState } from 'react';

import { DeleteButton } from '@/components/finance/delete-button';
import { ExpenseForm, type ExpenseValues } from '@/components/finance/expense-form';
import { Panel, PanelButton, PanelNote } from '@/components/finance/panel';
import { api } from '@/lib/api-client';
import { formatDate, todayIso } from '@/lib/dates';
import { describeError, type Collection } from '@/lib/hooks/use-collection';
import { formatMoney, type Category, type Expense } from '@/lib/types/finance';

interface ExpenseSectionProps {
  expenses: Collection<Expense>;
  categories: Category[];
  currencies: string[];
  /** The profile's display currency — the one they most likely spend in. */
  defaultCurrency: string;
  /** Money moved, so the totals and charts around this are stale. */
  onChange: () => void;
  title?: string;
  /**
   * Show only the newest N. The dashboard panel passes 10; the expenses page
   * leaves it off and shows everything the API returned.
   */
  limit?: number;
  /** Where "See all" goes. Omitted on the page that already is "all". */
  seeAllHref?: string;
}

/**
 * The expense list, as both the dashboard panel and the full page.
 *
 * One component rather than two because the row — date, description, category
 * swatch, amount, and edit/delete on the same line — is the part that has to
 * stay identical between them, and that is exactly the part that drifts when
 * the same markup is written twice.
 */
export function ExpenseSection({
  expenses,
  categories,
  currencies,
  defaultCurrency,
  onChange,
  title = 'Latest expenses',
  limit,
  seeAllHref,
}: ExpenseSectionProps) {
  const { items, loading, error, reload, setError } = expenses;
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = new Map(categories.map((category) => [category.id, category]));
  const shown = limit === undefined ? items : items.slice(0, limit);

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
    <Panel
      title={title}
      error={error}
      className="h-full"
      action={
        <>
          <PanelButton
            onClick={() => {
              setEditingId(null);
              setAdding((open) => !open);
            }}
          >
            {adding ? 'Cancel' : 'Add expense'}
          </PanelButton>
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="rounded border px-2 py-1 text-xs whitespace-nowrap hover:bg-gray-50"
            >
              See all
            </Link>
          )}
        </>
      }
    >
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
        <PanelNote>Loading…</PanelNote>
      ) : shown.length === 0 ? (
        !adding && <PanelNote>Nothing logged yet.</PanelNote>
      ) : (
        <ul className="divide-y divide-gray-100">
          {shown.map((expense) =>
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
              <li key={expense.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {expense.description || <span className="text-gray-400">No description</span>}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: byId.get(expense.category_id ?? '')?.colour ?? '#e5e7eb',
                      }}
                    />
                    <span className="truncate">
                      {byId.get(expense.category_id ?? '')?.name ?? 'Uncategorised'}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="whitespace-nowrap">{formatDate(expense.spent_on)}</span>
                  </p>
                </div>

                <span className="shrink-0 text-sm font-medium whitespace-nowrap">
                  {formatMoney(expense.amount, expense.currency)}
                </span>

                <button
                  type="button"
                  className="shrink-0 text-xs underline"
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
    </Panel>
  );
}
