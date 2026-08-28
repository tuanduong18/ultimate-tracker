'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '@/lib/api-client';

interface ValidationDetail {
  loc?: unknown[];
  msg?: string;
}

/**
 * Dig the human half out of a 422.
 *
 * The backend's VALIDATION_ERROR message is always "Request validation failed.",
 * which tells nobody anything; the reason a currency rejected an amount lives in
 * `details`. Pydantic prefixes anything raised from a validator with
 * "Value error, ", which is noise to the person who typed the number.
 */
function firstValidationMessage(details: unknown): string | null {
  if (!Array.isArray(details) || details.length === 0) return null;
  const first = details[0] as ValidationDetail;
  const msg = typeof first?.msg === 'string' ? first.msg.replace(/^Value error, /, '') : null;
  if (!msg) return null;

  // loc is ['body', 'amount'] — the field is the last segment, and 'body' alone
  // means the whole payload, which is not worth naming.
  const loc = Array.isArray(first.loc) ? first.loc : [];
  const field = loc.length > 1 ? loc[loc.length - 1] : null;
  return typeof field === 'string' ? `${field}: ${msg}` : msg;
}

/** Turn a backend error into something worth showing a person. */
export function describeError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  switch (err.code) {
    case 'CATEGORY_NAME_TAKEN':
      return 'You already have a category with that name.';
    case 'UNKNOWN_CATEGORY':
      return 'That category no longer exists — reload and try again.';
    case 'NOT_FOUND':
      return 'That item no longer exists — someone may have deleted it.';
    case 'INVALID_AMOUNT':
    case 'INVALID_DATE_RANGE':
      // The backend's message is specific and already user-safe here.
      return err.message;
    case 'VALIDATION_ERROR':
      return firstValidationMessage(err.details) ?? 'Some of those details are not valid.';
    case 'RATE_UNAVAILABLE':
      return 'Exchange rates are unavailable right now, so totals cannot be shown.';
    default:
      return err.message || fallback;
  }
}

export interface Collection<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setError: (message: string | null) => void;
}

/**
 * Fetch a list endpoint and keep it reloadable.
 *
 * Deliberately not a cache: mutations call `reload()` so the list always
 * reflects what the server actually stored, rather than what we guessed it
 * would store. With three small collections that round trip is cheaper than
 * the bugs optimistic updates would invite.
 */
export function useCollection<T>(path: string): Collection<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (showSpinner: boolean) => {
      // The mount load skips this — `loading` already starts true, so setting
      // it again would only risk a spinner flash. Later reloads do want it.
      // (react-hooks/set-state-in-effect still warns here; it fires on any
      // setState reachable from an effect, which is every data-fetching hook.
      // The rule is relaxed to a warning in eslint.config.mjs for that reason.)
      if (showSpinner) setLoading(true);
      try {
        setItems(await api.get<T[]>(path));
        setError(null);
      } catch (err: unknown) {
        setError(describeError(err, 'Could not load this list.'));
      } finally {
        setLoading(false);
      }
    },
    [path]
  );

  const reload = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return { items, loading, error, reload, setError };
}

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setError: (message: string | null) => void;
}

/**
 * The same contract as `useCollection`, for an endpoint that returns one object
 * rather than a list — /auth/me and /finance/summary.
 *
 * Kept separate rather than folded in because the empty case differs: an empty
 * list is a legitimate answer to render, whereas a null object means the fetch
 * has not landed (or failed) and there is nothing to show.
 */
export function useResource<T>(path: string): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      try {
        setData(await api.get<T>(path));
        setError(null);
      } catch (err: unknown) {
        setError(describeError(err, 'Could not load this.'));
      } finally {
        setLoading(false);
      }
    },
    [path]
  );

  const reload = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return { data, loading, error, reload, setError };
}
