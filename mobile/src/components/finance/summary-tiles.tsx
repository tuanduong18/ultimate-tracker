import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { daysUntil, formatDate, monthRange, sameDaysLastMonth, todayIso } from '@/lib/dates';
import { nextRenewal, spendingChange } from '@/lib/finance/overview';
import { loadError, useSubscriptions, useSummary } from '@/lib/finance/queries';
import { inDays } from '@/lib/finance/subscriptions';
import { formatMoney } from '@/lib/money';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The Overview's two figures — the phone's twin of the web's SummaryTiles: what this month has
 * cost so far, against the same days of last month, and the next subscription charge. Side by
 * side where they fit, stacked when the font is large; each figure is one number, so a stat tile
 * rather than a chart. There is no budget tile, on purpose, as on the web: budgets have their own
 * screen, and "budget left" summed across currencies would be a number nobody can use.
 */
export function SummaryTiles() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md }}>
      <SpentTile />
      <RenewalTile />
    </View>
  );
}

function SpentTile() {
  const now = monthRange();
  const before = sameDaysLastMonth();
  const current = useSummary(now);
  const previous = useSummary(before);
  const change =
    current.data && previous.data
      ? spendingChange(current.data.spent, previous.data.spent, before)
      : null;

  return (
    <Tile label="Spent this month" icon="account_balance_wallet" loading={current.isPending}>
      {current.data ? (
        <>
          <Figure>{formatMoney(current.data.spent, current.data.currency)}</Figure>
          {change && <Change text={change.text} trend={change.trend} />}
        </>
      ) : (
        <Text variant="caption" tone="fgMuted">
          {loadError(current, 'Not available.')}
        </Text>
      )}
    </Tile>
  );
}

/**
 * Up or down against last month, in words with an arrow. For spending, down is good, so it is
 * `positive` — and never colour alone: the words say "less" or "more".
 */
function Change({ text, trend }: { text: string; trend: 'up' | 'down' | null }) {
  const tone = trend === 'down' ? 'positive' : trend === 'up' ? 'negative' : 'fgMuted';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
      {trend && (
        <Icon name={trend === 'down' ? 'trending_down' : 'trending_up'} size={16} tone={tone} />
      )}
      <Text variant="caption" tone={tone} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

function RenewalTile() {
  const subscriptions = useSubscriptions();
  const today = todayIso();
  const { next, withinMonth } = nextRenewal(subscriptions.data ?? [], today);

  return (
    <Tile label="Next subscription" icon="event_upcoming" loading={subscriptions.isPending}>
      {subscriptions.error && !subscriptions.data ? (
        <Text variant="caption" tone="fgMuted">
          {loadError(subscriptions, 'Not available.')}
        </Text>
      ) : next ? (
        <>
          <Figure>{formatMoney(next.amount, next.currency)}</Figure>
          <Text variant="caption" numberOfLines={2}>
            <Text variant="caption" style={{ fontWeight: '600' }}>
              {next.name}
            </Text>
            <Text variant="caption" tone="fgMuted">
              {' '}
              {inDays(daysUntil(next.next_billing_on, today))} · {formatDate(next.next_billing_on)}
            </Text>
          </Text>
          <Text variant="caption" tone="fgMuted">
            {withinMonth} renewal{withinMonth === 1 ? '' : 's'} in the next 30 days
          </Text>
        </>
      ) : (
        <>
          <Figure>—</Figure>
          <Text variant="caption" tone="fgMuted">
            No renewals coming up.
          </Text>
        </>
      )}
    </Tile>
  );
}

/** A tile: an icon in the accent's soft square, its label, then the figure and its lines. */
function Tile({
  label,
  icon,
  loading,
  children,
}: {
  label: string;
  icon: IconName;
  loading: boolean;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <Card
      style={{ flexGrow: 1, flexBasis: 160, padding: SPACE.lg, gap: SPACE.xs }}
      accessible={loading}
      accessibilityLabel={loading ? `${label}: loading…` : undefined}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: RADIUS.control,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={18} tone="primary" />
        </View>
        <Text variant="caption" tone="fgMuted" accessibilityRole="header">
          {label}
        </Text>
      </View>
      {loading ? (
        <View
          style={{
            height: 28,
            width: '70%',
            marginTop: SPACE.xs,
            borderRadius: RADIUS.control,
            backgroundColor: colors.surfaceMuted,
          }}
        />
      ) : (
        children
      )}
    </Card>
  );
}

function Figure({ children }: { children: ReactNode }) {
  return (
    <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
      {children}
    </Text>
  );
}
