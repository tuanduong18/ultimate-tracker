'use client';

import { useState } from 'react';

import { SaveRow, SettingsCard } from '@/components/profile/settings-card';
import { api } from '@/lib/api-client';
import { describeError } from '@/lib/hooks/use-collection';
import { useSession } from '@/lib/hooks/use-session';
import {
  announceProfileChange,
  displayNameOf,
  initialOf,
  providerNameOf,
  signInMethodsOf,
} from '@/lib/identity';
import type { Profile } from '@/lib/types/profile';

/** Mirrors the backend's String(80) column. */
const NAME_MAX = 80;

/**
 * Who the user is: the name the app calls them, and — read-only — the email
 * and sign-in methods that belong to their Supabase account.
 *
 * An empty name is a real choice, not an error: it falls back to the name the
 * sign-in provider supplied, which is what the placeholder shows.
 */
export function AccountForm({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: () => Promise<void>;
}) {
  const { session } = useSession();
  const user = session?.user;
  // null means "not touched yet", so the field follows the profile until
  // someone types — the same pattern as the currency form.
  const [typed, setTyped] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stored = profile.display_name ?? '';
  const name = typed ?? stored;
  const dirty = name.trim() !== stored;
  const fromProvider = providerNameOf(user);
  const shown = displayNameOf(profile, user);
  const methods = signInMethodsOf(user);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await api.patch<Profile>('/auth/me', { display_name: name.trim() || null });
      await onSaved();
      setTyped(null);
      setSaved(true);
      announceProfileChange();
    } catch (err: unknown) {
      setError(describeError(err, 'Could not save your name.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard title="Account" description="How the app addresses you, and how you sign in.">
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-fg"
        >
          {initialOf(shown, user?.email)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{shown ?? 'No name yet'}</p>
          <p className="truncate text-sm text-fg-muted">{user?.email}</p>
        </div>
      </div>

      <form className="mt-6" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium" htmlFor="display-name">
          Name
        </label>
        <input
          id="display-name"
          className="mt-1.5 min-h-11 w-full max-w-sm rounded-lg border bg-surface px-3 text-sm"
          value={name}
          maxLength={NAME_MAX}
          autoComplete="name"
          placeholder={fromProvider ?? 'What should we call you?'}
          disabled={busy}
          aria-describedby="display-name-hint"
          onChange={(e) => {
            setTyped(e.target.value);
            setSaved(false);
          }}
        />
        <p id="display-name-hint" className="mt-1.5 text-xs text-fg-muted">
          {fromProvider && !stored
            ? 'Leave empty to keep using the name from your sign-in provider.'
            : 'Shown in the account menu.'}
        </p>

        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Email</dt>
            <dd className="mt-1 truncate text-fg-muted">{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="font-medium">Signs in with</dt>
            <dd className="mt-1 text-fg-muted">{methods.length ? methods.join(' · ') : '—'}</dd>
          </div>
        </dl>

        <SaveRow busy={busy} dirty={dirty} saved={saved} error={error} />
      </form>
    </SettingsCard>
  );
}
