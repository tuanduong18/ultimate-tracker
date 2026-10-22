import { render, screen } from '@testing-library/react';
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

// The bell and the account menu load from the API; unanswered is enough here.
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get: () => new Promise(() => {}) } };
});

import { AppHeader } from '@/components/shared/app-header';
import { ThemeProvider } from '@/components/shared/theme-provider';

describe('AppHeader', () => {
  it('carries what belongs to every module: Log, the bell, the account menu', () => {
    render(<AppHeader />, { wrapper: ThemeProvider });

    expect(screen.getByRole('button', { name: 'Log' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
    // A module's own action would sit above every other module's pages.
    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
  });

  it('leaves navigation to the sidebar and the bottom tab bar', () => {
    render(<AppHeader />, { wrapper: ThemeProvider });

    expect(screen.queryByRole('button', { name: 'Open navigation' })).toBeNull();
  });
});
