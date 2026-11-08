import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { CheckChips, ChoiceChips } from '@/components/chips';
import { DateField } from '@/components/date-field';
import { FilterButton } from '@/components/filter-button';
import { categoryOptions, NO_CATEGORY } from '@/components/finance/category-chips';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { ALL_CATEGORIES } from '@/lib/finance/categories';
import {
  amountLabel,
  amountUnreadable,
  boundsInverted,
  categoryLabel,
  dateLabel,
  datePresets,
  datesFiltered,
  hiddenCategories,
  NO_FILTERS,
  type TransactionFilters,
} from '@/lib/finance/transaction-query';
import type { Category } from '@/lib/finance/types';
import { SPACE } from '@/theme/scale';

type Open = 'dates' | 'categories' | 'amount' | null;

/**
 * The Transactions screen's three filters, as chips that say what they're set to, each opening
 * a sheet — the phone's twin of the web's TransactionFilterBar, with its rules and words. Every
 * change applies at once, as on the web; there is no Apply button to forget. The row scrolls
 * sideways at large font sizes rather than wrapping into a wall of chips.
 */
export function TransactionFilterBar({
  filters,
  onChange,
  categories,
  currencies,
  defaultCurrency,
}: {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  categories: readonly Category[];
  /** The currencies the person's expenses are actually in — the only ones worth filtering by. */
  currencies: readonly string[];
  defaultCurrency: string;
}) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const done = (
    <Button
      label="Done"
      variant="text"
      onPress={close}
      accessibilityLabel="Done, close the filter"
    />
  );

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: SPACE.sm, paddingVertical: SPACE.xs }}
      >
        <FilterButton
          kind="Dates"
          label={dateLabel(filters)}
          active={datesFiltered(filters)}
          onPress={() => setOpen('dates')}
        />
        <FilterButton
          kind="Categories"
          label={categoryLabel(filters.categories, categories)}
          active={hiddenCategories(filters.categories, categories) > 0}
          onPress={() => setOpen('categories')}
        />
        <FilterButton
          kind="Amount"
          label={amountLabel(filters)}
          active={filters.currency !== ''}
          onPress={() => setOpen('amount')}
        />
      </ScrollView>

      <Sheet visible={open === 'dates'} onClose={close} title="Dates" footer={done}>
        <DatesFilter filters={filters} onChange={onChange} />
      </Sheet>
      <Sheet visible={open === 'categories'} onClose={close} title="Categories" footer={done}>
        <CategoriesFilter filters={filters} onChange={onChange} categories={categories} />
      </Sheet>
      <Sheet visible={open === 'amount'} onClose={close} title="Amount" footer={done}>
        <AmountFilter
          filters={filters}
          onChange={onChange}
          currencies={currencies}
          defaultCurrency={defaultCurrency}
        />
      </Sheet>
    </>
  );
}

const ANY_TIME = 'any';
const CUSTOM = 'custom';

/** The web's presets, then From and To for anything else; either end can stay open. */
function DatesFilter({
  filters,
  onChange,
}: {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
}) {
  const presets = datePresets();
  const preset = presets.find(
    (p) => p.range.start === filters.start && p.range.end === filters.end
  );
  const selected = !datesFiltered(filters) ? ANY_TIME : (preset?.label ?? CUSTOM);

  return (
    <>
      <ChoiceChips
        label="Show"
        options={[
          { value: ANY_TIME, label: 'Any time' },
          ...presets.map((p) => ({ value: p.label, label: p.label })),
        ]}
        selected={selected}
        onSelect={(value) => {
          const range = presets.find((p) => p.label === value)?.range;
          onChange({ ...filters, start: range?.start ?? '', end: range?.end ?? '' });
        }}
      />
      <DateField
        label="From"
        value={filters.start}
        optional
        emptyLabel="Any start"
        maximum={filters.end || undefined}
        onChange={(start) => onChange({ ...filters, start })}
      />
      <DateField
        label="To"
        value={filters.end}
        optional
        emptyLabel="Any end"
        minimum={filters.start || undefined}
        onChange={(end) => onChange({ ...filters, end })}
      />
    </>
  );
}

/**
 * Which categories to show. `ids: null` is every category, including ones made later; ticking
 * boxes pins a list. Toggling Uncategorised pins the current list too, as the web does.
 */
function CategoriesFilter({
  filters,
  onChange,
  categories,
}: {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  categories: readonly Category[];
}) {
  const selection = filters.categories;
  const chosen = selection.ids ?? categories.map((category) => category.id);
  const selected = selection.uncategorized ? [...chosen, NO_CATEGORY] : chosen;

  function toggle(id: string) {
    if (id === NO_CATEGORY) {
      onChange({
        ...filters,
        categories: { ids: chosen, uncategorized: !selection.uncategorized },
      });
      return;
    }
    const ids = chosen.includes(id) ? chosen.filter((other) => other !== id) : [...chosen, id];
    onChange({ ...filters, categories: { ...selection, ids } });
  }

  return (
    <>
      <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
        <Button
          label="Select all"
          variant="text"
          onPress={() => onChange({ ...filters, categories: ALL_CATEGORIES })}
        />
        <Button
          label="Clear"
          variant="text"
          accessibilityLabel="Clear every category"
          onPress={() => onChange({ ...filters, categories: { ids: [], uncategorized: false } })}
        />
      </View>
      <CheckChips
        label="Show expenses in"
        options={categoryOptions(categories)}
        selected={selected}
        onToggle={toggle}
      />
    </>
  );
}

const ANY_CURRENCY = '';

/**
 * Amounts in one currency, compared as recorded — never converted, which would make which rows
 * match drift with the exchange rate. Typing a bound with no currency chosen picks the person's
 * own; "Any currency" drops the bounds with it.
 */
function AmountFilter({
  filters,
  onChange,
  currencies,
  defaultCurrency,
}: {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  currencies: readonly string[];
  defaultCurrency: string;
}) {
  const codes = [...new Set([...currencies, defaultCurrency, filters.currency])].filter(Boolean);
  const bound = (key: 'min' | 'max') => (value: string) =>
    onChange({ ...filters, [key]: value, currency: filters.currency || defaultCurrency });

  return (
    <>
      <ChoiceChips
        label="Currency"
        options={[
          { value: ANY_CURRENCY, label: 'Any currency' },
          ...codes.map((code) => ({ value: code, label: code })),
        ]}
        selected={filters.currency}
        onSelect={(currency) =>
          onChange(
            currency
              ? { ...filters, currency }
              : { ...filters, currency: '', min: NO_FILTERS.min, max: NO_FILTERS.max }
          )
        }
      />
      <View style={{ flexDirection: 'row', gap: SPACE.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="At least"
            kind="amount"
            value={filters.min}
            onChangeText={bound('min')}
            error={amountUnreadable(filters.min) ? 'Enter a number, like 12.50.' : undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="At most"
            kind="amount"
            value={filters.max}
            onChangeText={bound('max')}
            error={
              amountUnreadable(filters.max)
                ? 'Enter a number, like 12.50.'
                : boundsInverted(filters)
                  ? 'Make this at least the lower amount.'
                  : undefined
            }
          />
        </View>
      </View>
      <Text variant="caption" tone="fgMuted">
        Compared in the currency each expense was spent in.
      </Text>
    </>
  );
}
