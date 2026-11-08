import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { IconButton } from '@/components/button';
import { Icon } from '@/components/icon';
import { RADIUS, SPACE, TOUCH_TARGET, TYPE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A search box over a list: a magnifier, the text, and a clear button once there is text. The
 * one field where a placeholder stands in for a visible label — the magnifier and the list
 * under it already say what it is — so TalkBack gets the full name from `label` instead.
 * Results follow each keystroke; there is nothing to submit.
 */
export function SearchField({
  label,
  placeholder,
  value,
  onChangeText,
}: {
  /** What TalkBack calls it ("Search transactions"). */
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: TOUCH_TARGET,
        paddingLeft: SPACE.md - (focused ? 1 : 0),
        borderRadius: RADIUS.pill,
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? colors.primary : colors.borderControl,
        backgroundColor: colors.surface,
      }}
    >
      <Icon name="search" size={22} tone="fgMuted" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.fgMuted}
        accessibilityLabel={label}
        inputMode="search"
        returnKeyType="search"
        autoCorrect={false}
        importantForAutofill="no"
        underlineColorAndroid="transparent"
        cursorColor={colors.primary}
        selectionColor={colors.primarySoft}
        selectionHandleColor={colors.primary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          TYPE.body,
          { flex: 1, minHeight: TOUCH_TARGET - 4, paddingHorizontal: SPACE.sm, color: colors.fg },
        ]}
      />
      {value ? (
        <IconButton
          icon="close"
          label="Clear search"
          tone="fgMuted"
          onPress={() => onChangeText('')}
        />
      ) : null}
    </View>
  );
}
