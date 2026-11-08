import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ArrangeScreen } from '@/components/finance/arrange-screen';
import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { formatMonth, monthStart } from '@/lib/dates';
import { tintOrder } from '@/lib/finance/budgets';
import { loadError, useBudgetProgress } from '@/lib/finance/queries';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * Arranging the budgets of the month on screen. Only those are sent; budgets of other months keep
 * their places, as on the web. Each row keeps its card's pastel, so the list being arranged is
 * recognisably the one on the Budgets screen.
 */
export default function ArrangeBudgets() {
  const { month = monthStart() } = useLocalSearchParams<{ month?: string }>();
  const { budgetTints } = useAppTheme();
  const progress = useBudgetProgress(month);

  if (!progress.data) {
    return (
      <>
        <Stack.Screen options={{ title: 'Arrange budgets' }} />
        <Screen>
          {progress.error ? (
            <ErrorState
              message={loadError(progress, 'Could not load this list.') ?? ''}
              onRetry={() => progress.refetch()}
            />
          ) : (
            <LoadingState rows={3} />
          )}
        </Screen>
      </>
    );
  }

  const tints = tintOrder(progress.data, budgetTints.length);
  return (
    <ArrangeScreen
      title="Arrange budgets"
      items={progress.data}
      path="/finance/budgets/order"
      nameOf={(budget) => budget.name}
      hint={`The budgets of ${formatMonth(month)}. Drag the handles or use the arrows, then Save order — it’s kept on all your devices.`}
      renderRow={(budget) => (
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACE.md,
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: RADIUS.control,
              backgroundColor: budgetTints[tints.get(budget.id) ?? 0],
            }}
          />
          <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {budget.name}
          </Text>
        </View>
      )}
    />
  );
}
