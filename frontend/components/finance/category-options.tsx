import type { Category } from '@/lib/types/finance';

/**
 * The options of a category `<select>`: the person's categories in their own
 * order (the API returns them arranged), then "Uncategorised" last.
 *
 * Uncategorised used to come first, and so was what every new expense started
 * on. It is a fallback, not a choice anyone makes on purpose — the user's call
 * (2026-11-06): it belongs at the end, and the top of their own order is the
 * likeliest category for the next entry.
 */
export function CategoryOptions({ categories }: { categories: Category[] }) {
  return (
    <>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
      <option value="">Uncategorised</option>
    </>
  );
}

/**
 * Where a new entry starts: the first category in the person's order, or
 * Uncategorised when they have none. Visible and changeable in the form before
 * anything is saved, so a default that is wrong this time costs one click.
 */
export function firstCategoryId(categories: Category[]): string {
  return categories[0]?.id ?? '';
}
