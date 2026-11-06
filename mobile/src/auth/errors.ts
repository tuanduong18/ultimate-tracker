/**
 * What to tell someone when signing in or up fails — in the app's voice rather than the auth
 * server's ("Invalid login credentials" blames the person and uses a word the copy rules ban).
 *
 * Matched on Supabase's stable error `code`, not its message text, which changes between
 * versions. Anything unrecognised falls back to the server's message: specific and a little
 * stiff beats a vague "something went wrong".
 */

/** The parts of a Supabase AuthError this needs — structural, so tests can pass plain objects. */
interface AuthFailure {
  name?: string;
  code?: string;
  message: string;
}

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'That email and password don’t match an account. Check both and try again.',
  email_not_confirmed: 'Confirm your email first: open the link we sent you, then log in.',
  user_already_exists: 'There’s already an account with that email. Log in instead.',
  email_exists: 'There’s already an account with that email. Log in instead.',
  weak_password: 'Choose a stronger password — longer, or mixing letters, numbers and symbols.',
  over_request_rate_limit: 'Too many attempts in a row. Wait a minute, then try again.',
  over_email_send_rate_limit:
    'We’ve sent several emails to that address already. Wait a few minutes, then try again.',
};

export const CONNECTION_FAILED =
  'We couldn’t reach the sign-in service. Check your connection and try again.';

export function describeAuthError(error: AuthFailure): string {
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  // supabase-js wraps a network failure (no connection, the server unreachable) in this class.
  if (error.name === 'AuthRetryableFetchError') return CONNECTION_FAILED;
  return error.message;
}
