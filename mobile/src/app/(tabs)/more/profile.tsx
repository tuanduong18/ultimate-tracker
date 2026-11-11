import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { providerNameOf, signInMethodsOf } from '@/auth/identity';
import { useSession } from '@/auth/session';
import { Card, RowDivider } from '@/components/card';
import { CurrencyField } from '@/components/finance/currency-field';
import { FormScreen, useLeaveGuard } from '@/components/form-screen';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { describeError } from '@/lib/describe-error';
import { loadError, useCurrencies, useProfile, useProfileWrite } from '@/lib/finance/queries';
import { NAME_MAX, profileChanges, profileValues, type ProfileValues } from '@/lib/profile-form';
import type { Profile } from '@/lib/types/profile';
import { SPACE } from '@/theme/scale';

/**
 * Profile — the twin of the web's /profile: who you are to the app (the name it calls you, the
 * email and sign-in methods it knows you by) and the two currencies that travel with the
 * account. What only this phone remembers — the look — stays in Settings, as on the web.
 *
 * One form with one Save pinned above the keyboard, where the web has two cards with a Save
 * each: on a phone two Saves in one scroll mean two places to look for the one that matters,
 * and both send only what changed anyway. Like every form, it leaves once the server has the
 * change, and back asks before throwing away an edit.
 */
export default function ProfileScreen() {
  const profile = useProfile();

  if (profile.isPending || (profile.error && !profile.data)) {
    return (
      <>
        <Stack.Screen options={{ title: 'Profile' }} />
        <Screen>
          {profile.isPending ? (
            <LoadingState rows={3} />
          ) : (
            <ErrorState
              message={loadError(profile, 'Could not load your profile.') ?? ''}
              onRetry={() => profile.refetch()}
            />
          )}
        </Screen>
      </>
    );
  }

  return <ProfileEditor profile={profile.data} />;
}

/** The form, started once from the profile as it opened, so a refetch never resets typing. */
function ProfileEditor({ profile }: { profile: Profile }) {
  const { session } = useSession();
  const user = session?.user;
  const currencies = useCurrencies();
  const save = useProfileWrite();
  const [values, setValues] = useState<ProfileValues>(() => profileValues(profile));
  const [error, setError] = useState<string | null>(null);
  const changes = profileChanges(profile, values);
  const leave = useLeaveGuard(Object.keys(changes).length > 0);

  const fromProvider = providerNameOf(user);
  const methods = signInMethodsOf(user);

  async function submit() {
    if (Object.keys(changes).length === 0) {
      leave();
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(changes);
      leave();
    } catch (err) {
      setError(describeError(err, 'Could not save your profile.'));
    }
  }

  return (
    <FormScreen
      title="Profile"
      submitLabel="Save"
      busy={save.isPending}
      error={error}
      onSubmit={submit}
    >
      <Section title="Account" description="How the app addresses you, and how you sign in.">
        <View style={{ gap: SPACE.lg }}>
          <TextField
            label="Name"
            kind="name"
            value={values.name}
            onChangeText={(name) => setValues({ ...values, name })}
            maxLength={NAME_MAX}
            placeholder={fromProvider ?? 'What should we call you?'}
            hint={
              fromProvider && !profile.display_name
                ? 'Leave empty to keep using the name from your sign-in provider.'
                : 'Shown at the top of More.'
            }
          />
          <Card>
            <Fact label="Email" value={user?.email ?? '—'} />
            <RowDivider />
            <Fact label="Signs in with" value={methods.length ? methods.join(' · ') : '—'} />
          </Card>
        </View>
      </Section>

      <Section title="Currencies" description="Where new entries start, and how totals add up.">
        <View style={{ gap: SPACE.lg }}>
          <CurrencyField
            label="Preferred currency"
            value={values.preferred_currency}
            onChange={(code) => setValues({ ...values, preferred_currency: code })}
            currencies={currencies.data ?? []}
            hint="New expenses, budgets and subscriptions start in this currency."
          />
          <CurrencyField
            label="Report totals in"
            value={values.display_currency}
            onChange={(code) => setValues({ ...values, display_currency: code })}
            currencies={currencies.data ?? []}
            hint="Finance totals are converted into this currency. Each entry keeps its own."
          />
        </View>
      </Section>
    </FormScreen>
  );
}

/**
 * Something the account knows that the app can't change — it belongs to Supabase Auth: a label
 * and its value, read by TalkBack as one ("Email, tuan@example.com").
 */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={{ paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, gap: SPACE.xs }}
    >
      <Text variant="caption" tone="fgMuted">
        {label}
      </Text>
      <Text numberOfLines={1}>{value}</Text>
    </View>
  );
}
