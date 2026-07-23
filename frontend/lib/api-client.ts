import { supabase } from '@/lib/supabase';

// Single typed entry point for the FastAPI backend. Never call fetch() directly
// in a component — go through here so auth headers and error handling stay
// consistent.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export interface ApiErrorBody {
  code: string;
  message: string;
}

/** Error thrown for any non-2xx response, carrying the backend error shape. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.code = body.code;
    this.status = status;
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
