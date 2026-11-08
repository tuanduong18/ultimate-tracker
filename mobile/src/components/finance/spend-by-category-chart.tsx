import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Card, RowDivider } from '@/components/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { formatRange, shiftRange, type DateRange } from '@/lib/dates';
import { isEmptySelection, type CategorySelection } from '@/lib/finance/categories';
import { share, toRows, type CategoryRow } from '@/lib/finance/overview';
import { loadError, useCategoryBreakdown } from '@/lib/finance/queries';
import { formatMoney, sumAmounts } from '@/lib/money';
import { SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

const SIZE = 168;
const OUTER = SIZE / 2;
const INNER = OUTER * 0.64;
const RADIUS = (OUTER + INNER) / 2;
const THICKNESS = OUTER - INNER;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The gap between two slices, in the card's own surface, so neighbouring colours never merge. */
const GAP = 2;

/**
 * Where the money went, by category — the phone's twin of the web's "Spending by category": a
 * ring of this period, and a legend that gives every category its amount and its share now and in
 * the period before ("12% → 18%").
 *
 * A ring because this is part-to-whole with at most five slices (four named, the rest folded into
 * "Others (n)"); the web's second ring for the period before needs a width a phone doesn't have,
 * so the before-share moves into the legend instead. Slices are the categories' own colours, the
 * same as their badges, starting at twelve o'clock and going clockwise, with no animation: a
 * chart that grows in is a chart that is briefly wrong. TalkBack hears the ring as its total and
 * range, then reads the legend row by row; the slices themselves are a picture of the legend.
 */
export function SpendByCategoryChart({
  range,
  selection,
}: {
  range: DateRange;
  selection: CategorySelection;
}) {
  const { colors } = useAppTheme();
  const nothing = isEmptySelection(selection);
  const before = shiftRange(range, -1);
  const current = useCategoryBreakdown(range, selection, !nothing);
  const previous = useCategoryBreakdown(before, selection, !nothing);

  if (nothing) return <EmptyState icon="filter_list" message="No categories selected." />;
  if (current.isPending || previous.isPending) return <LoadingState rows={2} />;
  if (current.error && !current.data) {
    return (
      <ErrorState
        message={loadError(current, 'Could not load this chart.') ?? ''}
        onRetry={() => current.refetch()}
      />
    );
  }

  const rows = toRows(previous.data, current.data);
  const currency = current.data?.currency ?? previous.data?.currency ?? 'USD';
  const total = sumAmounts(rows.map((row) => row.currentSpent));
  const totalBefore = sumAmounts(rows.map((row) => row.previousSpent));

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="donut_large"
        message={`Nothing spent in ${formatRange(range)} or the period before.`}
      />
    );
  }

  return (
    <Card style={{ padding: SPACE.lg, gap: SPACE.lg }}>
      <View style={{ alignItems: 'center' }}>
        <View
          accessible
          accessibilityLabel={
            Number(total) > 0
              ? `${formatMoney(total, currency)} spent, ${formatRange(range)}.`
              : `Nothing spent yet, ${formatRange(range)}.`
          }
          style={{ width: SIZE, height: SIZE }}
        >
          <Ring rows={rows} total={total} track={colors.surfaceMuted} />
          <View
            style={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              padding: THICKNESS,
            }}
          >
            {Number(total) > 0 ? (
              <>
                <Text
                  variant="bodyStrong"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatMoney(total, currency)}
                </Text>
                <Text variant="caption" tone="fgMuted">
                  spent
                </Text>
              </>
            ) : (
              <Text variant="caption" tone="fgMuted">
                nothing yet
              </Text>
            )}
          </View>
        </View>
        <Text
          variant="caption"
          tone="fgMuted"
          importantForAccessibility="no"
          style={{ marginTop: SPACE.sm }}
        >
          {formatRange(range)}
        </Text>
      </View>

      <View>
        <View
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', gap: SPACE.sm, paddingBottom: SPACE.sm }}
        >
          <Text variant="label" tone="fgMuted" style={{ flex: 1 }}>
            Category
          </Text>
          <Text variant="label" tone="fgMuted">
            Share, last → this
          </Text>
          <Text variant="label" tone="fgMuted" style={{ minWidth: 80, textAlign: 'right' }}>
            This period
          </Text>
        </View>
        {rows.map((row, index) => {
          const now = share(row.currentSpent, total);
          const was = share(row.previousSpent, totalBefore);
          const money = formatMoney(row.currentSpent, currency);
          return (
            <View key={row.key}>
              {index > 0 && <RowDivider />}
              <View
                accessible
                accessibilityLabel={`${row.name}: ${money}, ${now}% of this period, ${was}% of the period before.`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: SPACE.sm,
                  paddingVertical: SPACE.sm,
                }}
              >
                <View
                  style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: row.colour }}
                />
                <Text style={{ flex: 1 }} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text variant="caption" tone="fgMuted" style={{ fontVariant: ['tabular-nums'] }}>
                  {was}% → {now}%
                </Text>
                <Text
                  variant="bodyStrong"
                  style={{ minWidth: 80, textAlign: 'right', fontVariant: ['tabular-nums'] }}
                >
                  {money}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** The ring itself: one stroked arc per slice, each a dash of its share of the circumference. */
function Ring({
  rows,
  total,
  track,
}: {
  rows: readonly CategoryRow[];
  total: string;
  track: string;
}) {
  const all = Number(total);
  const slices = all > 0 ? rows.filter((row) => Number(row.currentSpent) > 0) : [];
  const lengths = slices.map((row) => (Number(row.currentSpent) / all) * CIRCUMFERENCE);
  // Where each slice starts along the ring: the lengths of the slices before it.
  const starts = lengths.map((_, index) =>
    lengths.slice(0, index).reduce((sum, length) => sum + length, 0)
  );
  return (
    <Svg width={SIZE} height={SIZE}>
      {/* The empty ring, only when there is nothing to draw: with slices, the gaps between them
          show the card's own surface instead. */}
      {slices.length === 0 && (
        <Circle
          cx={OUTER}
          cy={OUTER}
          r={RADIUS}
          stroke={track}
          strokeWidth={THICKNESS}
          fill="none"
        />
      )}
      {slices.map((row, index) => {
        const length = lengths[index];
        const dash = slices.length > 1 ? Math.max(length - GAP, 0) : length;
        return (
          <Circle
            key={row.key}
            cx={OUTER}
            cy={OUTER}
            r={RADIUS}
            stroke={row.colour}
            strokeWidth={THICKNESS}
            fill="none"
            strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
            strokeDashoffset={-starts[index]}
            // From twelve o'clock, clockwise.
            transform={`rotate(-90 ${OUTER} ${OUTER})`}
          />
        );
      })}
    </Svg>
  );
}
