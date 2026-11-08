import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';

import { Button } from '@/components/button';
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
import { firstCategoryId } from '@/lib/finance/categories';
import {
  expenseName,
  expensePayload,
  expenseProblems,
  expenseValues,
  type ExpenseValues,
} from '@/lib/finance/expenses';
import {
  useExpenses,
  useFinanceBasics,
  useFinanceDelete,
  useFinanceWrite,
} from '@/lib/finance/queries';
import type { Category, Expense } from '@/lib/finance/types';
import { formatMoney } from '@/lib/money';
import { SPACE } from '@/theme/scale';

/**
 * Adding or editing one expense — the phone's twin of the web's Add expense dialog and inline
 * edit. `/expense` adds; `/expense?id=…` edits. There is no API route for one expense, so editing
 * finds it in the cached list every other screen already loaded.
 */
export default function ExpenseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const basics = useFinanceBasics();
  const expenses = useExpenses();
  const expense = id ? expenses.data?.find((row) => row.id === id) : null;
  const title = id ? 'Edit expense' : 'Add expense';

  if (basics.loading || (id && expenses.isPending)) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Screen>
          <LoadingState rows={3} />
        </Screen>
      </>
    );
  }

  if (id && !expense) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Screen>
          <EmptyState
            icon="search_off"
            message="That expense no longer exists — someone may have deleted it."
          />
        </Screen>
      </>
    );
  }

  return (
    <ExpenseEditor
      expense={expense ?? null}
      categories={basics.categories.data ?? []}
      currencies={basics.currencies}
      defaultCurrency={basics.defaultCurrency}
    />
  );
}

/**
 * The form itself, started once from what is known when it opens — so a refetch behind it never
 * resets what is being typed.
 *
 * Amount comes first with the keyboard up, because it is the one thing the phone can't guess:
 * the currency starts on the person's own, the category on the first in their order, the date on
 * today. Logging is then "type the amount, tap a category, Add expense". The description is
 * optional. Checked on submit; a slip puts focus back on the amount with the reason under it.
 */
function ExpenseEditor({
  expense,
  categories,
  currencies,
  defaultCurrency,
}: {
  expense: Expense | null;
  categories: Category[];
  currencies: string[];
  defaultCurrency: string;
}) {
  const [initial] = useState(() =>
    expenseValues(expense, {
      currency: defaultCurrency,
      categoryId: firstCategoryId(categories),
      today: todayIso(),
    })
  );
  const [values, setValues] = useState<ExpenseValues>(initial);
  const [problems, setProblems] = useState<{ amount?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const amountField = useRef<TextInputInstance>(null);

  const save = useFinanceWrite((body: ReturnType<typeof expensePayload>) =>
    expense
      ? api.patch<Expense>(`/finance/expenses/${expense.id}`, body)
      : api.post<Expense>('/finance/expenses', body)
  );
  const remove = useFinanceDelete(`/finance/expenses/${expense?.id}`);
  const dirty = (Object.keys(values) as (keyof ExpenseValues)[]).some(
    (key) => values[key] !== initial[key]
  );
  const leave = useLeaveGuard(dirty);

  function set<K extends keyof ExpenseValues>(key: K, value: ExpenseValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    // A field already showing its slip re-checks as it changes, so the message goes once fixed.
    if (problems.amount) setProblems(expenseProblems(next));
  }

  async function submit() {
    const found = expenseProblems(values);
    setProblems(found);
    if (found.amount) {
      amountField.current?.focus();
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(expensePayload(values));
      leave();
    } catch (err) {
      setError(
        describeError(
          err,
          expense ? 'Could not update that expense.' : 'Could not save that expense.'
        )
      );
    }
  }

  function askToDelete(stored: Expense) {
    const category = categories.find((c) => c.id === stored.category_id);
    confirm({
      title: 'Delete this expense?',
      message: `${expenseName(stored, category)} · ${formatMoney(stored.amount, stored.currency)}. This can’t be undone.`,
      confirmLabel: 'Yes, delete',
      destructive: true,
      onConfirm: async () => {
        setError(null);
        try {
          await remove.mutateAsync();
          leave();
        } catch (err) {
          setError(describeError(err, 'Could not delete that expense.'));
        }
      },
    });
  }

  return (
    <FormScreen
      title={expense ? 'Edit expense' : 'Add expense'}
      submitLabel={expense ? 'Save' : 'Add expense'}
      busy={save.isPending || remove.isPending}
      busyLabel={remove.isPending ? 'Deleting…' : 'Saving…'}
      error={error}
      onSubmit={submit}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md }}>
        <View style={{ flex: 3 }}>
          <TextField
            ref={amountField}
            label="Amount"
            kind="amount"
            value={values.amount}
            onChangeText={(amount) => set('amount', amount)}
            error={problems.amount}
            autoFocus={!expense}
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
      <CategoryChips
        categories={categories}
        value={values.category_id}
        onChange={(id) => set('category_id', id)}
      />
      <DateField label="Date" value={values.spent_on} onChange={(day) => set('spent_on', day)} />
      <TextField
        label="Description"
        kind="text"
        value={values.description}
        onChangeText={(description) => set('description', description)}
        maxLength={500}
        hint="Optional — what it was, or where."
      />
      {expense && (
        <Button
          label="Delete expense"
          icon="delete"
          variant="danger"
          fullWidth
          disabled={save.isPending || remove.isPending}
          onPress={() => askToDelete(expense)}
        />
      )}
    </FormScreen>
  );
}
