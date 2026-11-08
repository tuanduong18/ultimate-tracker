import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Card, RowDivider } from '@/components/card';
import { Fab } from '@/components/fab';
import { ExpenseRow } from '@/components/finance/expense-row';
import { RangeControl } from '@/components/finance/range-control';
import { SpendByCategoryChart } from '@/components/finance/spend-by-category-chart';
import { SpendByPeriodChart } from '@/components/finance/spend-by-period-chart';
import { SummaryTiles } from '@/components/finance/summary-tiles';
import { NavRow } from '@/components/nav-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { monthRange, type DateRange } from '@/lib/dates';
import { ALL_CATEGORIES, type CategorySelection } from '@/lib/finance/categories';
import { financeKeys, loadError, useCategories, useExpenses } from '@/lib/finance/queries';

/** How many of the newest expenses the Overview lists before "All transactions". */
const LATEST = 5;

/**
 * Finance's first screen — the phone's Overview, twin of the web's Finance tab of that name:
 * this month's spending and the next charge, the latest expenses, where the money went and how
 * it moved, then the way into each part of Finance. Add expense is under the thumb throughout.
 *
 * The web's tabs become rows here, each opening its own screen in this tab's stack, so the back
 * gesture always goes one level up — tabs inside a tab would muddle that. Pulling down reloads
 * everything on the screen.
 */
export default function Finance() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const expenses = useExpenses();
  const categories = useCategories();
  const [range, setRange] = useState<DateRange>(() => monthRange());
  const [selection, setSelection] = useState<CategorySelection>(ALL_CATEGORIES);
  const byId = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data]
  );
  const latest = (expenses.data ?? []).slice(0, LATEST);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Finance' }} />
      <Screen
        withFab
        onRefresh={() => queryClient.refetchQueries({ queryKey: financeKeys.all, type: 'active' })}
      >
        <SummaryTiles />

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

        <Section title="Spending">
          <RangeControl
            range={range}
            onRange={setRange}
            selection={selection}
            onSelection={setSelection}
            categories={categories.data ?? []}
          />
          <SpendByCategoryChart range={range} selection={selection} />
          <SpendByPeriodChart range={range} selection={selection} />
        </Section>

        <Section title="Plan and organise">
          <Card>
            <NavRow
              href="/finance/budgets"
              label="Budgets"
              blurb="Caps per month or over dates, and how they’re going"
              icon="savings"
            />
            <RowDivider />
            <NavRow
              href="/finance/subscriptions"
              label="Subscriptions"
              blurb="What renews, when, and renewing early"
              icon="autorenew"
            />
            <RowDivider />
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
