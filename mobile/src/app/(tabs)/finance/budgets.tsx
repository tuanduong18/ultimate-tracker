import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, IconButton } from '@/components/button';
import { Fab } from '@/components/fab';
import { BudgetCard } from '@/components/finance/budget-card';
import { HeaderAction } from '@/components/header-action';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { formatMonth, monthStart, shiftMonth } from '@/lib/dates';
import { tintOrder } from '@/lib/finance/budgets';
import { loadError, useBudgetProgress } from '@/lib/finance/queries';
import { SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The budgets that apply to one month, each measured against its cap — the phone's twin of the
 * web's Budgets tab. A monthly budget shows in every month it runs; a custom one in every month
 * its dates touch, measured over its whole range.
 *
 * The month steps with ‹ and ›, with This month to come back; stepping keeps the last month's
 * cards up until the next month's land. Cards are in the person's own order (Arrange, in the top
 * bar, sets it for the month on screen), each in the pastel of its creation order.
 */
export default function Budgets() {
  const router = useRouter();
  const { budgetTints } = useAppTheme();
  const [month, setMonth] = useState(() => monthStart());
  const progress = useBudgetProgress(month);
  const list = progress.data ?? [];
  const tints = tintOrder(list, budgetTints.length);
  const thisMonth = monthStart();

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Budgets',
          headerRight:
            list.length > 1
              ? () => (
                  <HeaderAction
                    label="Arrange"
                    accessibilityLabel="Arrange budgets"
                    onPress={() => router.push({ pathname: '/arrange-budgets', params: { month } })}
                  />
                )
              : undefined,
        }}
      />
      <Screen withFab onRefresh={() => progress.refetch()}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
          <IconButton
            icon="chevron_left"
            label="Previous month"
            onPress={() => setMonth(shiftMonth(month, -1))}
          />
          <Text
            variant="heading"
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            style={{ flex: 1, textAlign: 'center' }}
          >
            {formatMonth(month)}
          </Text>
          <IconButton
            icon="chevron_right"
            label="Next month"
            onPress={() => setMonth(shiftMonth(month, 1))}
          />
        </View>
        {month !== thisMonth && (
          <Button
            label="This month"
            variant="text"
            accessibilityLabel={`Back to ${formatMonth(thisMonth)}`}
            onPress={() => setMonth(thisMonth)}
          />
        )}

        {progress.isPending ? (
          <LoadingState rows={2} />
        ) : progress.error && !progress.data ? (
          <ErrorState
            message={loadError(progress, 'Could not load this list.') ?? ''}
            onRetry={() => progress.refetch()}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon="savings"
            message={`No budgets apply to ${formatMonth(month)}. A monthly budget resets on the 1st; a custom one covers dates you pick.`}
          />
        ) : (
          list.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              tint={budgetTints[tints.get(budget.id) ?? 0]}
              onPress={() => router.push({ pathname: '/budget', params: { id: budget.id, month } })}
            />
          ))
        )}
      </Screen>
      <Fab
        label="New budget"
        onPress={() => router.push({ pathname: '/budget', params: { month } })}
      />
    </View>
  );
}
