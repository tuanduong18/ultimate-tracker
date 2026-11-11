import type { ReactNode } from 'react';

/**
 * A stand-in for Expo Router in screen tests: navigation calls are recorded rather than made,
 * and a screen's search params are whatever the test sets. Used from a test as
 *
 *   jest.mock('expo-router', () => jest.requireActual('../../support/router').expoRouter);
 *
 * then `router.push` etc. are asserted on, and `setParams({ id })` opens a screen on a record.
 */
export const router = {
  push: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: jest.fn(() => true),
};

let params: Record<string, string> = {};

export function setParams(next: Record<string, string>) {
  params = next;
}

export function resetRouter() {
  for (const fn of Object.values(router)) fn.mockClear();
  params = {};
}

export const expoRouter = {
  Stack: { Screen: () => null },
  Link: ({ children }: { children: ReactNode }) => children,
  useRouter: () => router,
  useLocalSearchParams: () => params,
  // The guard itself is tested in form-screen.test; screens only need it not to get in the way.
  usePreventRemove: () => undefined,
};
