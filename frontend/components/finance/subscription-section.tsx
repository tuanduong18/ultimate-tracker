'use client';

import { BellRing, CalendarCheck, Check, Pencil, Repeat } from 'lucide-react';
import { useState } from 'react';

import { ConfirmButton } from '@/components/finance/confirm-button';
import { DeleteButton } from '@/components/finance/delete-button';
import { IconButton, Panel, PanelButton, PanelEmpty, PanelNote } from '@/components/finance/panel';
import {
  SubscriptionForm,
  preselectedCategoryId,
  type SubscriptionValues,
} from '@/components/finance/subscription-form';
import { api } from '@/lib/api-client';
import { daysUntil, formatDate, todayIso } from '@/lib/dates';
import { announceExpensesChange } from '@/lib/finance-events';
import { describeError, type Collection } from '@/lib/hooks/use-collection';
import { useRowFocus } from '@/lib/hooks/use-row-focus';
import { NEUTRAL_COLOUR, withAlpha } from '@/lib/tint';
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

/**
 * Whether the next charge will happen, so that paying it early means anything.
 * The server's rule: a cancellation on or before the charge stops it.
 */
function renewable({ cancelled_on, next_billing_on }: Subscription): boolean {
  return cancelled_on === null || cancelled_on > next_billing_on;
}

function renewLabel(subscription: Subscription): string {
  return `Renew ${subscription.name} now`;
}

/**
 * A confirm strip drops to a line of its own under the name. In place, beside
 * the icons, it squeezed the name to nothing on a phone — and the name is
 * what says which subscription is being renewed or deleted.
 */
const STRIP_OWN_LINE = 'order-last mb-1 basis-full';

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
  // The row whose "Renewed" line shows, until the next action replaces it.
  const [renewedId, setRenewedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { panelRef, ...focus } = useRowFocus(items);

  const byId = new Map(categories.map((category) => [category.id, category]));
  const today = todayIso();

  async function run(action: () => Promise<unknown>, fallback: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    setRenewedId(null);
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
    if (created) {
      focus.returnToAction();
      setAdding(false);
    }
  }

  async function handleUpdate(id: string, values: SubscriptionValues) {
    const updated = await run(
      () => api.patch(`/finance/subscriptions/${id}`, payload(values, true)),
      'Could not update that subscription.'
    );
    if (updated) {
      focus.returnToRow(id);
      setEditingId(null);
    }
  }

  /**
   * Renewing early: the server logs the charge as an expense dated today and
   * moves the next charge on by one period, keeping the billing day.
   */
  async function handleRenew(subscription: Subscription) {
    const renewed = await run(
      () => api.post(`/finance/subscriptions/${subscription.id}/renew`, {}),
      'Could not renew that subscription.'
    );
    if (renewed) {
      // The row re-sorts by its new date, and moving it drops the focus.
      focus.returnToRow(subscription.id, renewLabel(subscription));
      setRenewedId(subscription.id);
      announceExpensesChange();
    }
  }

  async function handleDelete(id: string) {
    focus.removing(id);
    const deleted = await run(
      () => api.delete(`/finance/subscriptions/${id}`),
      'Could not delete that subscription.'
    );
    if (!deleted) focus.cancel();
  }

  return (
    <Panel
      ref={panelRef}
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
          onCancel={() => {
            focus.returnToAction();
            setAdding(false);
          }}
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
                    onCancel={() => {
                      focus.returnToRow(subscription.id);
                      setEditingId(null);
                    }}
                  />
                </li>
              );
            }

            const category = subscription.category_id
              ? byId.get(subscription.category_id)
              : undefined;
            const step = nextStep(subscription, today);
            const money = formatMoney(subscription.amount, subscription.currency);
            const ended = subscription.cancelled_on !== null && subscription.cancelled_on <= today;

            return (
              <li
                key={subscription.id}
                data-row-id={subscription.id}
                // Ended is told in words (the next-step line) and by a dashed outline
                // on a bare background — not by fading the row, which faded the
                // text with it, to under 3:1.
                className={`flex gap-3 rounded-xl px-3 py-2.5 ${
                  ended ? 'border border-dashed border-border-control' : 'bg-surface-muted'
                }`}
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
                  <div className="flex flex-wrap items-start gap-1">
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
                    {/* Confirmed, though nothing is destroyed: it writes money and
                        moves a date that deleting the expense would not move back.
                        The prompt shows the amount, so a stale price is caught. */}
                    {renewable(subscription) && (
                      <ConfirmButton
                        label={renewLabel(subscription)}
                        icon={CalendarCheck}
                        prompt={`Renew now? Logs ${money} today for the ${formatDate(
                          subscription.next_billing_on
                        )} charge.`}
                        confirmLabel="Yes, renew"
                        keepLabel="Not now"
                        groupLabel="Confirm renewal"
                        stripClassName={STRIP_OWN_LINE}
                        busy={busy}
                        onConfirm={() => void handleRenew(subscription)}
                      />
                    )}
                    <DeleteButton
                      label={`Delete ${subscription.name}`}
                      prompt="Delete? Expenses it already logged stay."
                      stripClassName={STRIP_OWN_LINE}
                      busy={busy}
                      onConfirm={() => void handleDelete(subscription.id)}
                    />
                  </div>

                  <p className="text-sm">
                    <span className="font-medium">{money}</span>
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

                  {/* On every row from the start, so the line is announced when
                      it fills: the expense it reports is on another page. */}
                  <p role="status" className="text-xs text-fg-muted">
                    {renewedId === subscription.id && (
                      <span className="mt-1 flex items-center gap-1">
                        <Check aria-hidden className="size-3.5 shrink-0 text-positive" />
                        Renewed — {money} logged today.
                      </span>
                    )}
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
