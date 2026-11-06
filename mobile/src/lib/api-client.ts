import { API_BASE_URL } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * The single typed entry point for the FastAPI backend — the phone's copy of the web's
 * frontend/lib/api-client.ts, so both clients send the same headers and read errors the same
 * way. Never call fetch() for the API anywhere else.
 *
 * File transfer (`download`, `upload`) arrives with the import and export screens.
 */

export interface ApiErrorBody {
  code: string;
  message: string;
  /** Only VALIDATION_ERROR carries this: the raw per-field reasons the UI needs. */
  details?: unknown;
}

/** Error thrown for any non-2xx response, carrying the backend's error shape. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.code = body.code;
    this.status = status;
    this.details = body.details;
  }
}

interface RequestOptions {
  method?: string;
  body?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/**
 * A 401 means the token we sent is no longer accepted — expired beyond refresh, revoked, or
 * signed by a key the backend no longer trusts. Dropping the session sends the app back to the
 * log-in screen, rather than leaving a screen that retries with a token that will never work.
 */
async function clearRejectedSession(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) await supabase.auth.signOut();
}

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    method: options.method ?? 'GET',
    body: options.body,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
  });

  if (!res.ok) {
    if (res.status === 401) await clearRejectedSession();

    let body: ApiErrorBody = { code: 'UNKNOWN', message: res.statusText };
    try {
      const json = (await res.json()) as { error?: ApiErrorBody };
      if (json.error) body = json.error;
    } catch {
      // A non-JSON error body: keep the status text.
    }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
