import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  API_PAGE_LIMIT,
  fetchEveryPage,
  financeKeys,
  useCategories,
  useFinanceWrite,
} from '@/lib/finance/queries';

const mockGet = jest.fn();
jest.mock('@/lib/api-client', () => ({ api: { get: (path: string) => mockGet(path) } }));

beforeEach(() => mockGet.mockReset());

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('fetchEveryPage', () => {
  it('walks the pages until a short one says it was the last', async () => {
    const fullPage = Array.from({ length: API_PAGE_LIMIT }, (_, i) => ({ id: `e${i}` }));
    mockGet.mockResolvedValueOnce(fullPage).mockResolvedValueOnce([{ id: 'last' }]);

    const rows = await fetchEveryPage<{ id: string }>('/finance/expenses');

    expect(rows).toHaveLength(API_PAGE_LIMIT + 1);
    expect(mockGet).toHaveBeenNthCalledWith(1, '/finance/expenses?limit=500&offset=0');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/finance/expenses?limit=500&offset=500');
  });
});

describe('financeKeys', () => {
  it('starts every key with finance, so one write can reload them all', () => {
    const range = { start: '2026-11-01', end: '2026-11-30' };
    for (const key of [
      financeKeys.categories,
      financeKeys.expenses,
      financeKeys.budgetProgress('2026-11-01'),
      financeKeys.summary(range),
      financeKeys.byCategory(range, { ids: null, uncategorized: true }),
      financeKeys.byPeriod(range, 'day', { ids: null, uncategorized: true }),
    ]) {
      expect(key[0]).toBe('finance');
    }
  });
});

describe('useFinanceWrite', () => {
  it('only counts as done once what is on screen has been reloaded', async () => {
    // No garbage-collection timers, so nothing outlives the test.
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
    mockGet
      .mockResolvedValueOnce([{ id: 'c1' }])
      // The reload takes a moment, as a real one does, so a save that resolved without waiting
      // for it would be caught holding the old list.
      .mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve([{ id: 'c1' }, { id: 'c2' }]), 10))
      );
    const write = jest.fn().mockResolvedValue({ id: 'c2' });

    const { result } = await renderHook(
      () => ({ list: useCategories(), save: useFinanceWrite(write) }),
      { wrapper: wrapperFor(client) }
    );
    await waitFor(() => expect(result.current.list.data).toEqual([{ id: 'c1' }]));

    // Read the cache the instant the save resolves. Not result.current after act(): TanStack
    // tells components about new data on a setTimeout(0) and act() returns on a setImmediate,
    // and Node does not promise which runs first, so that read raced and failed on busy runners.
    let storedWhenSaved: unknown;
    await act(async () => {
      await result.current.save.mutateAsync({ name: 'Travel' });
      storedWhenSaved = client.getQueryData(financeKeys.categories);
    });

    expect(write).toHaveBeenCalledWith({ name: 'Travel' });
    // Already the stored list when the save resolves — never "saved" with the old one showing.
    expect(storedWhenSaved).toEqual([{ id: 'c1' }, { id: 'c2' }]);
    // And the screen follows it.
    await waitFor(() => expect(result.current.list.data).toEqual([{ id: 'c1' }, { id: 'c2' }]));
  });
});
