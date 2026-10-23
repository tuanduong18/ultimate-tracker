import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { get, download, search } = vi.hoisted(() => ({
  get: vi.fn(),
  download: vi.fn(),
  search: { current: '' },
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get, download, post: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.current),
}));

import { AllExpenses } from '@/components/finance/all-expenses';
import type { Expense } from '@/lib/types/finance';
import { FOOD, RENT } from '../../support/finance';

function expense(i: number, overrides: Partial<Expense> = {}): Expense {
  return {
    id: `e${i}`,
    amount: '10.000',
    currency: 'USD',
    category_id: null,
    description: `Row ${i}`,
    spent_on: '2026-08-15',
    created_at: '2026-08-15T00:00:00Z',
    ...overrides,
  };
}

/** Answer the reference-data calls, and serve `rows` in pages like the API. */
function serve(rows: Expense[]) {
  get.mockImplementation(async (path: string) => {
    if (path.startsWith('/finance/categories')) return [FOOD, RENT];
    if (path.startsWith('/finance/currencies')) return ['USD', 'VND'];
    if (path.startsWith('/auth/me')) return { preferred_currency: 'USD' };
    const params = new URLSearchParams(path.split('?')[1]);
    const limit = Number(params.get('limit'));
    const offset = Number(params.get('offset'));
    return rows.slice(offset, offset + limit);
  });
}

beforeEach(() => {
  search.current = '';
  window.history.replaceState(null, '', '/finance/expenses');
});
afterEach(() => vi.clearAllMocks());

describe('AllExpenses', () => {
  it('walks every page of the API, not just the first', async () => {
    serve(Array.from({ length: 501 }, (_, i) => expense(i)));
    render(<AllExpenses />);

    expect(await screen.findByText('501 transactions')).toBeInTheDocument();
    const pages = get.mock.calls
      .map(([path]) => path as string)
      .filter((path) => path.startsWith('/finance/expenses'));
    expect(pages).toEqual([
      '/finance/expenses?limit=500&offset=0',
      '/finance/expenses?limit=500&offset=500',
    ]);
  });

  it('draws fifty rows, then fifty more, without losing focus at the end', async () => {
    serve(Array.from({ length: 60 }, (_, i) => expense(i)));
    render(<AllExpenses />);

    expect(await screen.findByText(/Showing 50 of 60/)).toBeInTheDocument();
    expect(screen.queryByText('Row 55')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show 10 more' }));
    expect(await screen.findByText('Row 55')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more$/ })).toBeNull();
    await waitFor(() => expect(screen.getByText(/Showing 60 of 60/)).toHaveFocus());
  });

  it('filters as you type, says how many match, and keeps it in the URL', async () => {
    serve([
      expense(1, { description: 'Grab ride' }),
      expense(2, { description: 'Lunch', category_id: FOOD.id, amount: '12.500' }),
      expense(3, { description: 'Pho', currency: 'VND', amount: '50000.000' }),
    ]);
    render(<AllExpenses />);
    await screen.findByText('3 transactions');

    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'food' } });

    expect(screen.getByText('1 of 3 transactions')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.queryByText('Grab ride')).toBeNull();
    expect(window.location.search).toBe('?q=food');
  });

  it('totals each currency on its own', async () => {
    serve([
      expense(1, { amount: '0.100' }),
      expense(2, { amount: '0.200' }),
      expense(3, { currency: 'VND', amount: '50000.000' }),
    ]);
    render(<AllExpenses />);

    const status = await screen.findByText(/\+/);
    expect(status.textContent).toMatch(/0\.30/);
    expect(status.textContent).toMatch(/50,000/);
  });

  it('starts from the filters in the URL', async () => {
    search.current = 'q=lunch';
    serve([expense(1, { description: 'Lunch' }), expense(2, { description: 'Taxi' })]);
    render(<AllExpenses />);

    expect(await screen.findByText('1 of 2 transactions')).toBeInTheDocument();
    expect(screen.getByLabelText('Search transactions')).toHaveValue('lunch');
  });

  it('offers a way out when nothing matches', async () => {
    serve([expense(1, { description: 'Lunch' })]);
    render(<AllExpenses />);
    await screen.findByText('1 transaction');

    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'zzz' } });
    expect(screen.getByText('No transactions match these filters.')).toBeInTheDocument();

    const panel = screen.getByText('No transactions match these filters.').parentElement!;
    fireEvent.click(within(panel).getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('switches an amount range to a currency, since amounts only compare within one', async () => {
    serve([expense(1, { amount: '5.000' }), expense(2, { amount: '50.000' })]);
    render(<AllExpenses />);
    await screen.findByText('2 transactions');

    fireEvent.click(screen.getByRole('button', { name: 'Any amount' }));
    fireEvent.change(screen.getByLabelText('At least'), { target: { value: '10' } });

    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
    expect(screen.getByText('1 of 2 transactions')).toBeInTheDocument();
  });

  it('exports every match — not only the rows drawn — with the filters in words', async () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      expense(i, { description: i % 2 ? 'Taxi' : 'Lunch' })
    );
    serve(rows);
    download.mockResolvedValue(new Blob(['xlsx']));
    const createObjectURL = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<AllExpenses />);
    await screen.findByText('60 transactions');
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'taxi' } });

    fireEvent.click(screen.getByRole('button', { name: 'Export 30 transactions to Excel' }));

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const [path, body] = download.mock.calls[0];
    expect(path).toBe('/finance/expenses/export');
    expect(body.expense_ids).toHaveLength(30);
    expect(body.filters).toEqual(['Search: taxi']);
    expect(await screen.findByText(/Exported 30 transactions/)).toBeInTheDocument();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('says so in place when the export fails', async () => {
    serve([expense(1)]);
    download.mockRejectedValue(new Error('boom'));
    render(<AllExpenses />);
    await screen.findByText('1 transaction');

    fireEvent.click(screen.getByRole('button', { name: 'Export 1 transaction to Excel' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not export');
  });

  it('cannot export nothing', async () => {
    serve([]);
    render(<AllExpenses />);

    await screen.findByText('0 transactions');
    expect(screen.getByRole('button', { name: /to Excel$/ })).toBeDisabled();
  });
});
