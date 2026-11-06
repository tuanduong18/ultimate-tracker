import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';

import { checkCredentials, type CredentialErrors } from '@/auth/credentials';
import { describeAuthError } from '@/auth/errors';
import { signInWithGoogle } from '@/auth/google';
import { AuthScreen, FooterLink, OrDivider } from '@/components/auth-screen';
import { PrimaryButton } from '@/components/button';
import { FormError } from '@/components/form-error';
import { GoogleButton } from '@/components/google-button';
import { TextField } from '@/components/text-field';
import { supabase } from '@/lib/supabase';
import { SPACE } from '@/theme/scale';

/**
 * Log in — the twin of the web's /login, with the same words.
 *
 * Fields are checked on Log in, not while typing; a field already showing an error re-checks
 * as it changes, so the message goes the moment it's fixed. On a slip, focus goes to the first
 * field to fix. A successful sign-in needs no navigation here: the session changes, and the
 * root layout's guard swaps these screens for the tabs.
 *
 * `error` arrives in the route when a browser sign-in came back refused (auth/callback).
 */
export default function LogIn() {
  const params = useLocalSearchParams<{ error?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<CredentialErrors>({});
  const [formError, setFormError] = useState(params.error ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  function recheck(next: { email: string; password: string }) {
    const found = checkCredentials(next, 'log-in');
    setErrors((shown) => ({
      email: shown.email ? found.email : undefined,
      password: shown.password ? found.password : undefined,
    }));
  }

  async function logIn() {
    const found = checkCredentials({ email, password }, 'log-in');
    setErrors(found);
    setFormError('');
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setSubmitting(false);
      setFormError(describeAuthError(error));
    }
  }

  async function continueWithGoogle() {
    setFormError('');
    setGoogleBusy(true);
    const outcome = await signInWithGoogle();
    setGoogleBusy(false);
    if (outcome.error) setFormError(outcome.error);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Log in' }} />
      <AuthScreen
        title="Welcome back"
        subtitle="Log in to pick up where you left off."
        footer={<FooterLink prompt="No account yet?" label="Create one" href="/signup" />}
      >
        <GoogleButton busy={googleBusy} onPress={() => void continueWithGoogle()} />
        <OrDivider />
        <View style={{ gap: SPACE.lg }}>
          <TextField
            ref={emailRef}
            label="Email"
            kind="email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              recheck({ email: value, password });
            }}
            error={errors.email}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextField
            ref={passwordRef}
            label="Password"
            kind="current-password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              recheck({ email, password: value });
            }}
            error={errors.password}
            returnKeyType="go"
            onSubmitEditing={() => void logIn()}
          />
          <PrimaryButton
            fullWidth
            label={submitting ? 'Signing in…' : 'Log in'}
            disabled={submitting || googleBusy}
            onPress={() => void logIn()}
          />
          {formError ? <FormError message={formError} /> : null}
        </View>
      </AuthScreen>
    </>
  );
}
