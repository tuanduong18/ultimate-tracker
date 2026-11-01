import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get, put, post: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import { CategorySection } from '@/components/finance/category-section';
import { useCollection } from '@/lib/hooks/use-collection';
import type { Category } from '@/lib/types/finance';

// Arranging is the same in both panels that offer it; the categories panel
// is the smaller host, so it stands in for both here.
function Harness() {
  const categories = useCollection<Category>('/finance/categories');
  return <CategorySection categories={categories} onChange={() => {}} />;
}

const category = (id: string, name: string): Category => ({
  id,
  name,
  colour: '#22c55e',
  created_at: '2026-08-01T00:00:00Z',
});
const FOOD = category('c1', 'Food');
const RENT = category('c2', 'Rent');
const TRAVEL = category('c3', 'Travel');

/** The rows' names, top to bottom. */
function order(): string[] {
  return within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((row) => row.textContent ?? '');
}

async function startArranging() {
  fireEvent.click(await screen.findByRole('button', { name: 'Arrange categories' }));
}

/**
 * jsdom lays nothing out, so give the rows the boxes a browser would: 40px
 * tall, 10px apart, from the top of the viewport.
 */
function layOutRows() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const index = this.dataset.arrangeId
      ? [...(this.parentElement?.children ?? [])].indexOf(this)
      : 0;
    return DOMRect.fromRect({ x: 0, y: index * 50, width: 300, height: 40 });
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('Arranging a list', () => {
  it('is not offered for a single row, which has only one order', async () => {
    get.mockResolvedValue([FOOD]);
    render(<Harness />);

    expect(await screen.findByText('Food')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Arrange categories' })).not.toBeInTheDocument();
  });

  it('moves rows with the arrows, saves the order, and shows what was stored', async () => {
    get.mockResolvedValueOnce([FOOD, RENT, TRAVEL]).mockResolvedValueOnce([TRAVEL, FOOD, RENT]);
    put.mockResolvedValue(undefined);
    render(<Harness />);

    await startArranging();
    // New gives way to Cancel; Arrange became Save order.
    expect(screen.queryByRole('button', { name: 'New category' })).not.toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save order' });

    fireEvent.click(screen.getByRole('button', { name: 'Move Travel up' }));
    expect(order()).toEqual(['Food', 'Travel', 'Rent']);
    // The row moved, and its button with it; focus followed.
    expect(screen.getByRole('button', { name: 'Move Travel up' })).toHaveFocus();
    expect(screen.getByText('Travel moved to 2 of 3.')).toHaveAttribute('role', 'status');

    fireEvent.click(screen.getByRole('button', { name: 'Move Travel up' }));
    expect(order()).toEqual(['Travel', 'Food', 'Rent']);
    // At the top "up" turns off, so focus goes to its partner.
    expect(screen.getByRole('button', { name: 'Move Travel up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Travel down' })).toHaveFocus();

    fireEvent.click(save);
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/finance/categories/order', { ids: ['c3', 'c1', 'c2'] })
    );
    // Back to the usual rows, as the reload returned them.
    expect(await screen.findByRole('button', { name: 'Rename Travel' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
    // Save turned back into Arrange, and focus is on it — even though, as in
    // Safari, the click left focus on an arrow in the list that has now gone.
    expect(save).toHaveAccessibleName('Arrange categories');
    expect(save).toHaveFocus();
    expect(screen.getByText('Order saved.')).toBeInTheDocument();
  });

  it('drops the draft on Cancel and sends nothing', async () => {
    get.mockResolvedValue([FOOD, RENT]);
    render(<Harness />);

    await startArranging();
    fireEvent.click(screen.getByRole('button', { name: 'Move Rent up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel arranging' }));

    expect(screen.getByRole('button', { name: 'Arrange categories' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'New category' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Rename/ }).map((b) => b.title)).toEqual([
      'Rename Food',
      'Rename Rent',
    ]);
    expect(put).not.toHaveBeenCalled();
  });

  it('sends nothing when the order did not change', async () => {
    get.mockResolvedValue([FOOD, RENT]);
    render(<Harness />);

    await startArranging();
    fireEvent.click(screen.getByRole('button', { name: 'Save order' }));

    expect(await screen.findByRole('button', { name: 'Arrange categories' })).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('keeps the draft and says so when the save fails', async () => {
    get.mockResolvedValue([FOOD, RENT]);
    put.mockRejectedValue(new Error('offline'));
    render(<Harness />);

    await startArranging();
    fireEvent.click(screen.getByRole('button', { name: 'Move Rent up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save order' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that order.');
    expect(screen.getByRole('button', { name: 'Save order' })).toBeInTheDocument();
    expect(order()).toEqual(['Rent', 'Food']);
  });

  it('is not offered while a form is open, so starting cannot lose what was typed', async () => {
    get.mockResolvedValue([FOOD, RENT]);
    render(<Harness />);

    fireEvent.click(await screen.findByRole('button', { name: 'New category' }));

    expect(screen.queryByRole('button', { name: 'Arrange categories' })).not.toBeInTheDocument();
  });

  it('moves a row dragged by its handle past the middles of the rows below', async () => {
    get.mockResolvedValue([FOOD, RENT, TRAVEL]);
    render(<Harness />);
    await startArranging();
    layOutRows();

    const [foodHandle] = screen.getAllByTitle('Drag to move');
    fireEvent.pointerDown(foodHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientY: 20,
    });
    // Food's bottom edge (40 + 60) is past Rent's middle (70), not Travel's (120).
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 80 });
    fireEvent.pointerUp(window, { pointerId: 1, clientY: 80 });

    expect(order()).toEqual(['Rent', 'Food', 'Travel']);
    expect(screen.getByText('Food moved to 2 of 3.')).toBeInTheDocument();

    // Held past the end, it lands last.
    const [, movedHandle] = screen.getAllByTitle('Drag to move');
    fireEvent.pointerDown(movedHandle, {
      pointerId: 2,
      pointerType: 'mouse',
      button: 0,
      clientY: 70,
    });
    fireEvent.pointerUp(window, { pointerId: 2, clientY: 400 });

    expect(order()).toEqual(['Rent', 'Travel', 'Food']);
  });

  it('puts a dragged row back on Escape', async () => {
    get.mockResolvedValue([FOOD, RENT, TRAVEL]);
    render(<Harness />);
    await startArranging();
    layOutRows();

    const [foodHandle] = screen.getAllByTitle('Drag to move');
    fireEvent.pointerDown(foodHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientY: 20,
    });
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 140 });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(window, { pointerId: 1, clientY: 140 });

    expect(order()).toEqual(['Food', 'Rent', 'Travel']);
    expect(foodHandle.closest('li')?.style.transform).toBe('');
  });
});
