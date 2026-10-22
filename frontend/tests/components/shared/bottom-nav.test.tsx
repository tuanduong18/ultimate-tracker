import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/finance',
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: vi.fn(),
    },
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));

import { BottomNav } from '@/components/shared/bottom-nav';
import { MODULES } from '@/components/shared/nav-items';

function drawer() {
  return screen.getByRole('dialog', { name: 'Navigation' });
}

function openDrawer() {
  render(<BottomNav />);
  const toggle = screen.getByRole('button', { name: 'More' });
  fireEvent.click(toggle);
  return toggle;
}

describe('BottomNav', () => {
  it('gives the first four modules a tab each, with the current one marked', () => {
    render(<BottomNav />);

    const bar = screen.getByRole('navigation', { name: 'Main' });
    const tabs = within(bar).getAllByRole('link');
    expect(tabs.map((tab) => tab.textContent)).toEqual(
      MODULES.slice(0, 4).map((entry) => entry.label)
    );
    expect(within(bar).getByRole('link', { name: 'Finance' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('keeps the drawer closed, and out of the page, until More is pressed', () => {
    render(<BottomNav />);

    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
    // Rendered only while open, so a closed drawer cannot be found or tabbed into.
    expect(screen.queryByRole('navigation', { name: 'All modules' })).toBeNull();
  });

  it('opens More to every module, with the current one marked', () => {
    const toggle = openDrawer();

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    for (const entry of MODULES) {
      expect(within(drawer()).getByRole('link', { name: entry.label })).toBeInTheDocument();
    }
    expect(within(drawer()).getByRole('link', { name: 'Finance' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('closes once a link in the drawer is followed', () => {
    const toggle = openDrawer();

    fireEvent.click(within(drawer()).getByRole('link', { name: 'Gaming' }));

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Gaming' })).toBeNull();
  });

  it('closes from its own close button', () => {
    const toggle = openDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on a click on the backdrop', () => {
    const toggle = openDrawer();

    // The backdrop belongs to the <dialog> itself, so a click on the element
    // rather than on anything inside it is a click outside the panel.
    fireEvent.click(screen.getByRole('dialog', { name: 'Navigation' }));

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('stays in step when the browser closes it, as Escape does', () => {
    const toggle = openDrawer();
    const dialog = screen.getByRole('dialog', { name: 'Navigation' }) as HTMLDialogElement;

    // Escape is handled natively by the dialog, which then fires `close`.
    act(() => dialog.close());

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the drawer clickable without closing it', () => {
    openDrawer();

    fireEvent.click(screen.getByRole('navigation', { name: 'All modules' }));

    expect(within(drawer()).getByRole('link', { name: 'Finance' })).toBeInTheDocument();
  });
});
