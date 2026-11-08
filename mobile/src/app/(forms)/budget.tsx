import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';

import { Button } from '@/components/button';
import { CheckChips, ChoiceChips } from '@/components/chips';
import { confirm } from '@/components/confirm';
import { DateField } from '@/components/date-field';
import { categoryOptions } from '@/components/finance/category-chips';
import { CurrencyField } from '@/components/finance/currency-field';
import { FormScreen, useLeaveGuard } from '@/components/form-screen';
import { MonthField } from '@/components/month-field';
import { RadioList, RadioRow } from '@/components/radio-list';
import { Screen } from '@/components/screen';
import { EmptyState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { FieldNote, TextField } from '@/components/text-field';
import { api } from '@/lib/api-client';
import { monthStart } from '@/lib/dates';
import { describeError } from '@/lib/describe-error';
import {
  budgetPayload,
  budgetProblems,
  budgetValues,
  withPeriod,
  type BudgetProblems,
  type BudgetValues,
} from '@/lib/finance/budget-form';
import { warnOptions } from '@/lib/finance/budgets';
import {
  useBudgets,
  useFinanceBasics,
  useFinanceDelete,
  useFinanceWrite,
} from '@/lib/finance/queries';
import type { Budget, Category } from '@/lib/finance/types';
import { SPACE } from '@/theme/scale';

/** The warn-at chip for "no early warning". */
const NO_WARNING = 'off';

/**
 * Adding or editing one budget — the phone's twin of the web's budget form, with its fields,
 * defaults and words. `/budget?month=…` adds one starting in that month; `?id=…` edits.
 */
export default function BudgetScreen() {
  const { id, month } = useLocalSearchParams<{ id?: string; month?: string }>();
  const basics = useFinanceBasics();
  const budgets = useBudgets();
  const budget = id ? budgets.data?.find((row) => row.id === id) : null;
  const title = id ? 'Edit budget' : 'New budget';

  if (basics.loading || (id && budgets.isPending)) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Screen>
          <LoadingState rows={3} />
        </Screen>
      </>
    );
  }

  if (id && !budget) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Screen>
          <EmptyState
            icon="search_off"
            message="That budget no longer exists — someone may have deleted it."
          />
        </Screen>
      </>
    );
  }

  return (
    <BudgetEditor
      budget={budget ?? null}
      month={month ?? monthStart()}
      categories={basics.categories.data ?? []}
      currencies={basics.currencies}
      defaultCurrency={basics.defaultCurrency}
    />
  );
}

/**
 * The form, started once. Type first, because it changes the fields under it: a monthly budget
 * is a cap per month between a first and an optional last month; a custom one is one cap over a
 * date range. What it covers is chosen categories (the default) or all spending, which also
 * counts categories made later and uncategorised spend — not the same as ticking every box,
 * which the form says when every box is ticked.
 */
function BudgetEditor({
  budget,
  month,
  categories,
  currencies,
  defaultCurrency,
}: {
  budget: Budget | null;
  month: string;
  categories: Category[];
  currencies: string[];
  defaultCurrency: string;
}) {
  const [initial] = useState(() =>
    budgetValues(budget, { currency: defaultCurrency, month, hasCategories: categories.length > 0 })
  );
  const [values, setValues] = useState<BudgetValues>(initial);
  const [problems, setProblems] = useState<BudgetProblems>({});
  const [error, setError] = useState<string | null>(null);
  const nameField = useRef<TextInputInstance>(null);
  const amountField = useRef<TextInputInstance>(null);

  const save = useFinanceWrite((body: ReturnType<typeof budgetPayload>) =>
    budget
      ? api.patch<Budget>(`/finance/budgets/${budget.id}`, body)
      : api.post<Budget>('/finance/budgets', body)
  );
  const remove = useFinanceDelete(`/finance/budgets/${budget?.id}`);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const leave = useLeaveGuard(dirty);
  const monthly = values.period === 'monthly';
  const busy = save.isPending || remove.isPending;

  function update(next: BudgetValues) {
    setValues(next);
    // Fields already showing a slip re-check as they change, so a message goes once fixed.
    if (Object.keys(problems).length > 0) setProblems(budgetProblems(next));
  }
  const set = <K extends keyof BudgetValues>(key: K, value: BudgetValues[K]) =>
    update({ ...values, [key]: value });

  function toggleCategory(id: string) {
    const ids = values.category_ids.includes(id)
      ? values.category_ids.filter((other) => other !== id)
      : [...values.category_ids, id];
    set('category_ids', ids);
  }

  async function submit() {
    const found = budgetProblems(values);
    setProblems(found);
    if (found.name) return nameField.current?.focus();
    if (found.amount) return amountField.current?.focus();
    if (Object.keys(found).length > 0) return;
    setError(null);
    try {
      await save.mutateAsync(budgetPayload(values));
      leave();
    } catch (err) {
      setError(
        describeError(err, budget ? 'Could not update that budget.' : 'Could not save that budget.')
      );
    }
  }

  function askToDelete(stored: Budget) {
    confirm({
      title: 'Delete this budget?',
      message: `${stored.name} and its alerts go. Your expenses stay as they are.`,
      confirmLabel: 'Yes, delete',
      destructive: true,
      onConfirm: async () => {
        setError(null);
        try {
          await remove.mutateAsync();
          leave();
        } catch (err) {
          setError(describeError(err, 'Could not delete that budget.'));
        }
      },
    });
  }

  const everyBoxTicked =
    !values.all_spending &&
    categories.length > 1 &&
    categories.every((category) => values.category_ids.includes(category.id));

  return (
    <FormScreen
      title={budget ? 'Edit budget' : 'New budget'}
      submitLabel={budget ? 'Save' : 'Add budget'}
      busy={busy}
      busyLabel={remove.isPending ? 'Deleting…' : 'Saving…'}
      error={error}
      onSubmit={submit}
    >
      <View style={{ gap: SPACE.sm }}>
        <Text variant="bodyStrong" importantForAccessibility="no">
          Type
        </Text>
        <RadioList label="Type">
          <RadioRow
            label="Monthly"
            description="Resets on the 1st of every month."
            selected={monthly}
            onSelect={() => update(withPeriod(values, 'monthly'))}
          />
          <RadioRow
            label="Custom dates"
            description="One cap over a range you pick."
            selected={!monthly}
            onSelect={() => update(withPeriod(values, 'custom'))}
          />
        </RadioList>
      </View>

      <TextField
        ref={nameField}
        label="Name"
        kind="text"
        value={values.name}
        onChangeText={(name) => set('name', name)}
        error={problems.name}
        maxLength={80}
        autoFocus={!budget}
      />

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md }}>
        <View style={{ flex: 3 }}>
          <TextField
            ref={amountField}
            label={monthly ? 'Amount per month' : 'Amount'}
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

      {monthly ? (
        <>
          <MonthField
            label="First month"
            value={values.starts_on}
            onChange={(starts_on) => set('starts_on', starts_on)}
            error={problems.starts_on}
          />
          <MonthField
            label="Last month"
            value={values.ends_on}
            onChange={(ends_on) => set('ends_on', ends_on)}
            optional
            emptyLabel="Ongoing — no last month"
            setLabel="Set a last month"
            startFrom={values.starts_on}
            error={problems.ends_on}
          />
        </>
      ) : (
        <>
          <DateField
            label="Starts"
            value={values.starts_on}
            onChange={(starts_on) => set('starts_on', starts_on)}
            error={problems.starts_on}
          />
          <DateField
            label="Ends"
            value={values.ends_on}
            onChange={(ends_on) => set('ends_on', ends_on)}
            optional
            emptyLabel="Pick an end date"
            minimum={values.starts_on || undefined}
            error={problems.ends_on}
          />
        </>
      )}

      <View style={{ gap: SPACE.sm }}>
        <Text variant="bodyStrong" importantForAccessibility="no">
          What it covers
        </Text>
        <RadioList label="What it covers">
          <RadioRow
            label="Chosen categories"
            description="Only the ones you tick."
            selected={!values.all_spending}
            onSelect={() => set('all_spending', false)}
          />
          <RadioRow
            label="All spending"
            description="Every expense, new categories included."
            selected={values.all_spending}
            onSelect={() => set('all_spending', true)}
          />
        </RadioList>
      </View>

      {!values.all_spending &&
        (categories.length === 0 ? (
          <Text tone="fgMuted">
            No categories yet — add one under Categories, or choose All spending.
          </Text>
        ) : (
          <View style={{ gap: SPACE.xs }}>
            {categories.length > 1 && (
              <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
                <Button
                  label="Select all"
                  variant="text"
                  accessibilityLabel="Select every category"
                  onPress={() =>
                    set(
                      'category_ids',
                      categories.map((category) => category.id)
                    )
                  }
                />
                <Button
                  label="Clear"
                  variant="text"
                  accessibilityLabel="Clear every category"
                  onPress={() => set('category_ids', [])}
                />
              </View>
            )}
            <CheckChips
              label="Categories"
              options={categoryOptions(categories, false)}
              selected={values.category_ids}
              onToggle={toggleCategory}
            />
            <FieldNote
              error={problems.category_ids}
              hint={
                everyBoxTicked
                  ? 'To count categories you add later too, choose All spending.'
                  : undefined
              }
            />
          </View>
        ))}

      <View style={{ gap: SPACE.xs }}>
        <ChoiceChips
          label="Warn me at"
          options={[
            ...warnOptions(values.warn_at_percent).map((share) => ({
              value: String(share),
              label: `${share}%`,
              accessibilityLabel: `${share}% of the cap`,
            })),
            { value: NO_WARNING, label: 'Don’t warn early' },
          ]}
          selected={values.warn_at_percent === null ? NO_WARNING : String(values.warn_at_percent)}
          onSelect={(choice) =>
            set('warn_at_percent', choice === NO_WARNING ? null : Number(choice))
          }
        />
        <FieldNote hint="You’re also told when it’s fully spent." />
      </View>

      {budget && (
        <Button
          label="Delete budget"
          icon="delete"
          variant="danger"
          fullWidth
          disabled={busy}
          onPress={() => askToDelete(budget)}
        />
      )}
    </FormScreen>
  );
}
