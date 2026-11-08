import { View } from 'react-native';

import { Button, IconButton } from '@/components/button';
import { Text } from '@/components/text';
import { FieldNote } from '@/components/text-field';
import { formatMonth, shiftMonth } from '@/lib/dates';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A month — a monthly budget's first or last — stepped with ‹ and ›, the twin of the web's
 * month input.
 *
 * Android has no month picker, and its date picker would ask for a day that means nothing here
 * ("which day of March?"), so the month is stepped instead: budgets start this month or a few
 * either side, which is a tap or two. TalkBack hears the month as an adjustable value — swipe up
 * or down to change it — as well as the two buttons. An optional month (the last one) can be
 * empty, which reads as `emptyLabel` ("Ongoing"), with a button to set one from `startFrom`.
 */
export function MonthField({
  label,
  value,
  onChange,
  optional = false,
  emptyLabel = 'Not set',
  setLabel = 'Set a month',
  startFrom,
  error,
  hint,
}: {
  label: string;
  /** The 1st of the month as YYYY-MM-01, or '' when an optional month is not set. */
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  emptyLabel?: string;
  setLabel?: string;
  /** Where an empty optional month starts when it is set. */
  startFrom?: string;
  error?: string;
  hint?: string;
}) {
  const { colors } = useAppTheme();
  const step = (by: number) => onChange(shiftMonth(value, by));

  return (
    <View style={{ gap: SPACE.xs }}>
      <Text variant="bodyStrong" importantForAccessibility="no">
        {label}
      </Text>
      {value ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
          <View
            style={{
              flex: 1,
              minHeight: TOUCH_TARGET,
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: RADIUS.control,
              borderWidth: error ? 2 : 1,
              borderColor: error ? colors.negative : colors.borderControl,
              backgroundColor: colors.surface,
            }}
          >
            <IconButton
              icon="chevron_left"
              label={`${label}: previous month`}
              onPress={() => step(-1)}
            />
            <Text
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={label}
              accessibilityValue={{ text: formatMonth(value) }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(event) =>
                step(event.nativeEvent.actionName === 'increment' ? 1 : -1)
              }
              style={{ flex: 1, textAlign: 'center' }}
            >
              {formatMonth(value)}
            </Text>
            <IconButton
              icon="chevron_right"
              label={`${label}: next month`}
              onPress={() => step(1)}
            />
          </View>
          {optional && (
            <IconButton
              icon="close"
              label={`Clear ${label.toLowerCase()}`}
              tone="fgMuted"
              onPress={() => onChange('')}
            />
          )}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
          <Text tone="fgMuted" style={{ flex: 1 }}>
            {emptyLabel}
          </Text>
          <Button
            label={setLabel}
            variant="text"
            onPress={() => startFrom && onChange(startFrom)}
          />
        </View>
      )}
      <FieldNote error={error} hint={hint} />
    </View>
  );
}
