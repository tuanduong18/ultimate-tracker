'use client';

import { CircleCheck, Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { ExpenseForm, expensePayload, type ExpenseValues } from '@/components/finance/expense-form';
import { PanelNote } from '@/components/finance/panel';
import { api } from '@/lib/api-client';
import { todayIso } from '@/lib/dates';
import { announceExpensesChange } from '@/lib/finance-events';
import { describeError } from '@/lib/hooks/use-collection';
import { useFinanceBasics } from '@/lib/hooks/use-finance-basics';
import { formatMoney, type Expense } from '@/lib/types/finance';

/**
 * The Add expense button, beside the Finance title on every Finance tab.
 *
 * The app-wide way in is the header's Log menu (LogMenu), which opens the same
 * dialog; this is the one where money is already in view. Different names on
 * purpose — "Log" is every module's, "Add expense" is Finance's — so the two
 * never read as two buttons doing one thing.
 */
export function QuickAddExpense() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg shadow-xs transition-opacity hover:opacity-90"
      >
        <Plus aria-hidden className="size-4" />
        Add expense
      </button>
      <AddExpenseDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * Log one expense, in a dialog with room to breathe.
 *
 * Logging a purchase is the thing people do most in this app and usually do in
 * a hurry — at the till, on a phone. It used to live in the fourth of six
 * panels on the finance page, in a form squeezed into that panel's width. Now
 * it is centred on a desktop and a sheet rising from the bottom on a phone,
 * where the thumb is.
 *
 * Built on a native <dialog> like the navigation drawer: focus moves inside,
 * the page behind goes inert, Escape closes it. Native focus return goes to
 * whatever opened it; a caller whose opener disappears (a menu item) moves
 * focus itself in `onClose`.
 */
export function AddExpenseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      // Escape fires `cancel` then `close`; listening to `close` keeps React's
      // state in step however the dialog was dismissed.
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl border border-border bg-surface p-0 text-fg shadow-xl transition duration-200 ease-out backdrop:bg-black/40 motion-reduce:transition-none max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none max-sm:border-b-0 max-sm:starting:open:translate-y-full sm:starting:open:scale-95 sm:starting:open:opacity-0"
    >
      {open && <AddExpenseBody titleId={titleId} onDone={onClose} />}
    </dialog>
  );
}

function blankExpense(currency: string): ExpenseValues {
  return { amount: '', currency, category_id: '', description: '', spent_on: todayIso() };
}

/**
 * Everything inside the dialog. Mounted only while it is open, so a page with
 * the button does not fetch categories and currencies until someone asks.
 *
 * Success is shown here, in place, rather than in a toast: the dialog is where
 * the person is looking, the message stays until they move on, and "Add
 * another" makes logging a whole receipt's worth one form at a time.
 */
function AddExpenseBody({ titleId, onDone }: { titleId: string; onDone: () => void }) {
  const { loading, categories, currencies, defaultCurrency } = useFinanceBasics();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Expense | null>(null);
  // Bumped for "Add another", so the form remounts empty and focuses its first field.
  const [round, setRound] = useState(0);

  async function submit(values: ExpenseValues) {
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<Expense>('/finance/expenses', expensePayload(values));
      announceExpensesChange();
      setAdded(created);
    } catch (err: unknown) {
      setError(describeError(err, 'Could not save that expense.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <h2 id={titleId} className="text-base font-semibold">
          Add expense
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onDone}
          className="flex size-11 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-muted hover:text-fg"
        >
          <X aria-hidden className="size-5" />
        </button>
      </header>

      {added ? (
        <div className="space-y-5 p-5">
          <p role="status" className="flex items-start gap-3 text-sm">
            <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-positive" />
            <span>
              <span className="font-medium">
                {formatMoney(added.amount, added.currency)}
                {added.description ? ` · ${added.description}` : ''}
              </span>
              <span className="block text-fg-muted">Added to your expenses.</span>
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              // The form that held focus is gone; this is the likeliest next step.
              autoFocus
              onClick={() => {
                setAdded(null);
                setRound((n) => n + 1);
              }}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90"
            >
              Add another
            </button>
            <button
              type="button"
              onClick={onDone}
              className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted"
            >
              Done
            </button>
          </div>
        </div>
      ) : loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : (
        <>
          <ExpenseForm
            key={round}
            idPrefix={`quick-expense-${round}`}
            initial={blankExpense(defaultCurrency)}
            categories={categories.items}
            currencies={currencies}
            busy={busy}
            submitLabel="Add expense"
            className="space-y-4 p-5"
            onSubmit={(values) => void submit(values)}
            onCancel={onDone}
          />
          {error && (
            <p role="alert" className="mx-5 mb-5 text-sm text-negative">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
