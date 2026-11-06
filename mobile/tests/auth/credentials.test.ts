import { checkCredentials } from '@/auth/credentials';

describe('checkCredentials', () => {
  it('asks for what is missing, in the shared voice', () => {
    expect(checkCredentials({ email: '  ', password: '' }, 'log-in')).toEqual({
      email: 'Enter your email address',
      password: 'Enter your password',
    });
    expect(checkCredentials({ email: '', password: '' }, 'sign-up').password).toBe(
      'Enter a password'
    );
  });

  it('describes an email with no @ instead of calling it invalid', () => {
    expect(checkCredentials({ email: 'me.example.com', password: 'x' }, 'log-in').email).toBe(
      'Enter an email address like name@example.com'
    );
  });

  it('holds new passwords to 8 characters, as the web does, but not log-in ones', () => {
    expect(checkCredentials({ email: 'a@b.co', password: 'short' }, 'sign-up').password).toBe(
      'Password must be 8 characters or more'
    );
    expect(checkCredentials({ email: 'a@b.co', password: 'short' }, 'log-in')).toEqual({});
  });

  it('accepts an address with spaces around it (they are trimmed before sending)', () => {
    expect(checkCredentials({ email: ' a@b.co ', password: 'long enough' }, 'sign-up')).toEqual({});
  });
});
