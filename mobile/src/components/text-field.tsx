import { useState, type Ref } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { RADIUS, SPACE, TOUCH_TARGET, TYPE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

type FieldKind = 'email' | 'current-password' | 'new-password';

// Each kind tells the keyboard and Android's autofill what the field is, so the password
// manager offers the saved login on Log in and offers to save a new one on Sign up.
const KIND: Record<FieldKind, TextInputProps> = {
  email: {
    autoComplete: 'email',
    inputMode: 'email',
    keyboardType: 'email-address',
  },
  'current-password': { autoComplete: 'current-password' },
  'new-password': { autoComplete: 'new-password' },
};

export interface TextFieldProps {
  label: string;
  kind: FieldKind;
  value: string;
  onChangeText: (value: string) => void;
  /** Shown under the field, in place of the hint, with an icon — never colour alone. */
  error?: string;
  hint?: string;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  ref?: Ref<TextInputInstance>;
}

/**
 * A labelled text field — the phone's twin of the web's auth `Field`.
 *
 * The label sits above the box, always visible, rather than Material's floating label inside
 * it: a label that shrinks into the border once you type is one more thing to read, and the
 * web's forms label the same way. The box is Material's outlined field: a 1dp `borderControl`
 * edge (≥ 3:1, measured), 2dp in `primary` while focused and in `negative` with an error.
 *
 * Passwords get a show/hide toggle — typing a long password blind on a phone keyboard is the
 * most common reason a first sign-in fails. TalkBack reads the field by its label, with the
 * error (or hint) as its hint; the visible label is hidden from it so it isn't read twice.
 */
export function TextField({
  label,
  kind,
  value,
  onChangeText,
  error,
  hint,
  returnKeyType,
  onSubmitEditing,
  ref,
}: TextFieldProps) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const isPassword = kind !== 'email';
  const thick = focused || Boolean(error);
  const edge = error ? colors.negative : focused ? colors.primary : colors.borderControl;

  return (
    <View style={{ gap: SPACE.xs }}>
      <Text variant="bodyStrong" importantForAccessibility="no">
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: TOUCH_TARGET,
          borderRadius: RADIUS.control,
          borderWidth: thick ? 2 : 1,
          borderColor: edge,
          backgroundColor: colors.surface,
          // The thicker edge grows inward: take the extra dp off the padding so the text
          // doesn't shift when the field gains focus.
          paddingLeft: SPACE.md - (thick ? 1 : 0),
        }}
      >
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          {...KIND[kind]}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          importantForAutofill="yes"
          secureTextEntry={isPassword && !shown}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          // Keep the keyboard up when Next moves to the following field.
          submitBehavior={returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          cursorColor={colors.primary}
          selectionColor={colors.primarySoft}
          selectionHandleColor={colors.primary}
          style={[
            TYPE.body,
            { flex: 1, minHeight: TOUCH_TARGET - 4, paddingVertical: SPACE.sm, color: colors.fg },
          ]}
        />
        {isPassword && (
          <Pressable
            onPress={() => setShown((current) => !current)}
            accessibilityRole="togglebutton"
            accessibilityLabel="Show password"
            accessibilityState={{ checked: shown }}
            android_ripple={{
              color: colors.primarySoft,
              borderless: true,
              radius: TOUCH_TARGET / 2,
            }}
            style={{
              width: TOUCH_TARGET,
              minHeight: TOUCH_TARGET - 4,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={shown ? 'visibility_off' : 'visibility'} size={22} tone="fgMuted" />
          </Pressable>
        )}
      </View>
      {error ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xs }}
        >
          <Icon name="error" size={16} tone="negative" style={{ marginTop: 1 }} />
          <Text variant="caption" tone="negative" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" tone="fgMuted" importantForAccessibility="no">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
