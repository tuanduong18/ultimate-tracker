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

import { useCollection } from '@/lib/hooks/use-collection';
import type { Budget, Category } from '@/lib/types/finance';
import { BudgetSection } from '@/components/finance/budget-section';

const FOOD: Category = {
  id: 'c1',
  name: 'Food',
  colour: '#22c55e',
  created_at: '2026-08-01T00:00:00Z',
};

const GROCERIES: Budget = {
  id: 'b1',
  name: 'Groceries',
  amount: '400.000',
  currency: 'USD',
  starts_on: '2026-08-01',
  ends_on: '2026-08-31',
  categories: [FOOD],
  created_at: '2026-08-01T00:00:00Z',
};

function Harness({ categories = [FOOD] }: { categories?: Category[] }) {
  const budgets = useCollection<Budget>('/finance/budgets');
  return (
    <BudgetSection
      budgets={budgets}
      categories={categories}
      currencies={['USD']}
      defaultCurrency="USD"
      onChange={() => {}}
    />
  );
}

afterEach(() => vi.clearAllMocks());

describe('BudgetSection', () => {
  it('lists a budget with its range and the categories it covers', async () => {
    get.mockResolvedValue([GROCERIES]);
    render(<Harness />);

    expect(await screen.findByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText(/Food/)).toBeInTheDocument();
  });

  it('refuses to offer a form when no category exists to budget against', async () => {
    get.mockResolvedValue([]);
    render(<Harness categories={[]} />);

    // BudgetCreate requires at least one category id, so an enabled button here
    // would only lead to a 422 the user cannot act on.
    expect(await screen.findByRole('button', { name: 'New budget' })).toBeDisabled();
    expect(screen.getByText(/add a category first/i)).toBeInTheDocument();
  });

  it('creates a budget with the categories that were ticked', async () => {
    get.mockResolvedValueOnce([]).mockResolvedValueOnce([GROCERIES]);
    post.mockResolvedValue(GROCERIES);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'New budget' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Groceries' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByLabelText('Food'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/finance/budgets', {
        name: 'Groceries',
        amount: '400',
        currency: 'USD',
        starts_on: '2026-08-01',
        ends_on: '2026-08-31',
        category_ids: ['c1'],
      })
    );
  });

  it('blocks a submit with no category ticked', async () => {
    get.mockResolvedValue([]);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'New budget' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Groceries' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least one category/i);
    expect(post).not.toHaveBeenCalled();
  });

  it('blocks a range that ends before it starts', async () => {
    get.mockResolvedValue([]);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'New budget' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Backwards' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-08-31' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-08-01' } });
    fireEvent.click(screen.getByLabelText('Food'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/on or after the start date/i);
    expect(post).not.toHaveBeenCalled();
  });

  it('sends the whole category set on edit, because PATCH replaces it', async () => {
    get.mockResolvedValue([GROCERIES]);
    patch.mockResolvedValue(GROCERIES);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Food')).toBeChecked();

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '450' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/finance/budgets/b1',
        expect.objectContaining({ amount: '450', category_ids: ['c1'] })
      )
    );
  });

  it('needs a second click to delete', async () => {
    get.mockResolvedValue([GROCERIES]);
    del.mockResolvedValue(undefined);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(del).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/finance/budgets/b1'));
  });
});
