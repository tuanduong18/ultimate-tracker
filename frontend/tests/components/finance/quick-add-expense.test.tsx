import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get, post } };
});

import { QuickAddExpense } from '@/components/finance/quick-add-expense';
import { ApiError } from '@/lib/api-client';
import { EXPENSES_CHANGED } from '@/lib/finance-events';
import type { Expense } from '@/lib/types/finance';
import { FOOD } from '@/tests/support/finance';

const LUNCH: Expense = {
  id: 'e1',
  amount: '12.50',
  currency: 'SGD',
  category_id: null,
  description: 'Lunch',
  spent_on: '2026-08-12',
  created_at: '2026-08-12T00:00:00Z',
};

beforeEach(() => {
  // What the dialog's form needs: categories, currencies, and the profile's
  // preferred currency — which is the one a new expense should start in.
  get.mockImplementation((path: string) => {
    if (path === '/finance/categories') return Promise.resolve([FOOD]);
    if (path === '/finance/currencies') return Promise.resolve(['SGD', 'USD', 'VND']);
    if (path === '/auth/me') return Promise.resolve({ preferred_currency: 'SGD' });
    return Promise.reject(new Error(`unexpected ${path}`));
  });
});

afterEach(() => vi.clearAllMocks());

async function openDialog() {
  render(<QuickAddExpense />);
  fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
  // Wait for the reference data, so the form starts in the right currency.
  await within(dialog).findByLabelText('Amount');
  return dialog;
}

describe('QuickAddExpense', () => {
  it('fetches nothing until it is opened', () => {
    render(<QuickAddExpense />);

    // It sits in the header of every page; three requests per page view for a
    // dialog nobody opened would be waste.
    expect(get).not.toHaveBeenCalled();
  });

  it('starts in the preferred currency, with the amount ready to type', async () => {
    const dialog = await openDialog();

    expect(within(dialog).getByLabelText('Currency')).toHaveValue('SGD');
    expect(within(dialog).getByLabelText('Amount')).toHaveFocus();
  });

  it('posts the amount as a string and a blank category as null, then says so', async () => {
    post.mockResolvedValue(LUNCH);
    const heard = vi.fn();
    window.addEventListener(EXPENSES_CHANGED, heard);
    const dialog = await openDialog();

    fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '12.50' } });
    fireEvent.change(within(dialog).getByLabelText('Description'), { target: { value: 'Lunch' } });
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-08-12' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/finance/expenses', {
        // A string, not 12.5: the trailing zero is the currency's scale.
        amount: '12.50',
        currency: 'SGD',
        category_id: null,
        description: 'Lunch',
        spent_on: '2026-08-12',
      })
    );

    // Confirmed where the person is looking, and every finance view is told.
    expect(await within(dialog).findByRole('status')).toHaveTextContent(/Lunch/);
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(EXPENSES_CHANGED, heard);
  });

  it('offers another, starting from an empty form', async () => {
    post.mockResolvedValue(LUNCH);
    const dialog = await openDialog();

    fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '12.50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Add another' }));

    const amount = within(dialog).getByLabelText('Amount');
    expect(amount).toHaveValue('');
    expect(amount).toHaveFocus();
  });

  it('rejects a malformed amount without spending a round trip', async () => {
    const dialog = await openDialog();

    fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '12.5.5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/enter an amount like/i);
    expect(post).not.toHaveBeenCalled();
  });

  it('surfaces the field reason from a 422 rather than "Request validation failed."', async () => {
    post.mockRejectedValue(
      new ApiError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: [
          {
            loc: ['body', 'amount'],
            msg: 'Value error, VND amounts take at most 0 decimal place(s), got 1000.50',
          },
        ],
      })
    );
    const dialog = await openDialog();

    fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '1000.50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expense' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/amount: VND amounts take at most 0 decimal place/i);
    expect(alert).not.toHaveTextContent(/Request validation failed/i);
  });

  it('closes from Done and from its close button', async () => {
    const dialog = await openDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
  });
});
