import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { pathname, signOut } = vi.hoisted(() => ({
  pathname: { current: '/dashboard' },
  signOut: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut } },
}));

import { ACCOUNT_LINKS, AppNav, MODULES } from '@/components/shared/app-nav';

afterEach(() => {
  vi.clearAllMocks();
  pathname.current = '/dashboard';
});

describe('AppNav', () => {
  it('links to every module and every account page', () => {
    render(<AppNav />);

    for (const entry of [...MODULES, ...ACCOUNT_LINKS]) {
      expect(screen.getByRole('link', { name: entry.label })).toHaveAttribute('href', entry.href);
    }
  });

  it('marks an account page active the same way a module is', () => {
    pathname.current = '/settings';
    render(<AppNav />);

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current');
  });

  it('marks the current module as the active page', () => {
    pathname.current = '/finance';
    render(<AppNav />);

    expect(screen.getByRole('link', { name: 'Finance' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Steps' })).not.toHaveAttribute('aria-current');
  });

  it('keeps the parent module active on a nested route', () => {
    pathname.current = '/finance/budgets';
    render(<AppNav />);

    expect(screen.getByRole('link', { name: 'Finance' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not treat a name-prefixed sibling as the active module', () => {
    // /steps must not light up for a hypothetical /steps-goal route.
    pathname.current = '/steps-goal';
    render(<AppNav />);

    expect(screen.getByRole('link', { name: 'Steps' })).not.toHaveAttribute('aria-current');
  });

  it('signs the user out from the nav', () => {
    render(<AppNav />);

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
