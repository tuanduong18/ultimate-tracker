import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { get, post, patch, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get, post, patch, delete: del } };
});

import { ApiError } from '@/lib/api-client';
import { useCollection } from '@/lib/hooks/use-collection';
import type { Category, Expense } from '@/lib/types/finance';
import { ExpenseSection } from '@/components/finance/expense-section';

const FOOD: Category = {
  id: 'c1',
  name: 'Food',
  colour: '#22c55e',
  created_at: '2026-08-01T00:00:00Z',
};

const LUNCH: Expense = {
  id: 'e1',
  amount: '12.500',
  currency: 'USD',
  category_id: 'c1',
  description: 'Lunch',
  spent_on: '2026-08-12',
  created_at: '2026-08-12T00:00:00Z',
};

const STRAY: Expense = {
  ...LUNCH,
  id: 'e2',
  category_id: null,
  description: null,
  amount: '3.000',
};

function Harness({ onChange = () => {} }: { onChange?: () => void }) {
  const expenses = useCollection<Expense>('/finance/expenses');
  return (
    <ExpenseSection
      expenses={expenses}
      categories={[FOOD]}
      currencies={['USD', 'VND']}
      defaultCurrency="USD"
      onChange={onChange}
    />
  );
}

afterEach(() => vi.clearAllMocks());

describe('ExpenseSection', () => {
  it('resolves the category name, and says so when there is none', async () => {
    get.mockResolvedValue([LUNCH, STRAY]);
    render(<Harness />);

    expect(await screen.findByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    // category_id: null is a real state — a deleted category leaves it behind.
    expect(screen.getByText('Uncategorised')).toBeInTheDocument();
    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('posts the amount as a string and a blank category as null', async () => {
    get.mockResolvedValueOnce([]).mockResolvedValueOnce([LUNCH]);
    post.mockResolvedValue(LUNCH);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add expense' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.50' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/finance/expenses', {
        // A string, not 12.5: the trailing zero is the currency's scale.
        amount: '12.50',
        currency: 'USD',
        category_id: null,
        description: null,
        spent_on: '2026-08-12',
      })
    );
    // The totals above are stale until the parent is told.
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('rejects a malformed amount without spending a round trip', async () => {
    get.mockResolvedValue([]);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add expense' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.5.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/enter an amount like/i);
    expect(post).not.toHaveBeenCalled();
  });

  it('surfaces the field reason from a 422 rather than "Request validation failed."', async () => {
    get.mockResolvedValue([]);
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
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add expense' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1000.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/amount: VND amounts take at most 0 decimal place/i);
    expect(alert).not.toHaveTextContent(/Request validation failed/i);
  });

  it('prefills the edit form from the row and patches it', async () => {
    get.mockResolvedValue([LUNCH]);
    patch.mockResolvedValue({ ...LUNCH, description: 'Dinner' });
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Description')).toHaveValue('Lunch');
    expect(screen.getByLabelText('Amount')).toHaveValue('12.500');

    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Dinner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/finance/expenses/e1',
        expect.objectContaining({ description: 'Dinner', amount: '12.500', category_id: 'c1' })
      )
    );
  });

  it('needs a second click to delete', async () => {
    get.mockResolvedValue([LUNCH]);
    del.mockResolvedValue(undefined);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(del).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/finance/expenses/e1'));
  });
});
