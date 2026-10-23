'use client';

import { Download, SearchX } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';

import { ExpenseSection } from '@/components/finance/expense-section';
import { PanelButton, PanelEmpty } from '@/components/finance/panel';
import { TransactionFilterBar } from '@/components/finance/transaction-filters';
import {
  describeFilters,
  fromParams,
  isFiltered,
  matcher,
  NO_FILTERS,
  toParams,
  totalsByCurrency,
  type TransactionFilters,
} from '@/components/finance/transaction-query';
import { api } from '@/lib/api-client';
import { todayIso } from '@/lib/dates';
import { useExpensesChanged } from '@/lib/finance-events';
import { describeError, fetchEveryPage, useCollection } from '@/lib/hooks/use-collection';
import { useFinanceBasics } from '@/lib/hooks/use-finance-basics';
import { formatMoney, type Expense } from '@/lib/types/finance';

/**
 * Rows drawn at a time. Filtering covers every expense; drawing is what has
 * a cost, and nobody reads past fifty rows without narrowing the list first.
 */
const PAGE_SIZE = 50;

type ExportState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; count: number }
  | { kind: 'failed'; message: string };

/**
 * The Transactions tab: every expense, newest first, searchable and filterable,
 * and exportable as exactly what is on screen.
 *
 * Fetches every expense once and filters in the browser — one person's
 * expenses stay in the thousands, so a filter answers on the keystroke with
 * no request behind it. The filters live in the URL as well, so a filtered
 * view survives a reload and can be bookmarked.
 *
 * Nothing on this page is an aggregate the server keeps, so its own writes
 * leave nothing else stale; an expense added from the header is picked up.
 */
export function AllExpenses() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<TransactionFilters>(() =>
    fromParams(new URLSearchParams(searchParams.toString()))
  );
  const expenses = useCollection<Expense>('/finance/expenses', fetchEveryPage);
  const { categories, currencies, defaultCurrency } = useFinanceBasics();

  useExpensesChanged(expenses.reload);
  const onChange = useCallback(() => {}, []);

  const matching = useMemo(
    () => expenses.items.filter(matcher(filters, categories.items)),
    [expenses.items, filters, categories.items]
  );

  // How many rows are drawn, remembered with the filters it was for: new
  // filters start again from one page, in the same render.
  const [drawn, setDrawn] = useState({ filters, count: PAGE_SIZE });
  const count = drawn.filters === filters ? drawn.count : PAGE_SIZE;
  const remaining = matching.length - Math.min(count, matching.length);
  const footerNote = useRef<HTMLParagraphElement>(null);

  const [exported, setExported] = useState<ExportState>({ kind: 'idle' });

  function update(next: TransactionFilters) {
    setFilters(next);
    setExported({ kind: 'idle' });
    // replaceState, not push: each keystroke in search is not a page in history.
    const query = toParams(next).toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }

  function showMore() {
    // The button goes away with the last page; focus must not go with it.
    if (remaining <= PAGE_SIZE) requestAnimationFrame(() => footerNote.current?.focus());
    setDrawn({ filters, count: count + PAGE_SIZE });
  }

  async function exportToExcel() {
    setExported({ kind: 'busy' });
    try {
      const file = await api.download('/finance/expenses/export', {
        expense_ids: matching.map((expense) => expense.id),
        filters: describeFilters(filters, categories.items),
      });
      saveFile(file, `transactions-${todayIso()}.xlsx`);
      setExported({ kind: 'done', count: matching.length });
    } catch (err: unknown) {
      setExported({
        kind: 'failed',
        message: describeError(err, 'Could not export these transactions. Try again.'),
      });
    }
  }

  const filtered = isFiltered(filters);
  const totals = totalsByCurrency(matching);
  const noun = (n: number) => `${n.toLocaleString()} transaction${n === 1 ? '' : 's'}`;

  return (
    <ExpenseSection
      expenses={{ ...expenses, items: matching }}
      limit={count}
      categories={categories.items}
      currencies={currencies}
      onChange={onChange}
      title="All expenses"
      action={
        <PanelButton
          // The whole match, not just the rows drawn so far — the label says
          // how many, so nobody expects a file of fifty.
          label={`Export ${noun(matching.length)} to Excel`}
          title={`Export ${noun(matching.length)} to Excel`}
          disabled={expenses.loading || matching.length === 0 || exported.kind === 'busy'}
          onClick={() => void exportToExcel()}
        >
          <span className="inline-flex items-center gap-1.5">
            <Download aria-hidden className="size-3.5" />
            {exported.kind === 'busy' ? 'Exporting…' : 'Export to Excel'}
          </span>
        </PanelButton>
      }
      header={
        <div className="space-y-2">
          <TransactionFilterBar
            filters={filters}
            onChange={update}
            categories={categories.items}
            currencies={currencies}
            defaultCurrency={defaultCurrency}
          />
          {!expenses.loading && !expenses.error && (
            <p role="status" className="text-xs text-fg-muted">
              <span className="font-medium text-fg">
                {filtered
                  ? `${matching.length.toLocaleString()} of ${noun(expenses.items.length)}`
                  : noun(matching.length)}
              </span>
              {totals.length > 0 && (
                <>
                  <span aria-hidden> · </span>
                  {/* One figure per currency: exact, where a converted total
                      would be an estimate. */}
                  <span className="tabular-nums">
                    {totals.map((t) => formatMoney(t.total, t.currency)).join(' + ')}
                  </span>
                </>
              )}
            </p>
          )}
          {exported.kind === 'done' && (
            <p role="status" className="text-xs text-fg-muted">
              Exported {noun(exported.count)}. Check your downloads.
            </p>
          )}
          {exported.kind === 'failed' && (
            <p role="alert" className="text-xs text-negative">
              {exported.message}
            </p>
          )}
        </div>
      }
      empty={
        filtered && expenses.items.length > 0 ? (
          <PanelEmpty
            icon={SearchX}
            action={
              <button
                type="button"
                className="text-sm text-primary underline pointer-coarse:min-h-11"
                onClick={() => update(NO_FILTERS)}
              >
                Clear filters
              </button>
            }
          >
            No transactions match these filters.
          </PanelEmpty>
        ) : undefined
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-fg-muted">
          <p ref={footerNote} tabIndex={-1} className="focus:outline-none">
            Showing {Math.min(count, matching.length).toLocaleString()} of {noun(matching.length)}
          </p>
          {remaining > 0 && (
            <button
              type="button"
              className="rounded-lg border px-3 py-1.5 font-medium text-fg hover:bg-primary-soft pointer-coarse:min-h-11"
              onClick={showMore}
            >
              Show {Math.min(PAGE_SIZE, remaining)} more
            </button>
          )}
        </div>
      }
    />
  );
}

/** Hand a fetched file to the browser's own download, then let the memory go. */
function saveFile(file: Blob, name: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // After the click has been handled, not during it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
