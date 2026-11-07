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
import type { Category } from '@/lib/types/finance';
import { CategorySection } from '@/components/finance/category-section';

// The page owns the collection now — the expense and budget forms read the same
// one — so the test stands in for the page.
function Harness({ onChange = () => {} }: { onChange?: () => void }) {
  const categories = useCollection<Category>('/finance/categories');
  return <CategorySection categories={categories} onChange={onChange} />;
}

const FOOD = { id: 'c1', name: 'Food', colour: '#22c55e', created_at: '2026-08-01T00:00:00Z' };
const RENT = { id: 'c2', name: 'Rent', colour: '#ef4444', created_at: '2026-08-01T00:00:00Z' };

afterEach(() => vi.clearAllMocks());

describe('CategorySection', () => {
  it('lists what the API returns', async () => {
    get.mockResolvedValue([FOOD, RENT]);
    render(<Harness />);

    expect(await screen.findByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();
  });

  it('explains the ordering when a new user has none', async () => {
    get.mockResolvedValue([]);
    render(<Harness />);

    // Budgets require at least one category, so the empty state has to say so.
    expect(await screen.findByText(/create one before setting a budget/i)).toBeInTheDocument();
  });

  it('creates a category and refetches rather than guessing the new list', async () => {
    get.mockResolvedValueOnce([]).mockResolvedValueOnce([FOOD]);
    post.mockResolvedValue(FOOD);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'New category' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Food' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/finance/categories', {
        name: 'Food',
        colour: '#94a3b8',
        // None picked: the badge keeps the initial.
        icon: null,
      })
    );
    expect(await screen.findByText('Food')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('draws each symbol, and the initial for none or for a key this app does not know', async () => {
    get.mockResolvedValue([
      { ...FOOD, icon: 'food' },
      { ...RENT, icon: null },
      { ...FOOD, id: 'c3', name: 'Car wash', icon: 'car-wash' },
    ]);
    const { container } = render(<Harness />);
    await screen.findByText('Food');

    // Each row leads with its badge: the symbol's key when it draws one, else its initial.
    const symbols = [...container.querySelectorAll('li')].map((row) => {
      const badge = row.firstElementChild;
      return badge?.getAttribute('data-symbol') ?? badge?.textContent;
    });
    expect(symbols).toEqual(['food', 'R', 'C']);
  });

  it('creates a category with the symbol picked', async () => {
    get.mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...FOOD, icon: 'groceries' }]);
    post.mockResolvedValue({ ...FOOD, icon: 'groceries' });
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'New category' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Food' } });
    // A radio group: the person picks by name, and a screen reader hears it.
    expect(screen.getByRole('radio', { name: 'No symbol — show the initial' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Groceries' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/finance/categories',
        expect.objectContaining({ name: 'Food', icon: 'groceries' })
      )
    );
  });

  it('edits with the current symbol chosen, and None clears it', async () => {
    get.mockResolvedValue([{ ...FOOD, icon: 'food' }]);
    patch.mockResolvedValue({ ...FOOD, icon: null });
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rename Food' }));
    expect(screen.getByRole('radio', { name: 'Food' })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: 'No symbol — show the initial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/finance/categories/c1',
        expect.objectContaining({ icon: null })
      )
    );
  });

  it('turns a duplicate name into something a person can act on', async () => {
    get.mockResolvedValue([FOOD]);
    post.mockRejectedValue(
      new ApiError(409, { code: 'CATEGORY_NAME_TAKEN', message: "A category named 'Food' exists." })
    );
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'New category' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Food' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already have a category with that name/i
    );
  });

  it('renames through PATCH, carrying the colour it did not touch', async () => {
    get.mockResolvedValue([FOOD]);
    patch.mockResolvedValue({ ...FOOD, name: 'Groceries' });
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /^Rename / }));
    fireEvent.change(screen.getByLabelText('Rename Food'), { target: { value: 'Groceries' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // The form is seeded from the row, so a rename sends the existing colour
    // back unchanged rather than dropping it to a default.
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/finance/categories/c1', {
        name: 'Groceries',
        colour: '#22c55e',
      })
    );
  });

  it('recolours an existing category, not just a new one', async () => {
    get.mockResolvedValue([FOOD]);
    patch.mockResolvedValue({ ...FOOD, colour: '#000000' });
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /^Rename / }));
    // Seeded from the row, so opening the editor shows the colour it has.
    const picker = screen.getByLabelText('Colour for Food');
    expect(picker).toHaveValue('#22c55e');

    fireEvent.change(picker, { target: { value: '#000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/finance/categories/c1', {
        name: 'Food',
        colour: '#000000',
      })
    );
  });

  it('warns that deleting uncategorises expenses, and needs a second click', async () => {
    get.mockResolvedValue([FOOD]);
    del.mockResolvedValue(undefined);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /^Delete / }));
    expect(screen.getByText(/expenses become uncategorised/i)).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/finance/categories/c1'));
  });

  it('backs out of a delete without calling the API', async () => {
    get.mockResolvedValue([FOOD]);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: /^Delete / }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));

    expect(del).not.toHaveBeenCalled();
    expect(screen.queryByText(/expenses become uncategorised/i)).not.toBeInTheDocument();
  });

  it('surfaces a failed load instead of showing an empty list', async () => {
    get.mockRejectedValue(new ApiError(503, { code: 'AUTH_UNAVAILABLE', message: 'Down.' }));
    render(<Harness />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
