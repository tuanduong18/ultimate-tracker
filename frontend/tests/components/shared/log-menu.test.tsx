import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get, post: vi.fn() } };
});

import { LogMenu } from '@/components/shared/log-menu';

afterEach(() => vi.clearAllMocks());

function openMenu() {
  render(<LogMenu />);
  const button = screen.getByRole('button', { name: 'Log' });
  fireEvent.click(button);
  return button;
}

describe('LogMenu', () => {
  it('starts closed', () => {
    render(<LogMenu />);

    expect(screen.getByRole('button', { name: 'Log' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Expense/ })).toBeNull();
  });

  it('lists what can be logged', () => {
    const button = openMenu();

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('What would you like to log?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expense/ })).toHaveAttribute(
      'aria-haspopup',
      'dialog'
    );
  });

  it('opens the expense dialog from its row, closing the menu', async () => {
    get.mockImplementation(() => new Promise(() => {}));
    const button = openMenu();

    fireEvent.click(screen.getByRole('button', { name: /Expense/ }));

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(await screen.findByRole('dialog', { name: 'Add expense' })).toHaveAttribute('open');
  });

  it('hands focus back to Log when the dialog closes', async () => {
    get.mockImplementation(() => new Promise(() => {}));
    const button = openMenu();
    fireEvent.click(screen.getByRole('button', { name: /Expense/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add expense' });

    // The row that opened it is gone with the menu, so the browser's own
    // focus return would have nowhere to go.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(button).toHaveFocus());
  });

  it('closes on Escape, back to the button', () => {
    const button = openMenu();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });
});
