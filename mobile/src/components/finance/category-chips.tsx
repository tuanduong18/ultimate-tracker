import { ChoiceChips, type ChipOption } from '@/components/chips';
import { CategoryBadge } from '@/components/finance/category-badge';
import { UNCATEGORISED } from '@/lib/finance/categories';
import type { Category } from '@/lib/finance/types';

/** What a chip's value is when it stands for "no category". */
export const NO_CATEGORY = '';

/**
 * The person's categories as chips, in their own order, each led by its small badge — and,
 * when `withUncategorised`, Uncategorised last, as every category picker on both clients does.
 */
export function categoryOptions(
  categories: readonly Category[],
  withUncategorised = true
): ChipOption<string>[] {
  const options: ChipOption<string>[] = categories.map((category) => ({
    value: category.id,
    label: category.name,
    leading: (
      <CategoryBadge colour={category.colour} name={category.name} icon={category.icon} size="sm" />
    ),
  }));
  if (withUncategorised) {
    options.push({
      value: NO_CATEGORY,
      label: UNCATEGORISED,
      leading: <CategoryBadge colour={null} name={UNCATEGORISED} size="sm" />,
    });
  }
  return options;
}

/**
 * Which category an entry goes under — the phone's twin of the web's CategoryOptions. Chips
 * rather than a dropdown: logging is "amount, tap a category, Save", and every category should
 * be a single tap away and recognisable by its badge. `''` is Uncategorised.
 */
export function CategoryChips({
  categories,
  value,
  onChange,
  label = 'Category',
}: {
  categories: readonly Category[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  return (
    <ChoiceChips
      label={label}
      options={categoryOptions(categories)}
      selected={value}
      onSelect={onChange}
    />
  );
}
