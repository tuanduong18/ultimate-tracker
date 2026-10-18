/** The range picker shared by both charts, and how it picks a bar width. */

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { granularityFor, RangeControls, RangeNav } from '@/components/finance/range-control';
import type { DateRange } from '@/lib/dates';
import { RANGE } from '@/tests/support/finance';

describe('RangeNav', () => {
  function renderNav(range: DateRange = RANGE) {
    const onChange = vi.fn();
    render(<RangeNav range={range} onChange={onChange} />);
    return onChange;
  }

  it('steps back by the range’s own length', () => {
    const onChange = renderNav();

    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));

    // August is 31 days, so the previous window is the 31 days before it —
    // which is July 1st to 31st, not "last month" by name.
    expect(onChange).toHaveBeenCalledWith({ start: '2026-07-01', end: '2026-07-31' });
  });

  it('steps forward by the same length, including for a hand-picked range', () => {
    const onChange = renderNav({ start: '2026-08-10', end: '2026-08-12' });

    fireEvent.click(screen.getByRole('button', { name: 'Next period' }));

    expect(onChange).toHaveBeenCalledWith({ start: '2026-08-13', end: '2026-08-15' });
  });
});

describe('RangeControls', () => {
  function renderControls(range: DateRange = RANGE) {
    const onChange = vi.fn();
    render(<RangeControls range={range} onChange={onChange} idPrefix="test" />);
    return onChange;
  }

  it('lets either end of the range be typed directly', () => {
    const onChange = renderControls();

    fireEvent.change(screen.getByLabelText('Range start'), { target: { value: '2026-08-15' } });

    expect(onChange).toHaveBeenCalledWith({ start: '2026-08-15', end: '2026-08-31' });
  });

  it('keeps Month selected for any whole calendar month, not just this one', () => {
    renderControls({ start: '2020-01-01', end: '2020-01-31' });

    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps Week selected for any Monday-to-Sunday week', () => {
    renderControls({ start: '2026-08-10', end: '2026-08-16' });

    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('selects neither preset for a hand-picked span', () => {
    renderControls({ start: '2026-08-10', end: '2026-08-20' });

    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('RangeNav with RangeControls', () => {
  function Both({ initial }: { initial: DateRange }) {
    const [range, setRange] = useState(initial);
    return (
      <>
        <RangeNav range={range} onChange={setRange} />
        <RangeControls range={range} onChange={setRange} idPrefix="both" />
      </>
    );
  }

  it('steps a month back to the whole previous month and keeps Month selected', () => {
    render(<Both initial={{ start: '2026-10-01', end: '2026-10-31' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));

    // 1–31 Aug, not the 31-day drift to 31 Jul – 30 Aug.
    expect(screen.getByLabelText('Range start')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('Range end')).toHaveValue('2026-08-31');
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('steps a week to the next Monday-to-Sunday week and keeps Week selected', () => {
    render(<Both initial={{ start: '2026-08-10', end: '2026-08-16' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next period' }));

    expect(screen.getByLabelText('Range start')).toHaveValue('2026-08-17');
    expect(screen.getByLabelText('Range end')).toHaveValue('2026-08-23');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('granularityFor', () => {
  it('uses day bars for a week and a month', () => {
    expect(granularityFor({ start: '2026-08-03', end: '2026-08-09' })).toBe('day');
    expect(granularityFor({ start: '2026-08-01', end: '2026-08-31' })).toBe('day');
  });

  it('switches to week bars once daily ones would be unreadable', () => {
    // A quarter of daily bars is ninety of them, each about a pixel wide.
    expect(granularityFor({ start: '2026-07-01', end: '2026-09-30' })).toBe('week');
  });
});
