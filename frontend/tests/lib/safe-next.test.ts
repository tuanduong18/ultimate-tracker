import { describe, expect, it } from 'vitest';

import { DEFAULT_NEXT, safeNext } from '@/lib/safe-next';

/** What the page reads from `?next=…`, decoded as `useSearchParams` decodes it. */
const fromQuery = (query: string) => new URLSearchParams(query).get('next');

describe('safeNext', () => {
  it('keeps a page of this app, with its query and fragment', () => {
    expect(safeNext('/finance?tab=budgets')).toBe('/finance?tab=budgets');
    expect(safeNext('/finance/expenses#latest')).toBe('/finance/expenses#latest');
  });

  it('falls back to the dashboard when there is nothing to follow', () => {
    expect(safeNext(null)).toBe(DEFAULT_NEXT);
    expect(safeNext('')).toBe(DEFAULT_NEXT);
    expect(safeNext('dashboard')).toBe(DEFAULT_NEXT);
  });

  it.each([
    ['another site, written in full', 'next=https://evil.example'],
    ['a protocol-relative address', 'next=//evil.example'],
    ['a backslash the browser reads as a slash', 'next=/%5Cevil.example'],
    ['a tab the browser strips', 'next=/%09/evil.example'],
    ['a newline the browser strips', 'next=/%0A/evil.example'],
    ['a dot segment that collapses into two slashes', 'next=/.//evil.example'],
    ['a script', 'next=javascript:alert(1)'],
  ])('never leaves the app for %s', (_, query) => {
    const next = safeNext(fromQuery(query));

    expect(next).toBe(DEFAULT_NEXT);
    expect(new URL(next, 'https://app.example').origin).toBe('https://app.example');
  });
});
