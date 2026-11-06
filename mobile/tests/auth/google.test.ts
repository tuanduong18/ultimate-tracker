import { CONNECTION_FAILED } from '@/auth/errors';
import { authRedirectFrom, completeSignIn, SIGN_IN_INCOMPLETE } from '@/auth/google';

const mockExchangeCodeForSession = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { exchangeCodeForSession: (code: string) => mockExchangeCodeForSession(code) },
  },
}));

describe('authRedirectFrom', () => {
  it('reads the one-time code', () => {
    expect(authRedirectFrom('ultimatetracker://auth/callback?code=abc123')).toEqual({
      kind: 'code',
      code: 'abc123',
    });
  });

  it('reads Expo Go addresses too', () => {
    expect(authRedirectFrom('exp://192.168.1.14:8081/--/auth/callback?code=xyz')).toEqual({
      kind: 'code',
      code: 'xyz',
    });
  });

  it('prefers the error description, from the query or the fragment', () => {
    expect(
      authRedirectFrom(
        'ultimatetracker://auth/callback?error=server_error&error_description=Down+for+maintenance'
      )
    ).toEqual({ kind: 'error', message: 'Down for maintenance', cancelled: false });
    expect(authRedirectFrom('ultimatetracker://auth/callback#error=boom')).toEqual({
      kind: 'error',
      message: 'boom',
      cancelled: false,
    });
  });

  it('treats Cancel on Google as a cancellation, not a failure', () => {
    const redirect = authRedirectFrom('ultimatetracker://auth/callback?error=access_denied');
    expect(redirect).toEqual({ kind: 'error', message: 'access_denied', cancelled: true });
  });

  it('returns null when the URL carries nothing', () => {
    expect(authRedirectFrom('ultimatetracker://auth/callback')).toBeNull();
  });
});

describe('completeSignIn', () => {
  beforeEach(() => mockExchangeCodeForSession.mockReset());

  it('exchanges a code once, however many times the redirect arrives', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const first = completeSignIn({ kind: 'code', code: 'once' });
    const second = completeSignIn({ kind: 'code', code: 'once' });
    await expect(first).resolves.toEqual({});
    await expect(second).resolves.toEqual({});
    expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('reports a failed exchange in plain words', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { name: 'AuthRetryableFetchError', message: 'Network request failed' },
    });
    await expect(completeSignIn({ kind: 'code', code: 'offline' })).resolves.toEqual({
      error: CONNECTION_FAILED,
    });
  });

  it('says nothing when the person cancelled, and something when nothing came back', async () => {
    await expect(
      completeSignIn({ kind: 'error', message: 'access_denied', cancelled: true })
    ).resolves.toEqual({});
    await expect(completeSignIn(null)).resolves.toEqual({ error: SIGN_IN_INCOMPLETE });
  });
});
