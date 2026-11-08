import { Pressable, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  icon?: IconName;
  fullWidth?: boolean;
};

/**
 * The filled primary button — one per card or screen region, as on the web. At least 48dp tall
 * (Android's touch target), with Android's ripple as the press feedback rather than an opacity
 * fade, so it answers a tap the way the rest of the phone does.
 *
 * `fullWidth` for the one action that ends a form (Log in, Save); otherwise it sizes to its
 * label. Disabled — while its action runs — is the same colours at half opacity, the shared rule,
 * and TalkBack hears it as disabled. The label says what is happening ("Signing in…").
 */
export function PrimaryButton({ label, icon, fullWidth = false, disabled, ...props }: ButtonProps) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      android_ripple={{ color: colors.primarySoft }}
      disabled={disabled}
      {...props}
      style={{
        minHeight: TOUCH_TARGET,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACE.sm,
        paddingHorizontal: SPACE.lg,
        borderRadius: RADIUS.control,
        backgroundColor: colors.primary,
        opacity: disabled ? 0.5 : 1,
        overflow: 'hidden',
      }}
    >
      <Text variant="bodyStrong" style={{ color: colors.primaryFg }}>
        {label}
      </Text>
      {icon && <Icon name={icon} size={18} tone="primaryFg" />}
    </Pressable>
  );
}

/**
 * Every button that isn't the region's one filled action, Material's quieter kinds:
 *
 * - `outlined` — a second action beside the filled one (Retry, Choose another…): a 1dp
 *   `borderControl` edge and the accent's label.
 * - `text` — the lightest action, often inline (Clear, Select all): no edge at all.
 * - `danger` — the action that destroys something (Delete expense), outlined in `negative`
 *   rather than filled red: it starts a confirmation, it doesn't do the deed, and a solid red
 *   block would shout over the form's own Save. The cost is spelled out in the dialog it opens.
 */
export function Button({
  label,
  icon,
  variant = 'outlined',
  fullWidth = false,
  disabled,
  ...props
}: ButtonProps & { variant?: 'outlined' | 'text' | 'danger' }) {
  const { colors } = useAppTheme();
  const ink = variant === 'danger' ? colors.negative : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      android_ripple={{ color: variant === 'danger' ? colors.negativeSoft : colors.primarySoft }}
      disabled={disabled}
      {...props}
      style={{
        minHeight: TOUCH_TARGET,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACE.sm,
        paddingHorizontal: variant === 'text' ? SPACE.md : SPACE.lg,
        borderRadius: RADIUS.control,
        borderWidth: variant === 'text' ? 0 : 1,
        borderColor: variant === 'danger' ? colors.negative : colors.borderControl,
        opacity: disabled ? 0.5 : 1,
        overflow: 'hidden',
      }}
    >
      {icon && <Icon name={icon} size={18} tone={variant === 'danger' ? 'negative' : 'primary'} />}
      <Text variant="bodyStrong" style={{ color: ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A 48dp round target around one icon, for an action with no room for words (Previous month,
 * Renew now). The icon is decorative, so `label` must name the action and its object.
 */
export function IconButton({
  icon,
  label,
  tone = 'fg',
  disabled,
  ...props
}: Omit<PressableProps, 'children'> & {
  icon: IconName;
  label: string;
  tone?: 'fg' | 'fgMuted' | 'primary' | 'negative';
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      android_ripple={{ color: colors.primarySoft, borderless: true, radius: TOUCH_TARGET / 2 }}
      disabled={disabled}
      {...props}
      style={{
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon name={icon} tone={tone} />
    </Pressable>
  );
}
