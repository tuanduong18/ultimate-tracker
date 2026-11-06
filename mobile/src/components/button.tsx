import { Pressable, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The filled primary button — one per card or screen region, as on the web. At least 48dp tall
 * (Android's touch target), with Android's ripple as the press feedback rather than an opacity
 * fade, so it answers a tap the way the rest of the phone does.
 *
 * `fullWidth` for the one action that ends a form (Log in); otherwise it sizes to its label.
 * Disabled — while its action runs — is the same colours at half opacity, the shared rule, and
 * TalkBack hears it as disabled. The label says what is happening ("Signing in…").
 */
export function PrimaryButton({
  label,
  icon,
  fullWidth = false,
  disabled,
  ...props
}: Omit<PressableProps, 'children'> & { label: string; icon?: IconName; fullWidth?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
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
