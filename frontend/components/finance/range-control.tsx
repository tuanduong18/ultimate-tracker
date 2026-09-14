'use client';

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
 * Three ways in, because they answer different questions: the presets for
 * "this week / this month", the arrows for "and the one before that", and the
 * two date fields for anything else. The arrows step by the current range's own
 * length, so they keep working after a hand-picked range — see shiftRange.
 */
interface RangeControlProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
  /** Distinguishes the two controls' input ids when both are on one page. */
  idPrefix: string;
}

function isPreset(range: DateRange, preset: DateRange): boolean {
  return range.start === preset.start && range.end === preset.end;
}

export function RangeControl({ range, onChange, idPrefix }: RangeControlProps) {
  const thisWeek = weekRange();
  const thisMonth = monthRange();

  const presets = [
    { label: 'Week', value: thisWeek },
    { label: 'Month', value: thisMonth },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label="Previous period"
          className="rounded px-2 py-0.5 text-lg leading-none text-primary hover:bg-primary-soft"
          onClick={() => onChange(shiftRange(range, -1))}
        >
          ‹
        </button>

        <p className="min-w-0 text-center text-sm font-semibold">{formatRange(range)}</p>

        <button
          type="button"
          aria-label="Next period"
          className="rounded px-2 py-0.5 text-lg leading-none text-primary hover:bg-primary-soft"
          onClick={() => onChange(shiftRange(range, 1))}
        >
          ›
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs">
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
      </div>
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
