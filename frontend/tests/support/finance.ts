/**
 * Fixtures shared by more than one finance test file.
 *
 * Kept small on purpose: a fixture used by a single file stays in that file,
 * next to the assertions that depend on its exact values.
 */

import { vi } from 'vitest';

import type { DateRange } from '@/lib/dates';
import type { Resource } from '@/lib/hooks/use-collection';
import type { Category } from '@/lib/types/finance';

/** A settled `useResource` result, for components that take one as a prop. */
export function resource<T>(data: T | null, rest: Partial<Resource<T>> = {}): Resource<T> {
  return { data, loading: false, error: null, reload: vi.fn(), setError: vi.fn(), ...rest };
}

export const RANGE: DateRange = { start: '2026-08-01', end: '2026-08-31' };
export const noop = () => {};

export const FOOD: Category = {
  id: 'c1',
  name: 'Food',
  colour: '#22c55e',
  created_at: '2026-08-01T00:00:00Z',
};
export const RENT: Category = {
  id: 'c2',
  name: 'Rent',
  colour: '#ef4444',
  created_at: '2026-08-01T00:00:00Z',
};
