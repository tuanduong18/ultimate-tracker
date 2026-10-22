import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { pathname } = vi.hoisted(() => ({ pathname: { current: '/finance' } }));

vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

import { FINANCE_TABS, FinanceTabs } from '@/components/finance/finance-tabs';

afterEach(() => {
  pathname.current = '/finance';
});

function current() {
  const nav = screen.getByRole('navigation', { name: 'Finance sections' });
  return within(nav)
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent);
}

describe('FinanceTabs', () => {
  it('links every section in order', () => {
    render(<FinanceTabs />);

    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(
      FINANCE_TABS.map((tab) => tab.href)
    );
  });

  it('marks Overview only on the overview itself', () => {
    render(<FinanceTabs />);
    expect(current()).toEqual(['Overview']);
  });

  it('marks exactly one tab on a section page', () => {
    // /finance is a prefix of every tab's path; it must not light up as well.
    pathname.current = '/finance/budgets';
    render(<FinanceTabs />);

    expect(current()).toEqual(['Budgets']);
  });
});
