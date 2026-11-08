import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';

import { Button } from '@/components/button';
import { ChoiceChips } from '@/components/chips';
import { confirm } from '@/components/confirm';
import { DateField } from '@/components/date-field';
import { CategoryChips } from '@/components/finance/category-chips';
import { CurrencyField } from '@/components/finance/currency-field';
import { FormScreen, useLeaveGuard } from '@/components/form-screen';
import { Screen } from '@/components/screen';
import { EmptyState, LoadingState } from '@/components/states';
import { TextField } from '@/components/text-field';
import { api } from '@/lib/api-client';
import { todayIso } from '@/lib/dates';
import { describeError } from '@/lib/describe-error';
import { preselectedCategoryId } from '@/lib/finance/categories';
import {
  useFinanceBasics,
  useFinanceDelete,
  useFinanceWrite,
  useSubscriptions,
} from '@/lib/finance/queries';
import {
  subscriptionPayload,
  subscriptionProblems,
  subscriptionValues,
  unitLabel,
  type SubscriptionProblems,
  type SubscriptionValues,
} from '@/lib/finance/subscription-form';
import type { BillingInterval, Category, Subscription } from '@/lib/finance/types';
import { SPACE } from '@/theme/scale';

const UNITS: BillingInterval[] = ['day', 'week', 'month', 'year'];

/**
 * Adding or editing one subscription — the phone's twin of the web's subscription form.
 * `/subscription` adds; `/subscription?id=…` edits, and only editing offers Cancelled on.
 */
export default function SubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const basics = useFinanceBasics();
  const subscriptions = useSubscriptions();
  const subscription = id ? subscriptions.data?.find((row) => row.id === id) : null;
  const title = id ? 'Edit subscription' : 'New subscription';

  if (basics.loading || (id && subscriptions.isPending)) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Screen>
          <LoadingState rows={3} />
        </Screen>
      </>
    );
  }

  if (id && !subscription) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Screen>
          <EmptyState
            icon="search_off"
            message="That subscription no longer exists — someone may have deleted it."
          />
        </Screen>
      </>
    );
  }

  return (
    <SubscriptionEditor
      subscription={subscription ?? null}
      categories={basics.categories.data ?? []}
      currencies={basics.currencies}
      defaultCurrency={basics.defaultCurrency}
    />
  );
}

/**
 * The form, started once. The billing cycle is "Every [count] [unit]" — quarterly is every 3
 * months — with the unit as chips that read in the singular or plural to match the count. A free
 * trial moves the first charge to the day it ends. A new subscription starts today, under the
 * category called Subscriptions if there is one.
 */
function SubscriptionEditor({
  subscription,
  categories,
  currencies,
  defaultCurrency,
}: {
  subscription: Subscription | null;
  categories: Category[];
  currencies: string[];
  defaultCurrency: string;
}) {
  const [initial] = useState(() =>
    subscriptionValues(subscription, {
      currency: defaultCurrency,
      categoryId: preselectedCategoryId(categories),
      today: todayIso(),
    })
  );
  const [values, setValues] = useState<SubscriptionValues>(initial);
  const [problems, setProblems] = useState<SubscriptionProblems>({});
  const [error, setError] = useState<string | null>(null);
  const nameField = useRef<TextInputInstance>(null);
  const amountField = useRef<TextInputInstance>(null);
  const countField = useRef<TextInputInstance>(null);
  const editing = subscription !== null;

  const save = useFinanceWrite((body: ReturnType<typeof subscriptionPayload>) =>
    subscription
      ? api.patch<Subscription>(`/finance/subscriptions/${subscription.id}`, body)
      : api.post<Subscription>('/finance/subscriptions', body)
  );
  const remove = useFinanceDelete(`/finance/subscriptions/${subscription?.id}`);
  const dirty = (Object.keys(values) as (keyof SubscriptionValues)[]).some(
    (key) => values[key] !== initial[key]
  );
  const leave = useLeaveGuard(dirty);
  const busy = save.isPending || remove.isPending;

  function set<K extends keyof SubscriptionValues>(key: K, value: SubscriptionValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (Object.keys(problems).length > 0) setProblems(subscriptionProblems(next));
  }

  async function submit() {
    const found = subscriptionProblems(values);
    setProblems(found);
    if (found.name) return nameField.current?.focus();
    if (found.amount) return amountField.current?.focus();
    if (found.interval_count) return countField.current?.focus();
    if (Object.keys(found).length > 0) return;
    setError(null);
    try {
      await save.mutateAsync(subscriptionPayload(values, editing));
      leave();
    } catch (err) {
      setError(
        describeError(
          err,
          editing ? 'Could not update that subscription.' : 'Could not save that subscription.'
        )
      );
    }
  }

  function askToDelete(stored: Subscription) {
    confirm({
      title: `Delete ${stored.name}?`,
      message: 'Expenses it already logged stay. To stop it renewing, set Cancelled on instead.',
      confirmLabel: 'Yes, delete',
      destructive: true,
      onConfirm: async () => {
        setError(null);
        try {
          await remove.mutateAsync();
          leave();
        } catch (err) {
          setError(describeError(err, 'Could not delete that subscription.'));
        }
      },
    });
  }

  return (
    <FormScreen
      title={editing ? 'Edit subscription' : 'New subscription'}
      submitLabel={editing ? 'Save' : 'Add subscription'}
      busy={busy}
      busyLabel={remove.isPending ? 'Deleting…' : 'Saving…'}
      error={error}
      onSubmit={submit}
    >
      <TextField
        ref={nameField}
        label="Name"
        kind="text"
        value={values.name}
        onChangeText={(name) => set('name', name)}
        error={problems.name}
        maxLength={80}
        autoFocus={!editing}
      />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md }}>
        <View style={{ flex: 3 }}>
          <TextField
            ref={amountField}
            label="Amount"
            kind="amount"
            value={values.amount}
            onChangeText={(amount) => set('amount', amount)}
            error={problems.amount}
          />
        </View>
        <View style={{ flex: 2 }}>
          <CurrencyField
            value={values.currency}
            onChange={(currency) => set('currency', currency)}
            currencies={currencies}
          />
        </View>
      </View>
      <TextField
        ref={countField}
        label="Every"
        kind="integer"
        value={values.interval_count}
        onChangeText={(count) => set('interval_count', count)}
        error={problems.interval_count}
        maxLength={3}
        hint="How many units between charges — 3 months is quarterly."
      />
      <ChoiceChips
        label="Unit"
        options={UNITS.map((unit) => ({
          value: unit,
          label: unitLabel(unit, values.interval_count),
        }))}
        selected={values.interval_unit}
        onSelect={(unit) => set('interval_unit', unit)}
      />
      <DateField
        label="Started"
        value={values.started_on}
        onChange={(started_on) => set('started_on', started_on)}
      />
      <DateField
        label="Free trial ends"
        value={values.trial_ends_on}
        onChange={(trial_ends_on) => set('trial_ends_on', trial_ends_on)}
        optional
        emptyLabel="No free trial"
        minimum={values.started_on || undefined}
        hint="The first charge falls on this day instead."
        error={problems.trial_ends_on}
      />
      <CategoryChips
        categories={categories}
        value={values.category_id}
        onChange={(category_id) => set('category_id', category_id)}
      />
      {editing && (
        <DateField
          label="Cancelled on"
          value={values.cancelled_on}
          onChange={(cancelled_on) => set('cancelled_on', cancelled_on)}
          optional
          emptyLabel="Still running"
          minimum={values.started_on || undefined}
          hint="It stops renewing from this day. Clear it to resume."
          error={problems.cancelled_on}
        />
      )}
      {subscription && (
        <Button
          label="Delete subscription"
          icon="delete"
          variant="danger"
          fullWidth
          disabled={busy}
          onPress={() => askToDelete(subscription)}
        />
      )}
    </FormScreen>
  );
}
