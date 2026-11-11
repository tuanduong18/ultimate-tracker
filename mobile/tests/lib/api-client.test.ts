import { api, ApiError } from '@/lib/api-client';

jest.mock('@/lib/env', () => ({ API_BASE_URL: 'https://api.test' }));

const mockGetSession = jest.fn();
const mockSignOut = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: () => mockGetSession(), signOut: () => mockSignOut() } },
}));

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function respond(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    json: async () => {
      if (body === undefined) throw new SyntaxError('no body');
      return body;
    },
    arrayBuffer: async () => new Uint8Array([80, 75, 3, 4]).buffer,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  mockSignOut.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { access_token: 'token-1' } } });
});

describe('api', () => {
  it('calls /api/v1 on the configured backend with the bearer token', async () => {
    fetchMock.mockResolvedValue(respond(200, { ok: true }));
    await expect(api.get('/auth/me')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/v1/auth/me', {
      method: 'GET',
      body: undefined,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-1' },
    });
  });

  it('sends JSON bodies and reads 204 as nothing', async () => {
    fetchMock.mockResolvedValue(respond(204));
    await expect(api.patch('/auth/me', { timezone: 'Asia/Tokyo' })).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PATCH',
      body: '{"timezone":"Asia/Tokyo"}',
    });
  });

  it('throws the backend error envelope as an ApiError', async () => {
    fetchMock.mockResolvedValue(
      respond(422, { error: { code: 'VALIDATION_ERROR', message: 'Nope', details: [1] } })
    );
    const error = await api.get('/x').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: 'VALIDATION_ERROR', details: [1] });
  });

  it('keeps the status text when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(respond(502));
    await expect(api.get('/x')).rejects.toMatchObject({ code: 'UNKNOWN', message: 'status 502' });
  });

  it('logs out on a 401, so the app returns to Log in', async () => {
    fetchMock.mockResolvedValue(respond(401, { error: { code: 'UNAUTHORIZED', message: 'No' } }));
    await expect(api.get('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('sends no Authorization header when nobody is signed in', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.get('/health');
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('downloads a built file as bytes: a GET with no body, a POST with one', async () => {
    fetchMock.mockResolvedValue(respond(200));
    await expect(api.download('/finance/expenses/import/template')).resolves.toEqual(
      new Uint8Array([80, 75, 3, 4])
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', body: undefined });

    await api.download('/finance/expenses/export', { expense_ids: ['e1'] });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: '{"expense_ids":["e1"]}',
    });
  });

  it('fails a download with the backend error, like any other call', async () => {
    fetchMock.mockResolvedValue(
      respond(422, { error: { code: 'VALIDATION_ERROR', message: 'Nope' } })
    );
    await expect(api.download('/finance/expenses/export', {})).rejects.toMatchObject({
      status: 422,
    });
  });

  it('uploads a file as its raw bytes and reads the JSON answer', async () => {
    fetchMock.mockResolvedValue(respond(200, { rows: [] }));
    const bytes = new Uint8Array([1, 2, 3]);
    await expect(api.upload('/finance/expenses/import/preview', bytes)).resolves.toEqual({
      rows: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/v1/finance/expenses/import/preview',
      {
        method: 'POST',
        body: bytes.buffer,
        headers: {
          'Content-Type': 'application/octet-stream',
          Authorization: 'Bearer token-1',
        },
      }
    );
  });
});
