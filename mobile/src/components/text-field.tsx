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

type FieldKind = 'email' | 'current-password' | 'new-password' | 'text' | 'amount' | 'integer';

const EXACT: TextInputProps = { autoCapitalize: 'none', autoCorrect: false, spellCheck: false };

// Each kind tells the keyboard and Android's autofill what the field is: the password manager
// offers the saved login on Log in and offers to save a new one on Sign up; an amount opens the
// number pad with a decimal point; free text gets sentence case and the phone's corrections.
const KIND: Record<FieldKind, TextInputProps> = {
  email: {
    ...EXACT,
    autoComplete: 'email',
    inputMode: 'email',
    keyboardType: 'email-address',
    importantForAutofill: 'yes',
  },
  'current-password': { ...EXACT, autoComplete: 'current-password', importantForAutofill: 'yes' },
  'new-password': { ...EXACT, autoComplete: 'new-password', importantForAutofill: 'yes' },
  text: { autoCapitalize: 'sentences', autoCorrect: true, importantForAutofill: 'no' },
  amount: {
    ...EXACT,
    inputMode: 'decimal',
    keyboardType: 'decimal-pad',
    importantForAutofill: 'no',
  },
  integer: {
    ...EXACT,
    inputMode: 'numeric',
    keyboardType: 'number-pad',
    importantForAutofill: 'no',
  },
};

const PASSWORD: ReadonlySet<FieldKind> = new Set(['current-password', 'new-password']);

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
  /** Open the keyboard on arrival — only for the one field a screen exists to fill (Amount). */
  autoFocus?: boolean;
  maxLength?: number;
  ref?: Ref<TextInputInstance>;
}

/**
 * A labelled text field — the phone's twin of the web's form fields.
 *
 * The label sits above the box, always visible, rather than Material's floating label inside
 * it: a label that shrinks into the border once you type is one more thing to read, and the
 * web's forms label the same way. The box is Material's outlined field: a 1dp `borderControl`
 * edge (≥ 3:1, measured), 2dp in `primary` while focused and in `negative` with an error.
 *
 * Passwords get a show/hide toggle — typing a long password blind on a phone keyboard is the
 * most common reason a first sign-in fails. Amounts use tabular figures so the digits don't
 * shift as they are typed. TalkBack reads the field by its label, with the error (or hint) as
 * its hint; the visible label is hidden from it so it isn't read twice.
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
  autoFocus,
  maxLength,
  ref,
}: TextFieldProps) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const isPassword = PASSWORD.has(kind);
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
          secureTextEntry={isPassword && !shown}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoFocus={autoFocus}
          maxLength={maxLength}
          // Keep the keyboard up when Next moves to the following field.
          submitBehavior={returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          underlineColorAndroid="transparent"
          cursorColor={colors.primary}
          selectionColor={colors.primarySoft}
          selectionHandleColor={colors.primary}
          style={[
            TYPE.body,
            { flex: 1, minHeight: TOUCH_TARGET - 4, paddingVertical: SPACE.sm, color: colors.fg },
            kind === 'amount' && { fontVariant: ['tabular-nums'] },
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
      <FieldNote error={error} hint={hint} />
    </View>
  );
}

/**
 * What sits under a field: its error, with an icon and announced politely as it appears, or
 * else its hint. Shared by every field that isn't a `TextField` (dates, months, currency), so
 * an error reads the same wherever it is.
 */
export function FieldNote({ error, hint }: { error?: string; hint?: string }) {
  if (error) {
    return (
      <View
        accessibilityLiveRegion="polite"
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xs }}
      >
        <Icon name="error" size={16} tone="negative" style={{ marginTop: 1 }} />
        <Text variant="caption" tone="negative" style={{ flex: 1 }}>
          {error}
        </Text>
      </View>
    );
  }
  if (hint) {
    return (
      <Text variant="caption" tone="fgMuted" importantForAccessibility="no">
        {hint}
      </Text>
    );
  }
  return null;
}
