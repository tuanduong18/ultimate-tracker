import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { barPercent, isOverspent, scheduleOf, withoutSign } from '@/lib/finance/budgets';
import type { BudgetProgress } from '@/lib/finance/types';
import { formatMoney } from '@/lib/money';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * One budget measured against its cap — the phone's twin of the web's budget card: what it
 * covers and when, how much is paid and how much is left (or how far over), and a bar.
 *
 * The card takes a pastel by the budget's creation order (`tint`), so arranging the list never
 * recolours it; text stays in `fg`, which reads on every pastel in both modes. Money is the
 * budget's own currency, as the API converts spend into it. Overspent is said in words and with
 * an icon, in `negative`, never by the bar's colour alone; the figure drops its minus sign because
 * "Overshooting" already says which way. The notch marks where the early warning fires.
 *
 * The whole card opens the budget to edit. TalkBack reads it as one sentence.
 */
export function BudgetCard({
  budget,
  tint,
  onPress,
}: {
  budget: BudgetProgress;
  /** The pastel for this budget's place in creation order. */
  tint: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const over = isOverspent(budget);
  const percent = barPercent(budget.spent, budget.amount);
  const spent = formatMoney(budget.spent, budget.currency);
  const left = formatMoney(withoutSign(budget.remaining), budget.currency);
  const cap = formatMoney(budget.amount, budget.currency);
  const covers = budget.all_spending
    ? 'All spending'
    : budget.categories.map((category) => category.name).join(', ') || 'No categories';
  const kind = budget.period === 'monthly' ? 'Monthly' : 'Custom';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${budget.name}, ${kind}. ${spent} paid of ${cap}, ${
        over ? `${left} over` : `${left} left`
      }. ${covers}.`}
      accessibilityHint="Opens it to edit"
      android_ripple={{ color: colors.primarySoft }}
      style={{
        gap: SPACE.md,
        padding: SPACE.xl,
        borderRadius: RADIUS.card,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: tint,
        overflow: 'hidden',
      }}
    >
      <View style={{ gap: SPACE.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
          <Text variant="heading" style={{ flexShrink: 1 }}>
            {budget.name}
          </Text>
          <View
            style={{
              paddingHorizontal: SPACE.sm,
              paddingVertical: 2,
              borderRadius: RADIUS.pill,
              backgroundColor: colors.surface,
            }}
          >
            <Text variant="label">{kind}</Text>
          </View>
        </View>
        <Text variant="caption" tone="fgMuted">
          {scheduleOf(budget)} · {covers}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md }}>
        <View>
          <Text variant="caption" tone="fgMuted">
            Total paid
          </Text>
          <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
            {spent}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
            {over && <Icon name="error" size={16} tone="negative" />}
            <Text variant="caption" tone={over ? 'negative' : 'fgMuted'}>
              {over ? 'Overshooting' : 'Total remaining'}
            </Text>
          </View>
          <Text
            variant="bodyStrong"
            tone={over ? 'negative' : 'fg'}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {left}
          </Text>
        </View>
      </View>

      <ProgressBar percent={percent} over={over} warnAt={budget.warn_at_percent} />
    </Pressable>
  );
}

/**
 * The bar: `positive` until the cap, `negative` once over, on a track in the page's border tone,
 * with a notch in the card's surface at the early warning. Decorative to TalkBack — the card
 * already says the figures in words.
 */
function ProgressBar({
  percent,
  over,
  warnAt,
}: {
  percent: number;
  over: boolean;
  warnAt: number | null;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{ height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' }}
    >
      <View
        style={{
          width: `${percent}%`,
          height: '100%',
          backgroundColor: over ? colors.negative : colors.positive,
        }}
      />
      {warnAt !== null && (
        <View
          style={{
            position: 'absolute',
            left: `${warnAt}%`,
            top: 0,
            bottom: 0,
            width: 2,
            marginLeft: -1,
            backgroundColor: colors.surface,
          }}
        />
      )}
    </View>
  );
}
