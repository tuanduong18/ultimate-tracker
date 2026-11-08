import { Pressable, View } from 'react-native';

import { CategoryBadge } from '@/components/finance/category-badge';
import { Text } from '@/components/text';
import { expenseLines } from '@/lib/finance/expenses';
import type { Category, Expense } from '@/lib/finance/types';
import { formatMoney } from '@/lib/money';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * One expense in a list — the phone's twin of the web's expense row, category first: the
 * category's badge, what it was (the description, or the category when there is none), the
 * category and date beneath, and the amount on the right.
 *
 * The whole row opens the expense to edit, at least 64dp tall; there are no small edit and
 * delete icons on it, as there are on the web, because a 24dp icon beside a 64dp row is a miss
 * waiting to happen on a phone — delete lives inside the edit screen, behind its confirmation.
 * The amount never wraps or truncates, and uses tabular figures so a column of them lines up.
 * TalkBack reads the row as one sentence: what, how much, and when.
 */
export function ExpenseRow({
  expense,
  category,
  onPress,
}: {
  expense: Expense;
  category: Category | undefined;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const { title, detail, categoryName } = expenseLines(expense, category);
  const money = formatMoney(expense.amount, expense.currency);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${money}, ${detail}`}
      accessibilityHint="Opens it to edit"
      android_ripple={{ color: colors.primarySoft }}
      style={{
        minHeight: TOUCH_TARGET + SPACE.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACE.md,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
      }}
    >
      <CategoryBadge colour={category?.colour ?? null} name={categoryName} icon={category?.icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" tone="fgMuted" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Text variant="bodyStrong" style={{ flexShrink: 0, fontVariant: ['tabular-nums'] }}>
        {money}
      </Text>
    </Pressable>
  );
}
