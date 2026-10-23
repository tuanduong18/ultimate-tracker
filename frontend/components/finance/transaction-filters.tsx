'use client';

import clsx from 'clsx';
import { Search } from 'lucide-react';

import { CategoryFilter } from '@/components/finance/category-filter';
import { FilterMenu } from '@/components/finance/filter-menu';
import {
  amountLabel,
  amountUnreadable,
  boundsInverted,
  dateLabel,
  datePresets,
  isFiltered,
  NO_FILTERS,
  type TransactionFilters,
} from '@/components/finance/transaction-query';
import type { Category } from '@/lib/types/finance';

interface FilterBarProps {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  categories: Category[];
  currencies: string[];
  /** What an amount range is in until someone picks otherwise. */
  defaultCurrency: string;
}

/**
 * Search and filters for the Transactions tab.
 *
 * Search gets the full width of its own line because it is what people reach
 * for first ("where did that 40 go?"); the filters are pills on the line
 * under it, each closed by default and labelled with its current value, so
 * the row reads as a sentence of what is shown — "Last month · Categories ·
 * 1 hidden · S$10.00 – S$50.00" — and costs one line while nothing is set.
 *
 * Everything applies as it changes, search included: filtering runs in the
 * browser, so there is no request to wait for and no reason for an Apply
 * button that would let the list fall out of step with the controls.
 */
export function TransactionFilterBar({
  filters,
  onChange,
  categories,
  currencies,
  defaultCurrency,
}: FilterBarProps) {
  return (
    <div className="space-y-2">
      <div role="search" className="relative">
        <label htmlFor="transactions-search" className="sr-only">
          Search transactions
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
        />
        <input
          id="transactions-search"
          type="search"
          // An invitation, not a label: the label is there for screen readers,
          // and the icon says "search" to everyone else.
          placeholder="Search description, category, date or amount"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-border-control bg-surface py-2 pr-3 pl-9 text-sm"
          value={filters.q}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DateFilter filters={filters} onChange={onChange} />
        <CategoryFilter
          idPrefix="transactions"
          align="start"
          categories={categories}
          selection={filters.categories}
          onChange={(selection) => onChange({ ...filters, categories: selection })}
        />
        <AmountFilter
          filters={filters}
          onChange={onChange}
          currencies={currencies}
          defaultCurrency={defaultCurrency}
        />
        {isFiltered(filters) && (
          <button
            type="button"
            className="px-1 text-xs text-primary underline pointer-coarse:min-h-11"
            onClick={() => onChange(NO_FILTERS)}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * When. Presets for the questions people actually ask, two open-ended date
 * fields for the rest — either can be left empty ("everything since March").
 */
function DateFilter({
  filters,
  onChange,
}: {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
}) {
  const set = (start: string, end: string) => onChange({ ...filters, start, end });
  const anyTime = !filters.start && !filters.end;

  return (
    <FilterMenu label={dateLabel(filters)} active={!anyTime}>
      <div className="flex flex-wrap gap-1.5">
        <Chip pressed={anyTime} onClick={() => set('', '')}>
          Any time
        </Chip>
        {datePresets().map((preset) => (
          <Chip
            key={preset.label}
            pressed={filters.start === preset.range.start && filters.end === preset.range.end}
            onClick={() => set(preset.range.start, preset.range.end)}
          >
            {preset.label}
          </Chip>
        ))}
      </div>

      <fieldset className="mt-3 grid grid-cols-2 gap-2">
        <legend className="sr-only">Custom dates</legend>
        <label className="block">
          <span className="text-fg-muted">From</span>
          <input
            type="date"
            className="mt-1 w-full min-w-0 rounded-md border bg-surface px-1.5 py-1"
            value={filters.start}
            max={filters.end || undefined}
            onChange={(event) => set(event.target.value, filters.end)}
          />
        </label>
        <label className="block">
          <span className="text-fg-muted">To</span>
          <input
            type="date"
            className="mt-1 w-full min-w-0 rounded-md border bg-surface px-1.5 py-1"
            value={filters.end}
            min={filters.start || undefined}
            onChange={(event) => set(filters.start, event.target.value)}
          />
        </label>
      </fieldset>
    </FilterMenu>
  );
}

/**
 * How much. A range only means something in one currency — "over 50" is a
 * different filter in SGD and in VND — so the range always has one: typing a
 * bound while "Any currency" is picked switches to the default currency,
 * visibly, in the select above the fields. Comparing after converting instead
 * would make which rows match change with the exchange rate.
 */
function AmountFilter({
  filters,
  onChange,
  currencies,
  defaultCurrency,
}: {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  currencies: string[];
  defaultCurrency: string;
}) {
  // A currency from a bookmarked link that has since left the list still shows.
  const options =
    !filters.currency || currencies.includes(filters.currency)
      ? currencies
      : [filters.currency, ...currencies];

  function setBound(key: 'min' | 'max', raw: string) {
    onChange({ ...filters, [key]: raw, currency: filters.currency || defaultCurrency });
  }

  const unreadable = 'Enter a number, like 12.50.';
  const minProblem = amountUnreadable(filters.min) ? unreadable : null;
  const maxProblem = amountUnreadable(filters.max)
    ? unreadable
    : boundsInverted(filters)
      ? 'Make this at least the lower amount.'
      : null;

  return (
    <FilterMenu label={amountLabel(filters)} active={Boolean(filters.currency)}>
      <label className="block">
        <span className="text-fg-muted">Currency</span>
        <select
          className="mt-1 w-full rounded-md border bg-surface px-1.5 py-1"
          value={filters.currency}
          onChange={(event) =>
            onChange(
              event.target.value
                ? { ...filters, currency: event.target.value }
                : // No currency, no range: a range left behind would be
                  // invisible in the label but still narrowing the list.
                  { ...filters, currency: '', min: '', max: '' }
            )
          }
        >
          <option value="">Any currency</option>
          {options.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <AmountField
          id="transactions-min"
          label="At least"
          value={filters.min}
          problem={minProblem}
          onChange={(raw) => setBound('min', raw)}
        />
        <AmountField
          id="transactions-max"
          label="At most"
          value={filters.max}
          problem={maxProblem}
          onChange={(raw) => setBound('max', raw)}
        />
      </div>
      <p className="mt-2 text-fg-muted">Compared in the currency each expense was spent in.</p>
    </FilterMenu>
  );
}

function AmountField({
  id,
  label,
  value,
  problem,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  problem: string | null;
  onChange: (raw: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-fg-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={clsx(
          'mt-1 w-full min-w-0 rounded-md border bg-surface px-1.5 py-1 tabular-nums',
          problem && 'border-negative'
        )}
        value={value}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-problem` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {/* Only ever after typing — an empty field is never an error. The bound
          is ignored until fixed, and the pill's label leaves it out. */}
      {problem && (
        <p id={`${id}-problem`} className="mt-1 text-negative">
          <span className="sr-only">Error: </span>
          {problem}
        </p>
      )}
    </div>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={clsx(
        'rounded-full px-2.5 py-1 pointer-coarse:min-h-11 pointer-coarse:px-4',
        pressed ? 'bg-primary text-primary-fg' : 'bg-primary-soft text-fg hover:opacity-80'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
