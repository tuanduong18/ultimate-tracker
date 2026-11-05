import { Link, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon, IconBadge, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A row that opens another screen: badge, name, one line of what it is, and a chevron that
 * says "goes somewhere". The whole row is the target — never just the chevron — and it is
 * well over Android's 48dp minimum.
 */
export function NavRow({
  href,
  label,
  blurb,
  icon,
}: {
  href: Href;
  label: string;
  blurb: string;
  icon: IconName;
}) {
  const { colors } = useAppTheme();
  return (
    <Link href={href} asChild>
      <Pressable
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
        <IconBadge name={icon} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong">{label}</Text>
          <Text variant="caption" tone="fgMuted" numberOfLines={1}>
            {blurb}
          </Text>
        </View>
        <Icon name="chevron_right" tone="fgSubtle" />
      </Pressable>
    </Link>
  );
}
