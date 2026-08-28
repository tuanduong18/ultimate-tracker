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
import { CategorySection } from '@/components/finance/category-section';

const FOOD = { id: 'c1', name: 'Food', colour: '#22c55e', created_at: '2026-08-01T00:00:00Z' };
const RENT = { id: 'c2', name: 'Rent', colour: '#ef4444', created_at: '2026-08-01T00:00:00Z' };

afterEach(() => vi.clearAllMocks());

describe('CategorySection', () => {
  it('lists what the API returns', async () => {
    get.mockResolvedValue([FOOD, RENT]);
    render(<CategorySection />);

    expect(await screen.findByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();
  });

  it('explains the ordering when a new user has none', async () => {
    get.mockResolvedValue([]);
    render(<CategorySection />);

    // Budgets require at least one category, so the empty state has to say so.
    expect(await screen.findByText(/create one before setting a budget/i)).toBeInTheDocument();
  });

  it('creates a category and refetches rather than guessing the new list', async () => {
    get.mockResolvedValueOnce([]).mockResolvedValueOnce([FOOD]);
    post.mockResolvedValue(FOOD);
    render(<CategorySection />);

    fireEvent.click(await screen.findByRole('button', { name: 'New category' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Food' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/finance/categories', {
        name: 'Food',
        colour: '#94a3b8',
      })
    );
    expect(await screen.findByText('Food')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('turns a duplicate name into something a person can act on', async () => {
    get.mockResolvedValue([FOOD]);
    post.mockRejectedValue(
      new ApiError(409, { code: 'CATEGORY_NAME_TAKEN', message: "A category named 'Food' exists." })
    );
    render(<CategorySection />);

    fireEvent.click(await screen.findByRole('button', { name: 'New category' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Food' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already have a category with that name/i
    );
  });

  it('renames through PATCH', async () => {
    get.mockResolvedValue([FOOD]);
    patch.mockResolvedValue({ ...FOOD, name: 'Groceries' });
    render(<CategorySection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Rename Food'), { target: { value: 'Groceries' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/finance/categories/c1', { name: 'Groceries' })
    );
  });

  it('warns that deleting uncategorises expenses, and needs a second click', async () => {
    get.mockResolvedValue([FOOD]);
    del.mockResolvedValue(undefined);
    render(<CategorySection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/expenses become uncategorised/i)).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/finance/categories/c1'));
  });

  it('backs out of a delete without calling the API', async () => {
    get.mockResolvedValue([FOOD]);
    render(<CategorySection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));

    expect(del).not.toHaveBeenCalled();
    expect(screen.queryByText(/expenses become uncategorised/i)).not.toBeInTheDocument();
  });

  it('surfaces a failed load instead of showing an empty list', async () => {
    get.mockRejectedValue(new ApiError(503, { code: 'AUTH_UNAVAILABLE', message: 'Down.' }));
    render(<CategorySection />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
