import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';

import { checkCredentials, type CredentialErrors } from '@/auth/credentials';
import { describeAuthError } from '@/auth/errors';
import { authRedirectUrl, signInWithGoogle } from '@/auth/google';
import { AuthScreen, FooterLink, OrDivider } from '@/components/auth-screen';
import { PrimaryButton } from '@/components/button';
import { FormError } from '@/components/form-error';
import { GoogleButton } from '@/components/google-button';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { supabase } from '@/lib/supabase';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * Sign up — the twin of the web's /signup, with the same words and the same 8-character rule.
 *
 * With email confirmation on, Supabase answers with no session and sends a link. The link
 * points back into the app (`emailRedirectTo`), so opening it on this phone confirms and signs
 * in with one tap; opened anywhere else, it still confirms the address, and Log in works after.
 * The "check your email" step says both, because which device opens the email isn't ours to
 * know.
 */
export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<CredentialErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  function recheck(next: { email: string; password: string }) {
    const found = checkCredentials(next, 'sign-up');
    setErrors((shown) => ({
      email: shown.email ? found.email : undefined,
      password: shown.password ? found.password : undefined,
    }));
  }

  async function signUp() {
    const found = checkCredentials({ email, password }, 'sign-up');
    setErrors(found);
    setFormError('');
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    setSubmitting(true);
    const address = email.trim();
    const { data, error } = await supabase.auth.signUp({
      email: address,
      password,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    setSubmitting(false);
    if (error) {
      setFormError(describeAuthError(error));
      return;
    }
    // With confirmation off there is a session at once, and the guard moves on to the tabs.
    if (!data.session) setSentTo(address);
  }

  async function continueWithGoogle() {
    setFormError('');
    setGoogleBusy(true);
    const outcome = await signInWithGoogle();
    setGoogleBusy(false);
    if (outcome.error) setFormError(outcome.error);
  }

  if (sentTo) return <CheckYourEmail address={sentTo} />;

  return (
    <>
      <Stack.Screen options={{ title: 'Sign up' }} />
      <AuthScreen
        title="Create your account"
        subtitle="Start with your money — the rest of your life follows."
        footer={<FooterLink prompt="Already have an account?" label="Log in" href="/login" />}
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
            kind="new-password"
            hint="At least 8 characters."
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              recheck({ email, password: value });
            }}
            error={errors.password}
            returnKeyType="go"
            onSubmitEditing={() => void signUp()}
          />
          <PrimaryButton
            fullWidth
            label={submitting ? 'Creating account…' : 'Sign up'}
            disabled={submitting || googleBusy}
            onPress={() => void signUp()}
          />
          {formError ? <FormError message={formError} /> : null}
        </View>
      </AuthScreen>
    </>
  );
}

function CheckYourEmail({ address }: { address: string }) {
  const { colors } = useAppTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Check your email' }} />
      <AuthScreen
        title="Check your email"
        footer={<FooterLink label="Back to log in" href="/login" />}
      >
        <View
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: SPACE.md,
            padding: SPACE.lg,
            borderRadius: RADIUS.control,
            backgroundColor: colors.primarySoft,
          }}
        >
          <Icon name="mark_email_read" tone="primary" />
          <Text style={{ flex: 1 }}>
            We sent a confirmation link to <Text variant="bodyStrong">{address}</Text>. Open it on
            this phone to finish signing in — or open it anywhere, then log in here.
          </Text>
        </View>
      </AuthScreen>
    </>
  );
}
