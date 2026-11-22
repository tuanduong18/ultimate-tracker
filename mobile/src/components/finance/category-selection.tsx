import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { CheckChips } from '@/components/chips';
import { categoryOptions, NO_CATEGORY } from '@/components/finance/category-chips';
import { FormError } from '@/components/form-error';
import { Text } from '@/components/text';
import { describeError } from '@/lib/describe-error';
import {
  ALL_CATEGORIES,
  hiddenBy,
  listNames,
  sameIds,
  savedHidden,
  type CategorySelection,
} from '@/lib/finance/categories';
import type { Category } from '@/lib/finance/types';
import { SPACE } from '@/theme/scale';

/**
 * A chart filter's saved starting point, and the way to change it — the web's `ChartDefaults`.
 * Charts only: Transactions has no default to save.
 */
export interface ChartDefaults {
  /** The saved hidden ids, as the profile holds them. */
  hidden: readonly string[];
  /** Back to the saved list, for this look. */
  onReset: () => void;
  /** Stores these ids as the list every chart starts without; rejects if the save fails. */
  onSave: (hidden: string[]) => Promise<unknown>;
}

/**
 * Which categories a list or chart counts — the phone's twin of the web's CategoryFilter
 * checklist, used by Transactions and by the Overview's charts.
 *
 * `ids: null` is every category, including ones made later; ticking a box pins a list. Toggling
 * Uncategorised pins the current list too, as the web does. Select all goes back to "every
 * category, now and later"; Clear unticks everything, which a chart then says rather than asks.
 *
 * **On the charts, ticking is a look and saving is a decision** (`defaults`), as on the web: the
 * ticks last until the screen is left, **Save as default** makes them where every chart on both
 * clients opens, and **Reset** comes back to it. A line says what the charts start without, and
 * is announced when a save changes it. Uncategorised isn't saved, and a list that hides every
 * category can't be — it would open the charts on nothing.
 */
export function CategorySelectionChips({
  selection,
  onChange,
  categories,
  label = 'Show',
  defaults,
}: {
  selection: CategorySelection;
  onChange: (selection: CategorySelection) => void;
  categories: readonly Category[];
  label?: string;
  defaults?: ChartDefaults;
}) {
  const chosen = selection.ids ?? categories.map((category) => category.id);
  const selected = selection.uncategorized ? [...chosen, NO_CATEGORY] : chosen;
  const saved = defaults ? savedHidden(categories, defaults.hidden) : [];
  const atSaved = sameIds(hiddenBy(selection, categories), saved) && selection.uncategorized;

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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
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
        {/* Only when it would do something Select all doesn't: a list is saved, and this isn't it. */}
        {defaults && saved.length > 0 && !atSaved && (
          <Button
            label="Reset"
            variant="text"
            accessibilityLabel="Reset to the categories the charts start with"
            onPress={defaults.onReset}
          />
        )}
      </View>
      <CheckChips
        label={label}
        options={categoryOptions(categories)}
        selected={selected}
        onToggle={toggle}
      />
      {defaults && (
        <SavedDefault
          categories={categories}
          selection={selection}
          defaults={defaults}
          saved={saved}
        />
      )}
    </>
  );
}

function SavedDefault({
  categories,
  selection,
  defaults,
  saved,
}: {
  categories: readonly Category[];
  selection: CategorySelection;
  defaults: ChartDefaults;
  saved: readonly string[];
}) {
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const now = hiddenBy(selection, categories);
  const canSave = !sameIds(now, saved) && now.length < categories.length;
  const names = new Map(categories.map((category) => [category.id, category.name]));

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      await defaults.onSave(now);
    } catch (err: unknown) {
      setProblem(describeError(err, 'Could not save that.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: SPACE.sm }}>
      <Text tone="fgMuted" accessibilityLiveRegion="polite">
        {saving
          ? 'Saving…'
          : saved.length
            ? `Charts start without ${listNames(saved.map((id) => names.get(id) ?? ''))}.`
            : 'Charts start with every category.'}
      </Text>
      {canSave && (
        <Button
          label="Save as default"
          accessibilityLabel="Save as default: start the charts with these categories"
          disabled={saving}
          onPress={() => void save()}
        />
      )}
      {problem && <FormError message={problem} />}
    </View>
  );
}
