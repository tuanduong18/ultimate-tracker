import { ApiError, type ApiErrorBody } from '@/lib/api-error';
import { API_BASE_URL } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export { ApiError, type ApiErrorBody };

/**
 * The single typed entry point for the FastAPI backend — the phone's copy of the web's
 * frontend/lib/api-client.ts, so both clients send the same headers and read errors the same
 * way. Never call fetch() for the API anywhere else.
 */

interface RequestOptions {
  method?: string;
  body?: string | ArrayBuffer;
  headers?: Record<string, string>;
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

async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    method: options.method ?? 'GET',
    body: options.body,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
      ...(options.headers ?? {}),
    },
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
  return res;
}

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(path, options);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  /**
   * A file the API builds — from what is posted (the transactions export), or from nothing but
   * who is asking (the import template, a GET) — as its bytes. Fetched rather than opened as a
   * link, because a link can carry neither the bearer token nor a body.
   *
   * Bytes, where the web's twin returns a Blob: the phone's next step is writing them to a file
   * for Android's share sheet (lib/share-file.ts), and the file system takes bytes.
   */
  download: async (path: string, body?: unknown): Promise<Uint8Array> => {
    const res = await send(
      path,
      body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }
    );
    return new Uint8Array(await res.arrayBuffer());
  },
  /**
   * POST a file's bytes as the request body itself and read the JSON answer — the import
   * endpoints take the raw bytes, as from the web: one file needs no form encoding.
   */
  upload: <T>(path: string, bytes: Uint8Array) =>
    apiFetch<T>(path, {
      method: 'POST',
      // The bytes' own stretch of their buffer: a view may sit inside a larger one.
      body: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer,
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
