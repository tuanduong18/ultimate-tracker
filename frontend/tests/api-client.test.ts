import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession, signOut } },
}));

import { api, ApiError } from '@/lib/api-client';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'error',
    json: async () => body,
  } as Response;
}

describe('ApiError', () => {
  it('carries status, code, and message from the backend error shape', () => {
    const err = new ApiError(404, { code: 'NOT_FOUND', message: 'Nope.' });

    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Nope.');
  });
});

describe('apiFetch', () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'token-abc' } } });
    signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends the session token as a Bearer header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { timezone: 'UTC' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/auth/me')).resolves.toEqual({ timezone: 'UTC' });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-abc');
  });

  it('drops the local session when the backend rejects the token', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(401, { error: { code: 'INVALID_TOKEN', message: 'Could not validate.' } })
        )
    );

    await expect(api.get('/auth/me')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_TOKEN',
    });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('leaves the session alone for errors that are not 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse(500, { error: { code: 'HTTP_ERROR', message: 'Boom.' } }))
    );

    await expect(api.get('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(signOut).not.toHaveBeenCalled();
  });
});
