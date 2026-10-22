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

function Harness({
  onChange = () => {},
  limit,
  seeAllHref,
}: {
  onChange?: () => void;
  limit?: number;
  seeAllHref?: string;
}) {
  const expenses = useCollection<Expense>('/finance/expenses');
  return (
    <ExpenseSection
      expenses={expenses}
      categories={[FOOD]}
      currencies={['USD', 'VND']}
      onChange={onChange}
      limit={limit}
      seeAllHref={seeAllHref}
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

  it('prefills the edit form from the row and patches it', async () => {
    get.mockResolvedValue([LUNCH]);
    patch.mockResolvedValue({ ...LUNCH, description: 'Dinner' });
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /^Edit / }));
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

    fireEvent.click(await screen.findByRole('button', { name: /^Delete / }));
    expect(del).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/finance/expenses/e1'));
  });
  it('shows only the newest few when the panel caps the list', async () => {
    const older = { ...LUNCH, id: 'e9', description: 'Older' };
    get.mockResolvedValue([LUNCH, older]);
    render(<Harness limit={1} />);

    expect(await screen.findByText('Lunch')).toBeInTheDocument();
    // The API already returns newest first, so the cap is a slice, not a sort.
    expect(screen.queryByText('Older')).not.toBeInTheDocument();
  });

  it('offers See all only where there is somewhere else to see them', async () => {
    get.mockResolvedValue([LUNCH]);
    const { unmount } = render(<Harness limit={10} seeAllHref="/finance/expenses" />);

    const link = await screen.findByRole('link', { name: 'See all' });
    expect(link).toHaveAttribute('href', '/finance/expenses');

    unmount();
    render(<Harness />);
    await waitFor(() => expect(screen.queryByRole('link', { name: 'See all' })).toBeNull());
  });

  describe('keeps focus beside the work, never on <body>', () => {
    const DINNER: Expense = { ...LUNCH, id: 'e3', description: 'Dinner' };

    it('offers "Keep" first, and backs out to the trash icon', async () => {
      get.mockResolvedValue([LUNCH]);
      render(<Harness />);

      fireEvent.click(await screen.findByRole('button', { name: 'Delete Lunch' }));
      expect(screen.getByRole('button', { name: 'Keep' })).toHaveFocus();

      fireEvent.keyDown(screen.getByRole('button', { name: 'Keep' }), { key: 'Escape' });
      expect(screen.getByRole('button', { name: 'Delete Lunch' })).toHaveFocus();
      expect(del).not.toHaveBeenCalled();
    });

    it('moves to the next row once a deleted one is gone', async () => {
      get.mockResolvedValueOnce([LUNCH, DINNER]).mockResolvedValueOnce([DINNER]);
      del.mockResolvedValue(undefined);
      render(<Harness />);

      fireEvent.click(await screen.findByRole('button', { name: 'Delete Lunch' }));
      fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Edit Dinner' })).toHaveFocus()
      );
    });

    it('falls back to the panel heading when the last row goes', async () => {
      get.mockResolvedValueOnce([LUNCH]).mockResolvedValueOnce([]);
      del.mockResolvedValue(undefined);
      render(<Harness />);

      fireEvent.click(await screen.findByRole('button', { name: 'Delete Lunch' }));
      fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));

      // No button in this panel's header (adding lives in the app header), so
      // focus lands on the panel's own heading rather than on <body>.
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Latest expenses' })).toHaveFocus()
      );
    });

    it('starts an edit in its first field, and returns to the row after', async () => {
      get.mockResolvedValue([LUNCH]);
      render(<Harness />);

      fireEvent.click(await screen.findByRole('button', { name: 'Edit Lunch' }));
      expect(screen.getByLabelText('Amount')).toHaveFocus();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Lunch' })).toHaveFocus());
    });
  });

  it('keeps the list on screen while a write reloads it', async () => {
    let finish: (rows: Expense[]) => void = () => {};
    get
      .mockResolvedValueOnce([LUNCH])
      .mockReturnValueOnce(new Promise<Expense[]>((resolve) => (finish = resolve)));
    patch.mockResolvedValue(LUNCH);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Lunch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // The reload is in flight: the panel still shows what it had, not "Loading…".
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Loading…')).toBeNull();

    finish([LUNCH]);
    await waitFor(() => expect(screen.getByText('Lunch')).toBeInTheDocument());
  });
});
