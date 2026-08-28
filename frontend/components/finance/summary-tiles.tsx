'use client';

import type { Resource } from '@/lib/hooks/use-collection';
import { formatMoney, type Summary } from '@/lib/types/finance';

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'over';
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === 'over' ? 'text-red-600' : ''}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
    </div>
  );
}

interface SummaryTilesProps {
  summary: Resource<Summary>;
  /** "August 2026" — the window these totals cover. */
  period: string;
}

/**
 * Spent, budgeted and remaining for the month, in the profile's display currency.
 *
 * Every figure is converted server-side; nothing is added up here. Mixed
 * currencies are the whole reason /finance/summary exists, and summing them in
 * the browser would mean shipping an exchange-rate table to it.
 */
export function SummaryTiles({ summary, period }: SummaryTilesProps) {
  const { data, loading, error } = summary;

  if (error) {
    return (
      <p
        role="alert"
        className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        {error}
      </p>
    );
  }

  const money = (value: string | undefined) =>
    loading || !data ? '—' : formatMoney(value ?? '0', data.currency);

  // Reading the sign off a float is safe in a way that arithmetic on one is not:
  // no rounding error flips a number's sign. The figure shown stays the string.
  const overspent = data !== null && Number(data.remaining) < 0;

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <Tile label="Spent" value={money(data?.spent)} hint={period} />
      <Tile label="Budgeted" value={money(data?.budgeted)} hint="Budgets overlapping this month" />
      <Tile
        label="Remaining"
        value={money(data?.remaining)}
        hint={overspent ? 'Over budget' : 'Budgeted minus spent'}
        tone={overspent ? 'over' : undefined}
      />
    </div>
  );
}
