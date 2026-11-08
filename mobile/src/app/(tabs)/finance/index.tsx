import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Card, RowDivider } from '@/components/card';
import { Fab } from '@/components/fab';
import { ExpenseRow } from '@/components/finance/expense-row';
import { NavRow } from '@/components/nav-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { loadError, useCategories, useExpenses } from '@/lib/finance/queries';

/** How many of the newest expenses the Overview lists before "All transactions". */
const LATEST = 5;

/**
 * Finance's first screen: what was spent lately and the way into each part of Finance, with
 * Add expense under the thumb. The phone's Overview, twin of the web's Finance tab of that name;
 * the web's tabs become the rows here, each opening its own screen in this tab's stack — the
 * back gesture then always goes one level up, which tabs inside a tab would muddle.
 */
export default function Finance() {
  const router = useRouter();
  const expenses = useExpenses();
  const categories = useCategories();
  const byId = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data]
  );
  const latest = (expenses.data ?? []).slice(0, LATEST);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Finance' }} />
      <Screen withFab onRefresh={() => Promise.all([expenses.refetch(), categories.refetch()])}>
        <Section title="Latest expenses">
          {expenses.isPending ? (
            <LoadingState rows={3} />
          ) : expenses.error && !expenses.data ? (
            <ErrorState
              message={loadError(expenses, 'Could not load this list.') ?? ''}
              onRetry={() => expenses.refetch()}
            />
          ) : latest.length === 0 ? (
            <EmptyState
              icon="receipt_long"
              message="Nothing logged yet. Use Add expense to log your first one."
            />
          ) : (
            <Card>
              {latest.map((expense) => (
                <View key={expense.id}>
                  <ExpenseRow
                    expense={expense}
                    category={expense.category_id ? byId.get(expense.category_id) : undefined}
                    onPress={() =>
                      router.push({ pathname: '/expense', params: { id: expense.id } })
                    }
                  />
                  <RowDivider />
                </View>
              ))}
              <NavRow
                href="/finance/transactions"
                label="All transactions"
                blurb="Search, filter and edit every expense"
                icon="receipt_long"
              />
            </Card>
          )}
        </Section>
        <Section title="Plan and organise">
          <Card>
            <NavRow
              href="/finance/categories"
              label="Categories"
              blurb="Names, symbols, colours and their order"
              icon="sell"
            />
          </Card>
        </Section>
      </Screen>
      <Fab label="Add expense" onPress={() => router.push('/expense')} />
    </View>
  );
}
