/**
 * Checking the log-in and sign-up fields before anything is sent.
 *
 * The web leans on the browser's `required`/`minLength` bubbles; a phone has none, so the
 * rules are here — the same rules (an email, and 8 characters for a new password) in the
 * shared voice: an instruction when empty, a description when wrong, no "invalid".
 */

export interface Credentials {
  email: string;
  password: string;
}

export type CredentialErrors = Partial<Record<keyof Credentials, string>>;

export type CredentialsMode = 'log-in' | 'sign-up';

/** Shared with the web's sign-up form (`minLength={8}`). */
export const MIN_PASSWORD_LENGTH = 8;

// Deliberately loose: something@something. The auth server is the real judge; this only
// catches the slips a phone keyboard makes (a missing @, a stray space).
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/;

export function checkCredentials(
  { email, password }: Credentials,
  mode: CredentialsMode
): CredentialErrors {
  const errors: CredentialErrors = {};
  const trimmed = email.trim();

  if (!trimmed) errors.email = 'Enter your email address';
  else if (!EMAIL_SHAPE.test(trimmed)) {
    errors.email = 'Enter an email address like name@example.com';
  }

  if (!password) {
    errors.password = mode === 'log-in' ? 'Enter your password' : 'Enter a password';
  } else if (mode === 'sign-up' && password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be ${MIN_PASSWORD_LENGTH} characters or more`;
  }

  return errors;
}
