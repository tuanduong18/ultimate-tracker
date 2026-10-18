import { act, fireEvent, render, screen } from '@testing-library/react';
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
  },
}));

import { AppHeader } from '@/components/shared/app-header';
import { MODULES } from '@/components/shared/nav-items';

function openDrawer() {
  render(<AppHeader />);
  const toggle = screen.getByRole('button', { name: 'Open navigation' });
  fireEvent.click(toggle);
  return toggle;
}

describe('AppHeader navigation drawer', () => {
  it('starts closed, with no module links in the page', () => {
    render(<AppHeader />);

    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    // Rendered only while open, so a closed drawer cannot be found or tabbed into.
    expect(screen.queryByRole('link', { name: 'Finance' })).toBeNull();
  });

  it('opens to every module, with the current one marked', () => {
    const toggle = openDrawer();

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    for (const entry of MODULES) {
      expect(screen.getByRole('link', { name: entry.label })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Finance' })).toHaveAttribute('aria-current', 'page');
  });

  it('closes once a link is followed', () => {
    const toggle = openDrawer();

    fireEvent.click(screen.getByRole('link', { name: 'Fitness' }));

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Fitness' })).toBeNull();
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

    fireEvent.click(screen.getByRole('navigation', { name: 'Main' }));

    expect(screen.getByRole('link', { name: 'Finance' })).toBeInTheDocument();
  });
});
