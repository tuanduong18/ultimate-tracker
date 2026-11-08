import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { confirm } from '@/components/confirm';
import { CategoryBadge } from '@/components/finance/category-badge';
import { ColourPicker } from '@/components/finance/colour-picker';
import { SymbolPicker } from '@/components/finance/symbol-picker';
import { FormScreen, useLeaveGuard } from '@/components/form-screen';
import { Screen } from '@/components/screen';
import { EmptyState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { api } from '@/lib/api-client';
import { describeError } from '@/lib/describe-error';
import {
  categoryProblems,
  categoryValues,
  createPayload,
  updatePayload,
  type CategoryValues,
} from '@/lib/finance/category-form';
import { useCategories, useFinanceDelete, useFinanceWrite } from '@/lib/finance/queries';
import type { Category } from '@/lib/finance/types';
import { SPACE } from '@/theme/scale';

/**
 * Adding or editing one category — the phone's twin of the web's category form: its name, its
 * symbol and its colour, with the badge previewed as every expense row will draw it. `/category`
 * adds; `/category?id=…` edits.
 */
export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const categories = useCategories();
  const category = id ? categories.data?.find((row) => row.id === id) : null;
  const title = id ? 'Edit category' : 'New category';

  if (categories.isPending) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Screen>
          <LoadingState rows={2} />
        </Screen>
      </>
    );
  }

  if (id && !category) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Screen>
          <EmptyState
            icon="search_off"
            message="That category no longer exists — someone may have deleted it."
          />
        </Screen>
      </>
    );
  }

  return <CategoryEditor category={category ?? null} />;
}

/**
 * The form, started once from the category as it was when opened. The preview sits first so
 * every change to the name, symbol or colour shows on the badge as it is made — the badge is
 * what the person will scan for in their lists, so that is what they are really choosing.
 */
function CategoryEditor({ category }: { category: Category | null }) {
  const [initial] = useState(() => categoryValues(category));
  const [values, setValues] = useState<CategoryValues>(initial);
  const [problems, setProblems] = useState<{ name?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const nameField = useRef<TextInputInstance>(null);

  const save = useFinanceWrite((next: CategoryValues) =>
    category
      ? api.patch<Category>(`/finance/categories/${category.id}`, updatePayload(next, category))
      : api.post<Category>('/finance/categories', createPayload(next))
  );
  const remove = useFinanceDelete(`/finance/categories/${category?.id}`);
  const dirty =
    values.name !== initial.name ||
    values.colour !== initial.colour ||
    values.icon !== initial.icon;
  const leave = useLeaveGuard(dirty);

  function set<K extends keyof CategoryValues>(key: K, value: CategoryValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (problems.name) setProblems(categoryProblems(next));
  }

  async function submit() {
    const found = categoryProblems(values);
    setProblems(found);
    if (found.name) {
      nameField.current?.focus();
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(values);
      leave();
    } catch (err) {
      setError(
        describeError(
          err,
          category ? 'Could not update that category.' : 'Could not create that category.'
        )
      );
    }
  }

  function askToDelete(stored: Category) {
    confirm({
      title: `Delete ${stored.name}?`,
      message: 'Its expenses become uncategorised, and budgets stop counting it.',
      confirmLabel: 'Yes, delete',
      destructive: true,
      onConfirm: async () => {
        setError(null);
        try {
          await remove.mutateAsync();
          leave();
        } catch (err) {
          setError(describeError(err, 'Could not delete that category.'));
        }
      },
    });
  }

  const busy = save.isPending || remove.isPending;
  const shownName = values.name.trim() || 'New category';

  return (
    <FormScreen
      title={category ? 'Edit category' : 'New category'}
      submitLabel={category ? 'Save' : 'Add category'}
      busy={busy}
      busyLabel={remove.isPending ? 'Deleting…' : 'Saving…'}
      error={error}
      onSubmit={submit}
    >
      <Card
        style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg }}
        accessible
        accessibilityLabel={`Preview: ${shownName}`}
      >
        <CategoryBadge colour={values.colour} name={shownName} icon={values.icon} />
        <View style={{ flex: 1, minWidth: 0 }} importantForAccessibility="no-hide-descendants">
          <Text variant="bodyStrong">{shownName}</Text>
          <Text variant="caption" tone="fgMuted">
            As it will look in your lists
          </Text>
        </View>
      </Card>
      <TextField
        ref={nameField}
        label="Name"
        kind="text"
        value={values.name}
        onChangeText={(name) => set('name', name)}
        error={problems.name}
        maxLength={50}
        autoFocus={!category}
      />
      <SymbolPicker value={values.icon} onChange={(icon) => set('icon', icon)} name={values.name} />
      <ColourPicker value={values.colour} onChange={(colour) => set('colour', colour)} />
      {category && (
        <Button
          label="Delete category"
          icon="delete"
          variant="danger"
          fullWidth
          disabled={busy}
          onPress={() => askToDelete(category)}
        />
      )}
    </FormScreen>
  );
}
