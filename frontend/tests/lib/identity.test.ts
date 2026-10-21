import type { User } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { displayNameOf, initialOf, providerNameOf, signInMethodsOf } from '@/lib/identity';

function user(fields: { user_metadata?: object; app_metadata?: object }): User {
  return {
    id: 'u1',
    aud: 'authenticated',
    created_at: '',
    user_metadata: {},
    app_metadata: {},
    ...fields,
  } as User;
}

describe('identity', () => {
  it('takes the provider name from full_name, then name, ignoring blanks', () => {
    expect(providerNameOf(user({ user_metadata: { full_name: ' Tuan N ' } }))).toBe('Tuan N');
    expect(providerNameOf(user({ user_metadata: { name: 'Tuan' } }))).toBe('Tuan');
    expect(providerNameOf(user({ user_metadata: { full_name: '  ' } }))).toBeNull();
    expect(providerNameOf(undefined)).toBeNull();
  });

  it('prefers the name chosen in the app over the provider name', () => {
    const google = user({ user_metadata: { full_name: 'Tuan Nguyen' } });

    expect(displayNameOf({ display_name: 'Tuan' }, google)).toBe('Tuan');
    expect(displayNameOf({ display_name: null }, google)).toBe('Tuan Nguyen');
    expect(displayNameOf(null, undefined)).toBeNull();
  });

  it('draws the initial from the name, then the email', () => {
    expect(initialOf('tuan', 'x@example.com')).toBe('T');
    expect(initialOf(null, 'minh@example.com')).toBe('M');
    expect(initialOf(null, undefined)).toBe('?');
  });

  it('lists every way the account signs in', () => {
    expect(signInMethodsOf(user({ app_metadata: { providers: ['email', 'google'] } }))).toEqual([
      'Email and password',
      'Google',
    ]);
    expect(signInMethodsOf(user({ app_metadata: { provider: 'github' } }))).toEqual(['Github']);
    expect(signInMethodsOf(undefined)).toEqual([]);
  });
});
