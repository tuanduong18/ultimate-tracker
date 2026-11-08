/**
 * The backend's error shape, on its own so that code which only reads errors — `describeError`,
 * the query cache's retry rule — doesn't pull in the client's environment and Supabase setup.
 * lib/api-client.ts re-exports both, so callers keep importing them from there.
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
