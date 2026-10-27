'use client';

import { ChevronLeft, ChevronRight, Pencil, PiggyBank } from 'lucide-react';
import { useState } from 'react';

import { BudgetForm, type BudgetValues } from '@/components/finance/budget-form';
import { DeleteButton } from '@/components/finance/delete-button';
import { IconButton, Panel, PanelButton, PanelEmpty, PanelNote } from '@/components/finance/panel';
import { api } from '@/lib/api-client';
import { formatDate, formatMonth, formatMonthShort, monthStart, shiftMonth } from '@/lib/dates';
import { describeError, type Collection } from '@/lib/hooks/use-collection';
import { useRowFocus } from '@/lib/hooks/use-row-focus';
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
 *
 * A notch marks the early warning, so how close the next alert is can be read
 * off the bar. A gap in the bar's own surface colour rather than a coloured
 * line: it shows on the green, the red and the empty track alike, in either
 * mode. It adds nothing a screen reader needs — the bar's value is read out,
 * and the form says where the warning is.
 */
function BudgetCard({ budget }: { budget: BudgetProgress }) {
  const percent = barPercent(budget.spent, budget.amount);
  const warnAt = budget.warn_at_percent;
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
        className="relative mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-fg/10"
        role="progressbar"
        aria-label={`${budget.name} spent`}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        title={warnAt === null ? undefined : `Warns at ${warnAt}%`}
      >
        <div
          className={`h-full rounded-full ${over ? 'bg-negative' : 'bg-positive'}`}
          style={{ width: `${percent}%` }}
        />
        {warnAt !== null && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-surface"
            style={{ left: `${warnAt}%` }}
          />
        )}
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
  /** The month being viewed, as its first day (YYYY-MM-01). */
  month: string;
  onMonthChange: (month: string) => void;
  categories: Category[];
  currencies: string[];
  defaultCurrency: string;
  onChange: () => void;
}

/**
 * The line under a budget's name: what kind it is and which days it covers.
 *
 * A monthly card names its months ("Since Sep 2026"), since the
 * month on screen is already in the panel header; a custom card names its
 * exact range, which is the whole point of a custom budget.
 */
function scheduleOf(budget: BudgetProgress): string {
  if (budget.period === 'custom') {
    return `${formatDate(budget.starts_on)} – ${formatDate(budget.ends_on ?? budget.starts_on)}`;
  }
  // The badge beside this already says "Monthly"; the line only adds when.
  const from = formatMonthShort(budget.starts_on);
  return budget.ends_on ? `${from} – ${formatMonthShort(budget.ends_on)}` : `Since ${from}`;
}

/**
 * Previous / next month, with a way back to today.
 *
 * Lives in the panel rather than on the page: it chooses which month the
 * budgets are measured in, and nothing else on the page follows it.
 */
function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const current = monthStart();
  return (
    <div className="flex items-center gap-1">
      <IconButton
        label="Previous month"
        icon={ChevronLeft}
        onClick={() => onChange(shiftMonth(month, -1))}
      />
      <p className="min-w-0 flex-1 text-center text-sm font-semibold" aria-live="polite">
        {formatMonth(month)}
      </p>
      <IconButton
        label="Next month"
        icon={ChevronRight}
        onClick={() => onChange(shiftMonth(month, 1))}
      />
      {month !== current && (
        <button
          type="button"
          onClick={() => onChange(current)}
          className="ml-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft pointer-coarse:min-h-11"
        >
          This month
        </button>
      )}
    </div>
  );
}

export function BudgetSection({
  budgets,
  month,
  onMonthChange,
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
  const { panelRef, ...focus } = useRowFocus(items);

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
      period: values.period,
      starts_on: values.starts_on,
      // Empty means "ongoing" for a monthly budget; sent as an explicit null so
      // an edit that clears the last month really clears it.
      ends_on: values.ends_on || null,
      category_ids: values.category_ids,
      // Likewise: null turns the early warning off.
      warn_at_percent: values.warn_at_percent ? Number(values.warn_at_percent) : null,
    };
  }

  async function handleCreate(values: BudgetValues) {
    const created = await run(
      () => api.post('/finance/budgets', payload(values)),
      'Could not save that budget.'
    );
    if (created) {
      focus.returnToAction();
      setAdding(false);
    }
  }

  async function handleUpdate(id: string, values: BudgetValues) {
    const updated = await run(
      () => api.patch(`/finance/budgets/${id}`, payload(values)),
      'Could not update that budget.'
    );
    if (updated) {
      focus.returnToRow(id);
      setEditingId(null);
    }
  }

  async function handleDelete(id: string) {
    focus.removing(id);
    const deleted = await run(
      () => api.delete(`/finance/budgets/${id}`),
      'Could not delete that budget.'
    );
    if (!deleted) focus.cancel();
  }

  return (
    <Panel
      ref={panelRef}
      title="Budgets"
      error={error}
      className="h-full"
      header={<MonthSwitcher month={month} onChange={onMonthChange} />}
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
            // Monthly is the common case; a new one starts in the month on screen.
            period: 'monthly',
            starts_on: month,
            ends_on: '',
            category_ids: [],
            // The server's default, shown so it is a choice rather than a surprise.
            warn_at_percent: '80',
          }}
          categories={categories}
          currencies={currencies}
          busy={busy}
          onSubmit={(values) => void handleCreate(values)}
          onCancel={() => {
            focus.returnToAction();
            setAdding(false);
          }}
        />
      )}

      {loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : items.length === 0 && error ? null : items.length === 0 ? (
        !adding && (
          <PanelEmpty icon={PiggyBank}>
            {blocked
              ? 'Add a category first — a budget caps spending across categories.'
              : `No budgets apply to ${formatMonth(month)}. A monthly budget resets on the 1st; a custom one covers dates you pick.`}
          </PanelEmpty>
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
                    period: budget.period,
                    starts_on: budget.starts_on,
                    ends_on: budget.ends_on ?? '',
                    category_ids: budget.categories.map((category) => category.id),
                    warn_at_percent:
                      budget.warn_at_percent === null ? '' : String(budget.warn_at_percent),
                  }}
                  categories={categories}
                  currencies={currencies}
                  busy={busy}
                  onSubmit={(values) => void handleUpdate(budget.id, values)}
                  onCancel={() => {
                    focus.returnToRow(budget.id);
                    setEditingId(null);
                  }}
                />
              </li>
            ) : (
              <li
                key={budget.id}
                data-row-id={budget.id}
                className={`rounded-lg p-4 ${tints.get(budget.id) ?? ''}`}
              >
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{budget.name}</p>

                  <IconButton
                    label={`Edit ${budget.name}`}
                    icon={Pencil}
                    onClick={() => {
                      setAdding(false);
                      setEditingId(budget.id);
                    }}
                  />
                  <DeleteButton
                    label={`Delete ${budget.name}`}
                    prompt="Delete this budget?"
                    busy={busy}
                    onConfirm={() => void handleDelete(budget.id)}
                  />
                </div>

                <p className="flex items-center gap-1.5 truncate text-xs text-fg-muted">
                  <span className="shrink-0 rounded-full bg-surface/70 px-1.5 py-px text-[11px] font-medium text-fg">
                    {budget.period === 'monthly' ? 'Monthly' : 'Custom'}
                  </span>
                  <span className="truncate">
                    {scheduleOf(budget)}
                    {budget.categories.length > 0 && (
                      <>
                        {' · '}
                        {budget.categories.map((category) => category.name).join(', ')}
                      </>
                    )}
                  </span>
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
