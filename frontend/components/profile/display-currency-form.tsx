'use client';

import { useState } from 'react';

import { CurrencySelect } from '@/components/finance/currency-select';
import { api } from '@/lib/api-client';
import { describeError, useCollection, useResource } from '@/lib/hooks/use-collection';
import type { Profile } from '@/lib/types/profile';

/**
 * Choose the currency the finance totals are reported in.
 *
 * Only the totals convert — expenses and budgets keep the currency they were
 * recorded in, which is why the copy says "reported in" rather than "converted
 * to". Without this control the summary is stuck on the USD default the column
 * ships with, which is the wrong answer for most people.
 */
export function DisplayCurrencyForm() {
  const profile = useResource<Profile>('/auth/me');
  const currencies = useCollection<string>('/finance/currencies');
  // null means "not touched yet", so the picker follows the profile until the
  // moment someone picks something. Derived rather than copied into state by an
  // effect: syncing a prop into state is how the two end up disagreeing.
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const stored = profile.data?.display_currency ?? null;
  const currency = picked ?? stored;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currency === null) return;
    setBusy(true);
    setSaved(false);
    profile.setError(null);
    try {
      await api.patch<Profile>('/auth/me', { display_currency: currency });
      await profile.reload();
      setSaved(true);
    } catch (err: unknown) {
      profile.setError(describeError(err, 'Could not save that currency.'));
    } finally {
      setBusy(false);
    }
  }

  if (profile.loading) {
    return <p className="mt-6 text-sm text-gray-500">Loading…</p>;
  }

  return (
    <section className="mt-8 max-w-md">
      <h2 className="text-lg font-medium">Display currency</h2>
      <p className="mt-1 text-sm text-gray-500">
        Finance totals are reported in this currency. Individual expenses and budgets keep the
        currency you entered them in.
      </p>

      {profile.error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {profile.error}
        </p>
      )}

      <form className="mt-3 flex items-end gap-3" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm" htmlFor="display-currency">
            Currency
          </label>
          <CurrencySelect
            id="display-currency"
            value={currency ?? 'USD'}
            currencies={currencies.items}
            disabled={busy}
            onChange={(next) => {
              setPicked(next);
              setSaved(false);
            }}
          />
        </div>
        <button
          type="submit"
          disabled={busy || currency === stored}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Save
        </button>
        {saved && <p className="py-2 text-sm text-green-700">Saved.</p>}
      </form>
    </section>
  );
}
