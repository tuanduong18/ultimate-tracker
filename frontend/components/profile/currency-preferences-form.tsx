'use client';

import { useState } from 'react';

import { CurrencySelect } from '@/components/finance/currency-select';
import { SaveRow, SettingsCard } from '@/components/profile/settings-card';
import { api } from '@/lib/api-client';
import { describeError, useCollection } from '@/lib/hooks/use-collection';
import type { Profile } from '@/lib/types/profile';

type CurrencyField = 'preferred_currency' | 'display_currency';

/**
 * The two currencies on a profile, saved together.
 *
 * They are separate because they diverge exactly when it matters: someone who
 * reports in SGD but is spending VND on a trip wants new expenses to start in
 * VND without their totals flipping to it. Only the totals convert — expenses
 * and budgets keep the currency they were recorded in, which is why the copy
 * says "reported in" rather than "converted to".
 */
export function CurrencyPreferencesForm({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: () => Promise<void>;
}) {
  const currencies = useCollection<string>('/finance/currencies');
  // Only what has been touched; untouched fields follow the profile. Derived
  // rather than copied into state by an effect, so the two cannot disagree.
  const [picked, setPicked] = useState<Partial<Record<CurrencyField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preferred = picked.preferred_currency ?? profile.preferred_currency;
  const display = picked.display_currency ?? profile.display_currency;
  const changes = Object.fromEntries(
    Object.entries(picked).filter(([field, value]) => profile[field as CurrencyField] !== value)
  );
  const dirty = Object.keys(changes).length > 0;

  function pick(field: CurrencyField, value: string) {
    setPicked((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await api.patch<Profile>('/auth/me', changes);
      await onSaved();
      setPicked({});
      setSaved(true);
    } catch (err: unknown) {
      setError(describeError(err, 'Could not save those currencies.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard title="Currencies" description="Where new entries start, and how totals add up.">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" htmlFor="preferred-currency">
              Preferred currency
            </label>
            <CurrencySelect
              id="preferred-currency"
              value={preferred}
              currencies={currencies.items}
              disabled={busy}
              onChange={(next) => pick('preferred_currency', next)}
            />
            <p className="mt-1.5 text-xs text-fg-muted">
              New expenses, budgets and subscriptions start in this currency.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="display-currency">
              Report totals in
            </label>
            <CurrencySelect
              id="display-currency"
              value={display}
              currencies={currencies.items}
              disabled={busy}
              onChange={(next) => pick('display_currency', next)}
            />
            <p className="mt-1.5 text-xs text-fg-muted">
              Finance totals are converted into this currency. Each entry keeps its own.
            </p>
          </div>
        </div>

        <SaveRow busy={busy} dirty={dirty} saved={saved} error={error} />
      </form>
    </SettingsCard>
  );
}
