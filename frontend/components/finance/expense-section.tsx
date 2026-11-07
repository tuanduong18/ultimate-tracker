'use client';

import { Pencil, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { CategoryBadge } from '@/components/finance/category-badge';
import { DeleteButton } from '@/components/finance/delete-button';
import { ExpenseForm, expensePayload, type ExpenseValues } from '@/components/finance/expense-form';
import { IconButton, Panel, PanelEmpty, PanelNote } from '@/components/finance/panel';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/dates';
import { describeError, type Collection } from '@/lib/hooks/use-collection';
import { useRowFocus } from '@/lib/hooks/use-row-focus';
import { formatMoney, type Category, type Expense } from '@/lib/types/finance';

interface ExpenseSectionProps {
  expenses: Collection<Expense>;
  categories: Category[];
  currencies: string[];
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
  /** Under the title, outside the scroll area — the Transactions filters. */
  header?: ReactNode;
  /** Title-row actions; replaces See all. */
  action?: ReactNode;
  /** Instead of "Nothing logged yet" when there are rows, just none shown. */
  empty?: ReactNode;
  /** Under the list — Show more. */
  footer?: ReactNode;
}

/**
 * The expense list, as both the dashboard panel and the full page.
 *
 * One component rather than two because the row — category badge, what it
 * was, category and date, amount, and edit/delete on the same line — is the
 * part that has to stay identical between them, and that is exactly the part
 * that drifts when the same markup is written twice.
 *
 * **The row leads with what the expense was** (2026-11-06): its description,
 * or — when it has none — its category, with the line under it shortened to the
 * date. It used to say "No description" in grey, which on a list of quick
 * entries was most rows saying nothing; a blank line instead would leave the
 * row's most prominent place empty and give a screen reader nothing to name it
 * by. The badge in front carries the category's colour and initial, large
 * enough to skim a column by.
 *
 * It edits and deletes but does not add: adding is the Add expense beside the
 * Finance title, on every tab. A second "Add expense" here would put two
 * buttons with one name on the same screen, opening two different forms.
 */
export function ExpenseSection({
  expenses,
  categories,
  currencies,
  onChange,
  title = 'Latest expenses',
  limit,
  seeAllHref,
  header,
  action,
  empty,
  footer,
}: ExpenseSectionProps) {
  const { items, loading, error, reload, setError } = expenses;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { panelRef, ...focus } = useRowFocus(items);

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

  async function handleUpdate(id: string, values: ExpenseValues) {
    const updated = await run(
      () => api.patch(`/finance/expenses/${id}`, expensePayload(values)),
      'Could not update that expense.'
    );
    if (updated) {
      focus.returnToRow(id);
      setEditingId(null);
    }
  }

  async function handleDelete(id: string) {
    focus.removing(id);
    const deleted = await run(
      () => api.delete(`/finance/expenses/${id}`),
      'Could not delete that expense.'
    );
    if (!deleted) focus.cancel();
  }

  return (
    <Panel
      ref={panelRef}
      title={title}
      error={error}
      className="h-full"
      header={header}
      action={
        action ??
        (seeAllHref && (
          <Link
            href={seeAllHref}
            className="inline-flex items-center rounded-sm border px-2 py-1 text-xs whitespace-nowrap hover:bg-primary-soft pointer-coarse:min-h-11 pointer-coarse:px-3"
          >
            See all
          </Link>
        ))
      }
    >
      {loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : shown.length === 0 && error ? null : shown.length === 0 ? (
        (empty ?? (
          <PanelEmpty icon={Receipt}>
            Nothing logged yet. Use Add expense at the top of the page to log one.
          </PanelEmpty>
        ))
      ) : (
        <ul className="space-y-2 p-3">
          {shown.map((expense) => {
            const category = byId.get(expense.category_id ?? '');
            const categoryName = category?.name ?? 'Uncategorised';
            // What the row's buttons call it: its description, or its category and date.
            const name =
              expense.description || `${categoryName} expense, ${formatDate(expense.spent_on)}`;
            return editingId === expense.id ? (
              <li key={expense.id} className="overflow-hidden rounded-lg border border-border">
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
                  onCancel={() => {
                    focus.returnToRow(expense.id);
                    setEditingId(null);
                  }}
                />
              </li>
            ) : (
              <li
                key={expense.id}
                data-row-id={expense.id}
                className="flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2.5"
              >
                <CategoryBadge
                  colour={category?.colour}
                  name={categoryName}
                  icon={category?.icon}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{expense.description || categoryName}</p>
                  <p className="flex items-center gap-1.5 text-xs text-fg-muted">
                    {expense.description && (
                      <>
                        <span className="truncate">{categoryName}</span>
                        <span aria-hidden>·</span>
                      </>
                    )}
                    <span className="whitespace-nowrap">{formatDate(expense.spent_on)}</span>
                  </p>
                </div>

                <span className="shrink-0 text-sm font-medium whitespace-nowrap">
                  {formatMoney(expense.amount, expense.currency)}
                </span>

                <IconButton
                  label={`Edit ${name}`}
                  icon={Pencil}
                  onClick={() => setEditingId(expense.id)}
                />
                <DeleteButton
                  label={`Delete ${name}`}
                  prompt="Delete this expense?"
                  busy={busy}
                  onConfirm={() => void handleDelete(expense.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
      {!loading && shown.length > 0 && footer}
    </Panel>
  );
}
