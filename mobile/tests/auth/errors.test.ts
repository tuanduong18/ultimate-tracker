import { CONNECTION_FAILED, describeAuthError } from '@/auth/errors';

describe('describeAuthError', () => {
  it('turns known codes into plain words', () => {
    expect(
      describeAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' })
    ).toBe('That email and password don’t match an account. Check both and try again.');
  });

  it('names a network failure as one', () => {
    expect(
      describeAuthError({ name: 'AuthRetryableFetchError', message: 'Network request failed' })
    ).toBe(CONNECTION_FAILED);
  });

  it('falls back to the server message for anything unknown', () => {
    expect(describeAuthError({ code: 'something_new', message: 'A new thing happened' })).toBe(
      'A new thing happened'
    );
  });
});
