import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { RADIUS, SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  /** Drawn before the label: a category's badge, a symbol. */
  leading?: ReactNode;
  /** When the visible label isn't enough on its own ("80%" → "Warn at 80% of the cap"). */
  accessibilityLabel?: string;
}

/**
 * Material's filter chips, wrapping across lines: a choice among a handful of options that
 * should all be visible at once and one tap away — a category while logging, a warning level,
 * a billing unit. Chosen over a dropdown because the point is to see every option, and over a
 * `RadioList` because these sit inside a form, where a card of 56dp rows per choice would push
 * Save off the screen.
 *
 * A chosen chip is filled `primarySoft` with a `primary` edge and a tick before its label —
 * shape as well as tint, so the choice never rests on colour alone. 40dp tall with 4dp of
 * hit slop each way, so each target is the full 48dp, and 8dp apart.
 *
 * `ChoiceChips` picks one (radio buttons to TalkBack); `CheckChips` picks any (checkboxes).
 */
export function ChoiceChips<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly ChipOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <ChipGroup label={label} role="radiogroup">
      {options.map((option) => (
        <Chip
          key={option.value}
          option={option}
          role="radio"
          chosen={option.value === selected}
          onPress={() => onSelect(option.value)}
        />
      ))}
    </ChipGroup>
  );
}

export function CheckChips<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly ChipOption<T>[];
  selected: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <ChipGroup label={label}>
      {options.map((option) => (
        <Chip
          key={option.value}
          option={option}
          role="checkbox"
          chosen={selected.includes(option.value)}
          onPress={() => onToggle(option.value)}
        />
      ))}
    </ChipGroup>
  );
}

/** The visible label above the chips — like a field's — and the group TalkBack names by it. */
function ChipGroup({
  label,
  role,
  children,
}: {
  label: string;
  role?: 'radiogroup';
  children: ReactNode;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text variant="bodyStrong" importantForAccessibility="no">
        {label}
      </Text>
      <View
        accessibilityRole={role}
        accessibilityLabel={label}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}
      >
        {children}
      </View>
    </View>
  );
}

function Chip<T extends string>({
  option,
  role,
  chosen,
  onPress,
}: {
  option: ChipOption<T>;
  role: 'radio' | 'checkbox';
  chosen: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={{ checked: chosen }}
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      hitSlop={4}
      android_ripple={{ color: colors.primarySoft }}
      style={{
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACE.sm,
        paddingLeft: chosen || option.leading ? SPACE.sm : SPACE.md,
        paddingRight: SPACE.md,
        borderRadius: RADIUS.control,
        borderWidth: 1,
        borderColor: chosen ? colors.primary : colors.borderControl,
        backgroundColor: chosen ? colors.primarySoft : colors.surface,
        overflow: 'hidden',
      }}
    >
      {chosen && <Icon name="check" size={18} tone="primary" />}
      {option.leading}
      <Text importantForAccessibility="no">{option.label}</Text>
    </Pressable>
  );
}
