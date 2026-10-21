'use client';

import { BellRing, Pencil, Repeat } from 'lucide-react';
import { useState } from 'react';

import { DeleteButton } from '@/components/finance/delete-button';
import { IconButton, Panel, PanelButton, PanelEmpty, PanelNote } from '@/components/finance/panel';
import {
  SubscriptionForm,
  preselectedCategoryId,
  type SubscriptionValues,
} from '@/components/finance/subscription-form';
import { api } from '@/lib/api-client';
import { daysUntil, formatDate, todayIso } from '@/lib/dates';
import { describeError, type Collection } from '@/lib/hooks/use-collection';
import { NEUTRAL_COLOUR, cardTint, withAlpha } from '@/lib/tint';
import { formatInterval, formatMoney, type Category, type Subscription } from '@/lib/types/finance';
import { announceNotificationsChange } from '@/lib/types/notification';

/**
 * Days before a charge that a subscription counts as "renewing soon" — the same
 * three-day window the reminders use, so the card and the reminder agree.
 */
const REMINDER_DAYS = 3;

/** "netflix" → "N"; the first letter or digit, so "(Old) Plan" still gets one. */
function initialOf(name: string): string {
  return (name.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase();
}

function inDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/**
 * The one line that says what happens next to this subscription.
 *
 * Inside the reminder window it counts down instead of giving a date, and is
 * drawn as a warning: "renews in 2 days" is the thing worth noticing, and it is
 * what leaves time to cancel.
 */
function nextStep(subscription: Subscription, today: string): { text: string; soon: boolean } {
  const { cancelled_on, next_billing_on, trial_ends_on } = subscription;
  if (cancelled_on && cancelled_on <= today) {
    return { text: `Cancelled ${formatDate(cancelled_on)}`, soon: false };
  }

  // The first charge is the end of the trial, so while that is still ahead
  // the next charge *is* the trial ending.
  const trial = trial_ends_on !== null && trial_ends_on === next_billing_on;
  const verb = trial ? 'Trial ends' : 'Renews';
  const days = daysUntil(next_billing_on, today);
  const ending = cancelled_on ? ` · ends ${formatDate(cancelled_on)}` : '';

  if (days < 0) {
    // Nothing has advanced the date yet — the renewal job is what does that.
    return { text: `Was due ${formatDate(next_billing_on)}${ending}`, soon: false };
  }
  if (days <= REMINDER_DAYS) {
    return { text: `${verb} ${inDays(days)}${ending}`, soon: true };
  }
  return { text: `${verb} ${formatDate(next_billing_on)}${ending}`, soon: false };
}

interface SubscriptionSectionProps {
  subscriptions: Collection<Subscription>;
  categories: Category[];
  currencies: string[];
  defaultCurrency: string;
  onChange: () => void;
}

export function SubscriptionSection({
  subscriptions,
  categories,
  currencies,
  defaultCurrency,
  onChange,
}: SubscriptionSectionProps) {
  const { items, loading, error, reload, setError } = subscriptions;
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = new Map(categories.map((category) => [category.id, category]));
  const today = todayIso();

  async function run(action: () => Promise<unknown>, fallback: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      // The backend rewrote this subscription's reminder in the same request;
      // the bell refetches so it shows the new one at once.
      announceNotificationsChange();
      await reload();
      onChange();
      return true;
    } catch (err: unknown) {
      setError(describeError(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }

  /**
   * The body for both create and update. Every nullable field is sent
   * explicitly, so clearing a field in the edit form clears it on the server
   * rather than being read as "leave it alone".
   */
  function payload(values: SubscriptionValues, editing: boolean) {
    return {
      name: values.name.trim(),
      amount: values.amount.trim(),
      currency: values.currency,
      interval_unit: values.interval_unit,
      interval_count: Number(values.interval_count),
      category_id: values.category_id || null,
      started_on: values.started_on,
      trial_ends_on: values.trial_ends_on || null,
      ...(editing ? { cancelled_on: values.cancelled_on || null } : {}),
    };
  }

  async function handleCreate(values: SubscriptionValues) {
    const created = await run(
      () => api.post('/finance/subscriptions', payload(values, false)),
      'Could not save that subscription.'
    );
    if (created) setAdding(false);
  }

  async function handleUpdate(id: string, values: SubscriptionValues) {
    const updated = await run(
      () => api.patch(`/finance/subscriptions/${id}`, payload(values, true)),
      'Could not update that subscription.'
    );
    if (updated) setEditingId(null);
  }

  return (
    <Panel
      title="Subscriptions"
      error={error}
      className="h-full"
      action={
        <PanelButton
          label="New subscription"
          onClick={() => {
            setEditingId(null);
            setAdding((open) => !open);
          }}
        >
          {adding ? 'Cancel' : 'New'}
        </PanelButton>
      }
    >
      {adding && (
        <SubscriptionForm
          idPrefix="new-subscription"
          initial={{
            name: '',
            amount: '',
            currency: defaultCurrency,
            interval_unit: 'month',
            interval_count: '1',
            category_id: preselectedCategoryId(categories),
            started_on: today,
            trial_ends_on: '',
            cancelled_on: '',
          }}
          categories={categories}
          currencies={currencies}
          editing={false}
          busy={busy}
          onSubmit={(values) => void handleCreate(values)}
          onCancel={() => setAdding(false)}
        />
      )}

      {loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : items.length === 0 && error ? null : items.length === 0 ? (
        !adding && (
          <PanelEmpty icon={Repeat}>
            No subscriptions yet. Each renewal is logged as an expense on its billing date.
          </PanelEmpty>
        )
      ) : (
        <ul className="space-y-2 p-3">
          {items.map((subscription) => {
            if (editingId === subscription.id) {
              return (
                <li
                  key={subscription.id}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <SubscriptionForm
                    idPrefix={`subscription-${subscription.id}`}
                    initial={{
                      name: subscription.name,
                      amount: subscription.amount,
                      currency: subscription.currency,
                      interval_unit: subscription.interval_unit,
                      interval_count: String(subscription.interval_count),
                      category_id: subscription.category_id ?? '',
                      started_on: subscription.started_on,
                      trial_ends_on: subscription.trial_ends_on ?? '',
                      cancelled_on: subscription.cancelled_on ?? '',
                    }}
                    categories={categories}
                    currencies={currencies}
                    editing
                    busy={busy}
                    onSubmit={(values) => void handleUpdate(subscription.id, values)}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              );
            }

            const category = subscription.category_id
              ? byId.get(subscription.category_id)
              : undefined;
            const step = nextStep(subscription, today);
            const ended = subscription.cancelled_on !== null && subscription.cancelled_on <= today;

            return (
              <li
                key={subscription.id}
                className={`flex gap-3 rounded-xl px-3 py-2.5 ${ended ? 'opacity-60' : ''}`}
                style={{ backgroundColor: cardTint(category?.colour) }}
              >
                {/* The service's initial, like an app icon on a statement: the
                    quickest way to find "Netflix" in a list is its shape. */}
                <span
                  aria-hidden
                  className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold"
                  style={{ backgroundColor: withAlpha(category?.colour ?? NEUTRAL_COLOUR, 0.28) }}
                >
                  {initialOf(subscription.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1">
                    <p className="min-w-0 flex-1 truncate pt-1 text-sm font-semibold">
                      {subscription.name}
                    </p>
                    <IconButton
                      label={`Edit ${subscription.name}`}
                      icon={Pencil}
                      onClick={() => {
                        setAdding(false);
                        setEditingId(subscription.id);
                      }}
                    />
                    <DeleteButton
                      label={`Delete ${subscription.name}`}
                      prompt="Delete? Expenses it already logged stay."
                      busy={busy}
                      onConfirm={() =>
                        void run(
                          () => api.delete(`/finance/subscriptions/${subscription.id}`),
                          'Could not delete that subscription.'
                        )
                      }
                    />
                  </div>

                  <p className="text-sm">
                    <span className="font-medium">
                      {formatMoney(subscription.amount, subscription.currency)}
                    </span>
                    <span className="text-fg-muted">
                      {' / '}
                      {formatInterval(subscription.interval_unit, subscription.interval_count)}
                    </span>
                  </p>

                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs">
                    {step.soon && (
                      <BellRing aria-hidden className="size-3.5 shrink-0 text-negative" />
                    )}
                    <span className={step.soon ? 'font-medium text-negative' : 'text-fg-muted'}>
                      {step.text}
                    </span>
                    <span className="truncate text-fg-muted">
                      {' · '}
                      {category?.name ?? 'Uncategorised'}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
