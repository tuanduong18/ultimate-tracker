import { ApiError } from '@/lib/api-error';

/**
 * A stand-in for the API client in screen tests: GETs are answered from canned responses keyed
 * by path, writes are recorded and resolve unless a test says otherwise. Used as
 *
 *   jest.mock('@/lib/api-client', () => jest.requireActual('../../support/api').apiClient);
 *
 * A GET's path is matched exactly first, then without its query string, so a paged list
 * ("/finance/expenses?limit=500&offset=0") can be served as "/finance/expenses". Anything not
 * served is a 404, so a screen asking for something unexpected fails loudly.
 */
type Response = unknown | (() => unknown);

let responses: Record<string, Response> = {};

export function serve(next: Record<string, Response>) {
  responses = { ...responses, ...next };
}

export const api = {
  get: jest.fn(async (path: string) => {
    const response = path in responses ? responses[path] : responses[path.split('?')[0]];
    if (response === undefined) {
      throw new ApiError(404, { code: 'NOT_FOUND', message: `Nothing served for ${path}` });
    }
    return typeof response === 'function' ? (response as () => unknown)() : response;
  }),
  post: jest.fn(async (_path: string, body: unknown) => body),
  patch: jest.fn(async (_path: string, body: unknown) => body),
  put: jest.fn(async () => undefined),
  delete: jest.fn(async () => undefined),
};

export function resetApi() {
  responses = {};
  for (const fn of Object.values(api)) fn.mockClear();
}

export const apiClient = { api, ApiError };
