import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Card, RowDivider } from '@/components/card';
import { confirm } from '@/components/confirm';
import { Fab } from '@/components/fab';
import { SubscriptionRow } from '@/components/finance/subscription-row';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { api } from '@/lib/api-client';
import { formatDate, todayIso } from '@/lib/dates';
import { describeError } from '@/lib/describe-error';
import { loadError, useCategories, useFinanceWrite, useSubscriptions } from '@/lib/finance/queries';
import type { Subscription } from '@/lib/finance/types';
import { formatMoney } from '@/lib/money';

type Note = { tone: 'done' | 'error'; text: string };

/**
 * What the person pays for on a cycle — the phone's twin of the web's Subscriptions tab. In the
 * server's order, the next charge first and the cancelled at the end; not arrangeable, by choice,
 * since "what bills next" is the order that answers the question people bring here.
 *
 * Renew now logs the next charge today and moves the date on — it writes money, so it asks first,
 * in the default tone (nothing is destroyed), naming the amount and the charge it pays. Its result
 * stays on the row. Cancelling is in the subscription's form, as a date, because a fixed-term plan
 * is often cancelled from a day still ahead.
 */
export default function Subscriptions() {
  const router = useRouter();
  const subscriptions = useSubscriptions();
  const categories = useCategories();
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const byId = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data]
  );
  const renew = useFinanceWrite((id: string) =>
    api.post<Subscription>(`/finance/subscriptions/${id}/renew`, {})
  );
  const today = todayIso();
  const list = subscriptions.data ?? [];

  function askToRenew(subscription: Subscription) {
    const money = formatMoney(subscription.amount, subscription.currency);
    confirm({
      title: 'Renew now?',
      message: `Logs ${money} today for the ${formatDate(subscription.next_billing_on)} charge.`,
      confirmLabel: 'Yes, renew',
      cancelLabel: 'Not now',
      onConfirm: async () => {
        try {
          await renew.mutateAsync(subscription.id);
          setNotes({
            [subscription.id]: { tone: 'done', text: `Renewed — ${money} logged today.` },
          });
        } catch (err) {
          setNotes({
            [subscription.id]: {
              tone: 'error',
              text: describeError(err, 'Could not renew that subscription.'),
            },
          });
        }
      },
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Subscriptions' }} />
      <Screen
        withFab
        onRefresh={() => Promise.all([subscriptions.refetch(), categories.refetch()])}
      >
        {subscriptions.isPending ? (
          <LoadingState rows={3} />
        ) : subscriptions.error && !subscriptions.data ? (
          <ErrorState
            message={loadError(subscriptions, 'Could not load this list.') ?? ''}
            onRetry={() => subscriptions.refetch()}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon="autorenew"
            message="No subscriptions yet. Each renewal is logged as an expense on its billing date."
          />
        ) : (
          <Card>
            {list.map((subscription, index) => (
              <View key={subscription.id}>
                {index > 0 && <RowDivider />}
                <SubscriptionRow
                  subscription={subscription}
                  category={
                    subscription.category_id ? byId.get(subscription.category_id) : undefined
                  }
                  today={today}
                  onOpen={() => {
                    setNotes({});
                    router.push({ pathname: '/subscription', params: { id: subscription.id } });
                  }}
                  onRenew={() => askToRenew(subscription)}
                  renewing={renew.isPending}
                  note={notes[subscription.id]}
                />
              </View>
            ))}
          </Card>
        )}
      </Screen>
      <Fab
        label="New"
        accessibilityLabel="New subscription"
        onPress={() => router.push('/subscription')}
      />
    </View>
  );
}
