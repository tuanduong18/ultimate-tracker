import { View } from 'react-native';

import { Button } from '@/components/button';
import { CheckChips } from '@/components/chips';
import { categoryOptions, NO_CATEGORY } from '@/components/finance/category-chips';
import { ALL_CATEGORIES, type CategorySelection } from '@/lib/finance/categories';
import type { Category } from '@/lib/finance/types';
import { SPACE } from '@/theme/scale';

/**
 * Which categories a list or chart counts — the phone's twin of the web's CategoryFilter
 * checklist, used by Transactions and by the Overview's charts.
 *
 * `ids: null` is every category, including ones made later; ticking a box pins a list. Toggling
 * Uncategorised pins the current list too, as the web does. Select all goes back to "every
 * category, now and later"; Clear unticks everything, which a chart then says rather than asks.
 */
export function CategorySelectionChips({
  selection,
  onChange,
  categories,
  label = 'Show',
}: {
  selection: CategorySelection;
  onChange: (selection: CategorySelection) => void;
  categories: readonly Category[];
  label?: string;
}) {
  const chosen = selection.ids ?? categories.map((category) => category.id);
  const selected = selection.uncategorized ? [...chosen, NO_CATEGORY] : chosen;

  function toggle(id: string) {
    if (id === NO_CATEGORY) {
      onChange({ ids: chosen, uncategorized: !selection.uncategorized });
      return;
    }
    const ids = chosen.includes(id) ? chosen.filter((other) => other !== id) : [...chosen, id];
    onChange({ ...selection, ids });
  }

  return (
    <>
      <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
        <Button
          label="Select all"
          variant="text"
          accessibilityLabel="Select every category"
          onPress={() => onChange(ALL_CATEGORIES)}
        />
        <Button
          label="Clear"
          variant="text"
          accessibilityLabel="Clear every category"
          onPress={() => onChange({ ids: [], uncategorized: false })}
        />
      </View>
      <CheckChips
        label={label}
        options={categoryOptions(categories)}
        selected={selected}
        onToggle={toggle}
      />
    </>
  );
}
