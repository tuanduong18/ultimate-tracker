import { addEventListener as onNetworkChange } from '@react-native-community/netinfo';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/auth/session';
import { ApiError } from '@/lib/api-error';

/**
 * The app's cache of what the API returned, through TanStack Query.
 *
 * Chosen over a port of the web's `useCollection` because a phone app is a stack of screens,
 * not one page: the form that saves an expense sits on top of the list that shows it, and both
 * read one cache, so a save reloads what is behind it without the two knowing about each other.
 * It also keeps the old content on screen while a refetch runs, refetches when the app comes
 * back to the front, and retries through the backend's cold start (about 50 s on Render's free
 * tier). Persisting the cache for offline reads is the later step platform.md plans.
 *
 * The server stays the source of truth: nothing here is optimistic. A write runs, the cache is
 * invalidated, and the screen shows what the server stored.
 */

// Coming back to the app is what "focus" means on a phone: the lists refetch if they are stale,
// so an expense logged on the web is there when the app opens again.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) => {
    handleFocus(state === 'active');
  });
  return () => subscription.remove();
});

// The phone's own word on whether it has a connection: with none, loads wait rather than fail
// and spend their retries, and they run again the moment it comes back — a lift, a tunnel, a
// flight. An unknown state counts as online, so a phone that won't say is never stuck offline.
onlineManager.setEventListener((setOnline) =>
  onNetworkChange((state) => setOnline(state.isConnected !== false))
);

/**
 * Ask again only when asking again could help: a dropped connection or a server still waking
 * up (5xx) might answer next time; a refusal (4xx) won't change, and retrying it only delays the
 * sentence that explains it.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 3;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Fresh for 30 s: moving between Finance's screens doesn't refetch what was just loaded,
        // and coming back to the app after longer does.
        staleTime: 30_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(2_000 * 2 ** attempt, 15_000),
      },
      // A write is never repeated behind the person's back: it could log an expense twice.
      mutations: { retry: false },
    },
  });
}

/**
 * The cache for the whole app, emptied when the person signs out — on a shared phone, nothing
 * one account loaded may show to the next. Emptied at sign-out rather than at sign-in, so the
 * next account's first screens never race a clear.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  const { session } = useSession();
  const signedOut = session === null;

  useEffect(() => {
    if (signedOut) client.clear();
  }, [client, signedOut]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
