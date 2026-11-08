import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { AppThemeProvider } from '@/theme/theme-provider';

/**
 * Render a screen the way the app does — inside the theme and a query cache — with a fresh
 * cache per test, no retries (a failure should show at once), and no garbage-collection timers
 * left running after the test.
 */
export async function renderScreen(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <AppThemeProvider>{children}</AppThemeProvider>
      </QueryClientProvider>
    );
  }
  const view = await render(ui, { wrapper: Wrapper });
  return { ...view, client };
}

/** Test data: a category, an expense and a profile, each overridable. */
export function category(id: string, name: string, overrides: object = {}) {
  return {
    id,
    name,
    colour: '#22c55e',
    icon: null,
    created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

export function expense(id: string, overrides: object = {}) {
  return {
    id,
    amount: '10.00',
    currency: 'SGD',
    category_id: null,
    description: null,
    spent_on: '2026-11-01',
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

export const PROFILE = {
  id: 'u1',
  display_name: null,
  timezone: 'Asia/Singapore',
  display_currency: 'SGD',
  preferred_currency: 'SGD',
  created_at: '2026-08-01T00:00:00Z',
};
