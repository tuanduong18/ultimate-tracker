import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { Button } from '@/components/button';
import { CardListItem } from '@/components/card';
import { Fab, FAB_CLEARANCE } from '@/components/fab';
import { ExpenseRow } from '@/components/finance/expense-row';
import { TransactionFilterBar } from '@/components/finance/transaction-filters';
import { FormError } from '@/components/form-error';
import { usePullToRefresh } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { api } from '@/lib/api-client';
import { todayIso } from '@/lib/dates';
import { describeError } from '@/lib/describe-error';
import { XLSX_TYPE } from '@/lib/finance/import';
import { loadError, useExpenses, useFinanceBasics } from '@/lib/finance/queries';
import {
  describeFilters,
  isFiltered,
  matcher,
  NO_FILTERS,
  totalsByCurrency,
  type TransactionFilters,
} from '@/lib/finance/transaction-query';
import type { Expense } from '@/lib/finance/types';
import { formatMoney } from '@/lib/money';
import { shareFile } from '@/lib/share-file';
import { SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

const noun = (n: number) => `${n.toLocaleString()} transaction${n === 1 ? '' : 's'}`;

/**
 * Every expense, newest first, searchable and filterable — the phone's Transactions, twin of the
 * web's tab of that name. All of them are loaded and filtered on the phone, so a search answers
 * on the keystroke; the list is virtualised, so there is no "Show 50 more" to tap through.
 *
 * Above the rows: the search, the three filters, the line that says how many match and what
 * they add up to, one exact total per currency — then Export and Import, as on the web. Export
 * takes exactly the rows that line counts, so the file is what the screen showed. Adding is the
 * floating button; tapping a row opens it to edit.
 */
export default function Transactions() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const expenses = useExpenses();
  const { categories, defaultCurrency } = useFinanceBasics();
  const [filters, setFilters] = useState<TransactionFilters>(NO_FILTERS);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const refresh = usePullToRefresh(() => Promise.all([expenses.refetch(), categories.refetch()]));

  const list = useMemo(() => categories.data ?? [], [categories.data]);
  const byId = useMemo(() => new Map(list.map((c) => [c.id, c])), [list]);
  const all = useMemo(() => expenses.data ?? [], [expenses.data]);
  const matching = useMemo(() => all.filter(matcher(filters, list)), [all, filters, list]);
  const usedCurrencies = useMemo(() => [...new Set(all.map((e) => e.currency))].sort(), [all]);
  const filtered = isFiltered(filters);

  const open = (expense: Expense) =>
    router.push({ pathname: '/expense', params: { id: expense.id } });

  /**
   * The rows on screen as an Excel file, built by the server (with a converted column and an
   * About sheet that lists these filters), then handed to Android's share sheet. The sheet opening
   * is the confirmation; a failure stays under the buttons until the next try.
   */
  async function exportToExcel() {
    setExporting(true);
    setExportError(null);
    try {
      const bytes = await api.download('/finance/expenses/export', {
        expense_ids: matching.map((expense) => expense.id),
        filters: describeFilters(filters, list),
      });
      await shareFile(bytes, `transactions-${todayIso()}.xlsx`, XLSX_TYPE);
    } catch (err) {
      setExportError(describeError(err, 'Could not export these transactions. Try again.'));
    } finally {
      setExporting(false);
    }
  }

  const header = (
    <View style={{ gap: SPACE.md, paddingBottom: SPACE.md }}>
      <SearchField
        label="Search transactions"
        placeholder="Search description, category, date or amount"
        value={filters.q}
        onChangeText={(q) => setFilters({ ...filters, q })}
      />
      <TransactionFilterBar
        filters={filters}
        onChange={setFilters}
        categories={list}
        currencies={usedCurrencies}
        defaultCurrency={defaultCurrency}
      />
      {expenses.data && all.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
          <Text
            variant="caption"
            tone="fgMuted"
            style={{ flex: 1 }}
            accessibilityLiveRegion="polite"
          >
            {statusLine(matching, all.length, filtered)}
          </Text>
          {filtered && (
            <Button label="Clear filters" variant="text" onPress={() => setFilters(NO_FILTERS)} />
          )}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
        {all.length > 0 && (
          <Button
            label={exporting ? 'Exporting…' : 'Export'}
            icon="ios_share"
            accessibilityLabel={`Export ${noun(matching.length)} to Excel`}
            disabled={exporting || matching.length === 0}
            onPress={() => void exportToExcel()}
          />
        )}
        <Button
          label="Import"
          icon="upload_file"
          accessibilityLabel="Import expenses from a spreadsheet"
          onPress={() => router.push('/import-expenses')}
        />
      </View>
      {exportError ? <FormError message={exportError} /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Transactions' }} />
      <FlatList
        data={expenses.data ? matching : []}
        keyExtractor={(expense) => expense.id}
        renderItem={({ item, index }) => (
          <CardListItem index={index} count={matching.length}>
            <ExpenseRow
              expense={item}
              category={item.category_id ? byId.get(item.category_id) : undefined}
              onPress={() => open(item)}
            />
          </CardListItem>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          expenses.isPending ? (
            <LoadingState rows={6} />
          ) : expenses.error && !expenses.data ? (
            <ErrorState
              message={loadError(expenses, 'Could not load this list.') ?? ''}
              onRetry={() => expenses.refetch()}
            />
          ) : all.length === 0 ? (
            <EmptyState
              icon="receipt_long"
              message="Nothing logged yet. Use Add expense to log your first one."
            />
          ) : (
            <EmptyState
              icon="search_off"
              message="No transactions match these filters."
              action={{ label: 'Clear filters', onPress: () => setFilters(NO_FILTERS) }}
            />
          )
        }
        refreshControl={refresh}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: FAB_CLEARANCE }}
      />
      <Fab label="Add expense" onPress={() => router.push('/expense')} />
    </View>
  );
}

/** "12 of 312 transactions · S$120.00 + ₫50,000" — what is shown, and what it adds up to. */
function statusLine(matching: readonly Expense[], total: number, filtered: boolean): string {
  const count = filtered ? `${matching.length.toLocaleString()} of ${noun(total)}` : noun(total);
  const sums = totalsByCurrency(matching)
    .map(({ currency, total: sum }) => formatMoney(sum, currency))
    .join(' + ');
  return sums ? `${count} · ${sums}` : count;
}
