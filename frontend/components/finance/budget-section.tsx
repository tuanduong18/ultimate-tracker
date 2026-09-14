'use client';

import { useState } from 'react';

import { BudgetForm, type BudgetValues } from '@/components/finance/budget-form';
import { DeleteButton } from '@/components/finance/delete-button';
import { Panel, PanelButton, PanelNote } from '@/components/finance/panel';
import { api } from '@/lib/api-client';
import { formatDate, monthRange } from '@/lib/dates';
import { describeError, type Collection } from '@/lib/hooks/use-collection';
import { budgetTint } from '@/lib/tint';
import { formatMoney, type BudgetProgress, type Category } from '@/lib/types/finance';

/**
 * How full the bar is drawn, 0–100.
 *
 * The only place this file turns money into a number, and it is for pixels:
 * a bar is a few hundred of them wide, so float error cannot reach the figures
 * either side of it — those stay the strings the API sent.
 */
function barPercent(spent: string, amount: string): number {
  const cap = Number(amount);
  const used = Number(spent);
  if (!Number.isFinite(cap) || !Number.isFinite(used) || cap <= 0) return 0;
  return Math.max(0, Math.min(100, (used / cap) * 100));
}

/**
 * Drop a leading minus so an overspend can be read as "$20.00 over".
 *
 * String surgery rather than `Math.abs`, because the point is to keep showing
 * the exact figure the API sent and only change the word next to it.
 */
function withoutSign(amount: string): string {
  return amount.startsWith('-') ? amount.slice(1) : amount;
}

/**
 * What was paid, what is left, and a bar between them.
 *
 * The bar is green until the cap is passed and red after, rather than shading
 * gradually: "am I over?" is the only question it has to answer at a glance,
 * and a gradient makes 99% and 101% look nearly the same.
 */
function BudgetCard({ budget }: { budget: BudgetProgress }) {
  const percent = barPercent(budget.spent, budget.amount);
  // Read the sign off the string's number rather than recomputing the
  // subtraction: no rounding error flips a sign, and the figures shown stay the
  // strings the API sent.
  const over = Number(budget.remaining) < 0;

  return (
    <>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-fg-muted">Total Paid</p>
          <p className="text-base font-bold">{formatMoney(budget.spent, budget.currency)}</p>
        </div>
        <div className="text-right">
          <p className={`text-xs ${over ? 'text-negative' : 'text-fg-muted'}`}>
            {over ? 'Overshooting' : 'Total Remaining'}
          </p>
          <p className={`text-base font-bold ${over ? 'text-negative' : ''}`}>
            {formatMoney(withoutSign(budget.remaining), budget.currency)}
          </p>
        </div>
      </div>

      <div
        className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-fg/10"
        role="progressbar"
        aria-label={`${budget.name} spent`}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full ${over ? 'bg-negative' : 'bg-positive'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </>
  );
}

interface BudgetSectionProps {
  /**
   * From /finance/budgets/progress, which carries everything the plain budget
   * list does plus what has been spent — so the forms and the bars read from
   * one fetch instead of two lists that can disagree after a write.
   */
  budgets: Collection<BudgetProgress>;
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

  /**
   * Which pastel each budget wears, keyed by id.
   *
   * Assigned in the order the budgets were created, not the order they are
   * listed in. The list is newest-first, so indexing it directly would hand the
   * first colour to whichever budget was made last — and recolour every card
   * below it the moment another is added. By creation order a new budget simply
   * takes the next unused pastel and nothing else moves.
   */
  const tints = new Map(
    [...items]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((budget, index) => [budget.id, budgetTint(index)])
  );
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
    <Panel
      title="Budgets"
      error={error}
      className="h-full"
      action={
        <PanelButton
          disabled={blocked}
          title={blocked ? 'Add a category first' : undefined}
          onClick={() => {
            setEditingId(null);
            setAdding((open) => !open);
          }}
        >
          {adding ? 'Cancel' : 'New budget'}
        </PanelButton>
      }
    >
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
        <PanelNote>Loading…</PanelNote>
      ) : items.length === 0 ? (
        !adding && (
          <PanelNote>
            {blocked
              ? 'Add a category first — a budget caps spending across categories.'
              : 'No budgets yet. A budget caps spending across one or more categories.'}
          </PanelNote>
        )
      ) : (
        <ul className="space-y-3 p-3">
          {items.map((budget) =>
            editingId === budget.id ? (
              <li key={budget.id} className="overflow-hidden rounded-lg border border-border">
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
              <li
                key={budget.id}
                className="rounded-lg p-4"
                style={{ backgroundColor: tints.get(budget.id) }}
              >
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{budget.name}</p>

                  <button
                    type="button"
                    className="shrink-0 text-xs underline"
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
                </div>

                {/* Kept, unlike the mock: budgets here span any range the user
                    picks, so which days a card covers is not a given. */}
                <p className="truncate text-xs text-fg-muted">
                  {formatDate(budget.starts_on)} – {formatDate(budget.ends_on)}
                  {budget.categories.length > 0 && (
                    <>
                      {' · '}
                      {budget.categories.map((category) => category.name).join(', ')}
                    </>
                  )}
                </p>

                <BudgetCard budget={budget} />
              </li>
            )
          )}
        </ul>
      )}
    </Panel>
  );
}
