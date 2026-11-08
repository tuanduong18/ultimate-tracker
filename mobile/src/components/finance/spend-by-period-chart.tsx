import { ScrollView, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { formatRange, formatSpan, fromIso, type DateRange } from '@/lib/dates';
import { isEmptySelection, type CategorySelection } from '@/lib/finance/categories';
import { granularityFor } from '@/lib/finance/overview';
import { loadError, usePeriodBreakdown } from '@/lib/finance/queries';
import type { BucketSpend } from '@/lib/finance/types';
import { formatMoney } from '@/lib/money';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

const HEIGHT = 160;
const AXIS = 56;
/** A bar's slot: narrow for days, wide enough for "3 – 9 Nov" under a week. */
const SLOT = { day: 28, week: 72 } as const;

/**
 * How spending moved over the range — the phone's twin of the web's "Spending amount": a bar per
 * day for a month or less, per week beyond, so a bar is never a sliver. Change over time is what
 * bars are for. When the bars don't fit, they scroll sideways while the axis stays put.
 *
 * Drawn with plain views rather than a chart library: a bar is a rectangle, and views keep the
 * labels as real text that grows with the font size. The bar is the accent's soft tint capped in
 * the accent, the web's gradient made solid; the dashed grid marks zero, half and the top. Every
 * bar with spend is read out by TalkBack in words, since a picture of bars says nothing to it.
 */
export function SpendByPeriodChart({
  range,
  selection,
}: {
  range: DateRange;
  selection: CategorySelection;
}) {
  const { colors } = useAppTheme();
  const nothing = isEmptySelection(selection);
  const granularity = granularityFor(range);
  const breakdown = usePeriodBreakdown(range, granularity, selection, !nothing);

  if (nothing) return <EmptyState icon="filter_list" message="No categories selected." />;
  if (breakdown.isPending) return <LoadingState rows={2} />;
  if (breakdown.error && !breakdown.data) {
    return (
      <ErrorState
        message={loadError(breakdown, 'Could not load this chart.') ?? ''}
        onRetry={() => breakdown.refetch()}
      />
    );
  }

  const buckets = breakdown.data?.buckets ?? [];
  const currency = breakdown.data?.currency ?? 'USD';
  const most = Math.max(0, ...buckets.map((bucket) => Number(bucket.spent)));
  if (most <= 0) {
    return <EmptyState icon="bar_chart" message="Nothing spent in this period yet." />;
  }

  const top = niceCeiling(most);
  const slot = SLOT[granularity];
  const spoken = buckets
    .filter((bucket) => Number(bucket.spent) > 0)
    .map(
      (bucket) =>
        `${formatSpan(bucket.starts_on, bucket.ends_on)}: ${formatMoney(bucket.spent, currency)}`
    )
    .join('; ');

  return (
    <Card
      style={{ padding: SPACE.lg, gap: SPACE.sm }}
      accessible
      accessibilityLabel={`Spending by ${granularity}, ${formatRange(range)}. ${spoken}.`}
    >
      <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants">
        <View style={{ width: AXIS, height: HEIGHT, justifyContent: 'space-between' }}>
          {[top, top / 2, 0].map((value) => (
            <Text
              key={value}
              variant="label"
              tone="fgMuted"
              numberOfLines={1}
              style={{ marginTop: -8 }}
            >
              {compact(value)} {value === top ? currency : ''}
            </Text>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View>
            <View style={{ height: HEIGHT, flexDirection: 'row', alignItems: 'flex-end' }}>
              {/* Zero, half and the top, dashed and behind the bars. */}
              {[0, 0.5, 1].map((share) => (
                <View
                  key={share}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: share * HEIGHT,
                    borderTopWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: colors.border,
                  }}
                />
              ))}
              {buckets.map((bucket) => (
                <Bar key={bucket.starts_on} bucket={bucket} top={top} slot={slot} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', paddingTop: SPACE.xs }}>
              {buckets.map((bucket) => (
                <Text
                  key={bucket.starts_on}
                  variant="label"
                  tone="fgMuted"
                  numberOfLines={1}
                  style={{ width: slot, textAlign: 'center' }}
                >
                  {granularity === 'day'
                    ? (fromIso(bucket.starts_on)?.getDate() ?? '')
                    : formatSpan(bucket.starts_on, bucket.ends_on)}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      <Text variant="caption" tone="fgMuted" importantForAccessibility="no">
        {formatRange(range)} · by {granularity}
      </Text>
    </Card>
  );
}

function Bar({ bucket, top, slot }: { bucket: BucketSpend; top: number; slot: number }) {
  const { colors } = useAppTheme();
  const height = (Number(bucket.spent) / top) * HEIGHT;
  return (
    <View style={{ width: slot, alignItems: 'center' }}>
      {height > 0 && (
        <View
          style={{
            width: slot * 0.6,
            height: Math.max(height, 3),
            borderTopLeftRadius: RADIUS.control / 2,
            borderTopRightRadius: RADIUS.control / 2,
            borderTopWidth: 3,
            borderColor: colors.primary,
            backgroundColor: colors.primarySoft,
          }}
        />
      )}
    </View>
  );
}

/**
 * The axis' top: the next round number above the largest bar (1, 2 or 5 of its power of ten),
 * so the labels read as round figures and the tallest bar nearly fills the chart.
 */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (value <= step * power) return step * power;
  }
  return 10 * power;
}

let compactFormat: Intl.NumberFormat | null | undefined;

/** "1.2K" where the phone's engine can write it; the plain grouped number where it can't. */
function compact(value: number): string {
  if (compactFormat === undefined) {
    try {
      compactFormat = new Intl.NumberFormat(undefined, {
        notation: 'compact',
        maximumFractionDigits: 1,
      });
    } catch {
      compactFormat = null;
    }
  }
  return compactFormat ? compactFormat.format(value) : Math.round(value).toLocaleString();
}
