'use client';

import { AccountForm } from '@/components/profile/account-form';
import { CurrencyPreferencesForm } from '@/components/profile/currency-preferences-form';
import { useResource } from '@/lib/hooks/use-collection';
import type { Profile } from '@/lib/types/profile';

/**
 * Everything on /profile. Fetches the profile once and hands it to each form,
 * rather than each form fetching its own copy and the two drifting apart after
 * a save.
 */
export function ProfileSettings() {
  const profile = useResource<Profile>('/auth/me');

  if (profile.loading) {
    return <p className="mt-6 text-sm text-fg-muted">Loading…</p>;
  }
  if (!profile.data) {
    return (
      <p role="alert" className="mt-6 text-sm text-negative">
        {profile.error ?? 'Could not load your profile.'}
      </p>
    );
  }

  return (
    <div className="mt-8 grid max-w-3xl gap-6">
      <AccountForm profile={profile.data} onSaved={profile.reload} />
      <CurrencyPreferencesForm profile={profile.data} onSaved={profile.reload} />
    </div>
  );
}
