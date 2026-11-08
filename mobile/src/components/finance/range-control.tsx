import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, IconButton } from '@/components/button';
import { DateField } from '@/components/date-field';
import { FilterButton } from '@/components/filter-button';
import { CategorySelectionChips } from '@/components/finance/category-selection';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import {
  formatRange,
  isCalendarMonth,
  isCalendarWeek,
  monthRange,
  shiftRange,
  weekRange,
  type DateRange,
} from '@/lib/dates';
import { isNarrowed, type CategorySelection } from '@/lib/finance/categories';
import { categoryLabel, hiddenCategories } from '@/lib/finance/transaction-query';
import type { Category } from '@/lib/finance/types';
import { SPACE } from '@/theme/scale';

type Open = 'dates' | 'categories' | null;

/**
 * Which stretch of time, and which categories, the Overview's charts show — the phone's twin of
 * the web's RangeNav and RangeControls. One control for both charts on the phone, where the web
 * gives each its own: on a phone the two are read one after the other, and two sets of controls
 * that drift apart would make them disagree without saying so.
 *
 * ‹ and › step a whole month as a month and anything else by its own length. Week and Month jump
 * to the current one and read as chosen whenever the range is any calendar week or month. Dates
 * opens a sheet for any range; Categories one for which to count.
 */
export function RangeControl({
  range,
  onRange,
  selection,
  onSelection,
  categories,
}: {
  range: DateRange;
  onRange: (range: DateRange) => void;
  selection: CategorySelection;
  onSelection: (selection: CategorySelection) => void;
  categories: readonly Category[];
}) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const week = isCalendarWeek(range);
  const month = isCalendarMonth(range);
  const done = (
    <Button label="Done" variant="text" onPress={close} accessibilityLabel="Done, close" />
  );

  return (
    <View style={{ gap: SPACE.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
        <IconButton
          icon="chevron_left"
          label="Previous period"
          onPress={() => onRange(shiftRange(range, -1))}
        />
        <Text
          variant="bodyStrong"
          accessibilityLiveRegion="polite"
          style={{ flex: 1, textAlign: 'center' }}
        >
          {formatRange(range)}
        </Text>
        <IconButton
          icon="chevron_right"
          label="Next period"
          onPress={() => onRange(shiftRange(range, 1))}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: SPACE.sm, paddingVertical: SPACE.xs }}
      >
        <FilterButton
          kind="Period"
          label="This week"
          active={week}
          onPress={() => onRange(weekRange())}
        />
        <FilterButton
          kind="Period"
          label="This month"
          active={month}
          onPress={() => onRange(monthRange())}
        />
        <FilterButton
          kind="Dates"
          label={week || month ? 'Other dates' : 'Your dates'}
          active={!week && !month}
          onPress={() => setOpen('dates')}
        />
        <FilterButton
          kind="Categories"
          label={categoryLabel(selection, categories)}
          active={isNarrowed(selection) && hiddenCategories(selection, categories) > 0}
          onPress={() => setOpen('categories')}
        />
      </ScrollView>

      <Sheet visible={open === 'dates'} onClose={close} title="Dates" footer={done}>
        <DateField
          label="From"
          value={range.start}
          maximum={range.end}
          onChange={(start) => onRange({ start, end: range.end })}
        />
        <DateField
          label="To"
          value={range.end}
          minimum={range.start}
          onChange={(end) => onRange({ start: range.start, end })}
        />
      </Sheet>
      <Sheet visible={open === 'categories'} onClose={close} title="Categories" footer={done}>
        <CategorySelectionChips
          label="Count spending in"
          selection={selection}
          onChange={onSelection}
          categories={categories}
        />
      </Sheet>
    </View>
  );
}
