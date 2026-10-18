import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { pathname } = vi.hoisted(() => ({ pathname: { current: '/dashboard' } }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}));

import { AppSidebar } from '@/components/shared/app-nav';
import { ACCOUNT_LINKS, MODULES } from '@/components/shared/nav-items';

afterEach(() => {
  pathname.current = '/dashboard';
});

describe('AppSidebar', () => {
  it('links to every module', () => {
    render(<AppSidebar />);

    for (const entry of MODULES) {
      expect(screen.getByRole('link', { name: entry.label })).toHaveAttribute('href', entry.href);
    }
  });

  it('leaves the account pages to the account menu', () => {
    render(<AppSidebar />);

    for (const link of ACCOUNT_LINKS) {
      expect(screen.queryByRole('link', { name: link.label })).toBeNull();
    }
  });

  it('marks the current module as the active page', () => {
    pathname.current = '/finance';
    render(<AppSidebar />);

    expect(screen.getByRole('link', { name: 'Finance' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Fitness' })).not.toHaveAttribute('aria-current');
  });

  it('keeps the parent module active on a nested route', () => {
    pathname.current = '/finance/expenses';
    render(<AppSidebar />);

    expect(screen.getByRole('link', { name: 'Finance' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not treat a name-prefixed sibling as the active module', () => {
    // /fitness must not light up for a hypothetical /fitness-goal route.
    pathname.current = '/fitness-goal';
    render(<AppSidebar />);

    expect(screen.getByRole('link', { name: 'Fitness' })).not.toHaveAttribute('aria-current');
  });
});
