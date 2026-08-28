import { supabase } from '@/lib/supabase';

// Single typed entry point for the FastAPI backend. Never call fetch() directly
// in a component — go through here so auth headers and error handling stay
// consistent.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export interface ApiErrorBody {
  code: string;
  message: string;
  /**
   * Only VALIDATION_ERROR carries this: the raw Pydantic error list, whose
   * `message` is the useless constant "Request validation failed.". The
   * per-field reason ("VND amounts take at most 0 decimal place(s)") is in
   * here, so it has to survive as far as the UI.
   */
  details?: unknown;
}

/** Error thrown for any non-2xx response, carrying the backend error shape. */
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
  headers?: Record<string, string>;
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/**
 * A 401 means the token we sent is no longer accepted — expired beyond refresh,
 * revoked, or signed by a key the backend no longer trusts. Dropping the local
 * session turns that into a redirect to /login via AuthGuard, rather than a
 * screen that keeps retrying with a token that will never be taken.
 */
async function clearRejectedSession(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) await supabase.auth.signOut();
}

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    method: options.method ?? 'GET',
    body: options.body,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) await clearRejectedSession();

    let body: ApiErrorBody = { code: 'UNKNOWN', message: res.statusText };
    try {
      const json = (await res.json()) as { error?: ApiErrorBody };
      if (json.error) body = json.error;
    } catch {
      // Non-JSON error body — fall back to the status text above.
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
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
