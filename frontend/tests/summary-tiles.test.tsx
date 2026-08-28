import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Resource } from '@/lib/hooks/use-collection';
import type { Summary } from '@/lib/types/finance';
import { SummaryTiles } from '@/components/finance/summary-tiles';

function resource(overrides: Partial<Resource<Summary>>): Resource<Summary> {
  return {
    data: null,
    loading: false,
    error: null,
    reload: vi.fn(async () => {}),
    setError: vi.fn(),
    ...overrides,
  };
}

const AUGUST: Summary = {
  currency: 'SGD',
  starts_on: '2026-08-01',
  ends_on: '2026-08-31',
  spent: '420.50',
  budgeted: '400.00',
  remaining: '-20.50',
};

describe('SummaryTiles', () => {
  it('shows the totals in the display currency the server converted to', () => {
    render(<SummaryTiles summary={resource({ data: AUGUST })} period="August 2026" />);

    // Every figure arrives already converted; nothing is summed in the browser.
    expect(screen.getByText(/420\.50/)).toBeInTheDocument();
    expect(screen.getByText(/400\.00/)).toBeInTheDocument();
  });

  it('calls out an overspend rather than clamping it at zero', () => {
    render(<SummaryTiles summary={resource({ data: AUGUST })} period="August 2026" />);

    expect(screen.getByText('Over budget')).toBeInTheDocument();
    // The minus sign has to survive: 420.50 spent against 400 is not "0 left".
    expect(screen.getByText(/-\D*20\.50/)).toBeInTheDocument();
  });

  it('says nothing about money while the fetch is in flight', () => {
    render(<SummaryTiles summary={resource({ loading: true })} period="August 2026" />);

    // Em dashes, not zeros: "0 spent" is a claim, and it would be a false one.
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('replaces the tiles with the reason when rates are unavailable', () => {
    render(
      <SummaryTiles
        summary={resource({ error: 'Exchange rates are unavailable right now.' })}
        period="August 2026"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/exchange rates are unavailable/i);
    expect(screen.queryByText('Spent')).not.toBeInTheDocument();
  });
});
