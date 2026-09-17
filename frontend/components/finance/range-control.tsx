'use client';

import type { ReactNode } from 'react';

import {
  formatRange,
  monthRange,
  rangeLength,
  shiftRange,
  weekRange,
  type DateRange,
} from '@/lib/dates';

/**
 * Pick the window a chart covers.
 *
 * Split in two so a panel can put the half people read — which window am I
 * looking at — on the same line as its title, and the half people only
 * occasionally touch on a line of its own. Three stacked rows of chrome above a
 * chart left less room for the chart than for the controls.
 */
interface RangeProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
}

/** The current window and the arrows either side, for a panel's title row. */
export function RangeNav({ range, onChange }: RangeProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous period"
        className="rounded px-1.5 text-lg leading-none text-primary hover:bg-primary-soft"
        onClick={() => onChange(shiftRange(range, -1))}
      >
        ‹
      </button>

      <p className="text-sm font-semibold whitespace-nowrap">{formatRange(range)}</p>

      <button
        type="button"
        aria-label="Next period"
        className="rounded px-1.5 text-lg leading-none text-primary hover:bg-primary-soft"
        onClick={() => onChange(shiftRange(range, 1))}
      >
        ›
      </button>
    </div>
  );
}

function isPreset(range: DateRange, preset: DateRange): boolean {
  return range.start === preset.start && range.end === preset.end;
}

/**
 * Presets and the two date fields, plus whatever else the panel filters by.
 *
 * The presets answer "this week / this month" and the fields anything else;
 * the arrows in RangeNav step by the current range's own length, so they keep
 * working after a hand-picked range — see shiftRange.
 */
export function RangeControls({
  range,
  onChange,
  idPrefix,
  children,
}: RangeProps & { idPrefix: string; children?: ReactNode }) {
  const presets = [
    { label: 'Week', value: weekRange() },
    { label: 'Month', value: monthRange() },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          aria-pressed={isPreset(range, preset.value)}
          className={`rounded-full px-2.5 py-1 ${
            isPreset(range, preset.value)
              ? 'bg-primary text-primary-fg'
              : 'bg-primary-soft text-fg hover:opacity-80'
          }`}
          onClick={() => onChange(preset.value)}
        >
          {preset.label}
        </button>
      ))}

      <label className="sr-only" htmlFor={`${idPrefix}-start`}>
        Range start
      </label>
      <input
        id={`${idPrefix}-start`}
        type="date"
        className="rounded border bg-surface px-1.5 py-0.5"
        value={range.start}
        max={range.end}
        onChange={(e) => e.target.value && onChange({ ...range, start: e.target.value })}
      />

      <span aria-hidden className="text-fg-muted">
        –
      </span>

      <label className="sr-only" htmlFor={`${idPrefix}-end`}>
        Range end
      </label>
      <input
        id={`${idPrefix}-end`}
        type="date"
        className="rounded border bg-surface px-1.5 py-0.5"
        value={range.end}
        min={range.start}
        onChange={(e) => e.target.value && onChange({ ...range, end: e.target.value })}
      />

      {/* The category filter sits here rather than up by the title: it narrows
          the same thing the dates do, and belongs with them. */}
      {children && <div className="ml-auto">{children}</div>}
    </div>
  );
}

/**
 * Bar width for a range: days while that stays readable, weeks beyond.
 *
 * Chosen here rather than by the user because it is a consequence of the range
 * they already picked. Ten weeks of daily bars is seventy of them, each a pixel
 * wide, which answers nothing.
 */
export function granularityFor(range: DateRange): 'day' | 'week' {
  return rangeLength(range) <= 31 ? 'day' : 'week';
}
