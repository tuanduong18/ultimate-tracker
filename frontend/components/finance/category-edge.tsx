import { NEUTRAL_COLOUR } from '@/lib/tint';

/**
 * The category's colour as a bar down a row's left edge.
 *
 * Rows used to be washed in their category's colour. Category colours are
 * user-chosen, so no wash strength keeps secondary text readable for all of
 * them — green, amber, white and black all pushed the grey line under 4.5:1 —
 * and a list of alternating red and green blocks is loud on a page whose
 * point is calm. A neutral row with a coloured edge keeps "same spend, same
 * colour" across the list, the pie and the filter, while the text sits on our
 * own surface and passes for any colour.
 *
 * Supplementary: the row also names its category in text, so the bar never
 * carries meaning alone. The row must be `relative overflow-hidden`.
 */
export function CategoryEdge({ colour }: { colour: string | null | undefined }) {
  return (
    <span
      aria-hidden
      className="absolute inset-y-0 left-0 w-1"
      style={{ backgroundColor: colour ?? NEUTRAL_COLOUR }}
    />
  );
}
