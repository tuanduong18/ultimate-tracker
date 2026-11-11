import { Link, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon, IconBadge, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A row that opens another screen: badge, name, one line of what it is, and a chevron that
 * says "goes somewhere". The whole row is the target — never just the chevron — and it is
 * well over Android's 48dp minimum.
 *
 * `tag` is a short status beside the name ("Coming in v0.2"), in the accent's soft pill as on the
 * web's dashboard and the placeholder — words, not a colour.
 */
export function NavRow({
  href,
  label,
  blurb,
  icon,
  tag,
}: {
  href: Href;
  label: string;
  blurb: string;
  icon: IconName;
  tag?: string;
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
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm }}
          >
            <Text variant="bodyStrong">{label}</Text>
            {tag ? (
              <View
                style={{
                  backgroundColor: colors.primarySoft,
                  borderRadius: RADIUS.pill,
                  paddingHorizontal: SPACE.sm,
                  paddingVertical: 2,
                }}
              >
                <Text variant="label" tone="primary">
                  {tag}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="caption" tone="fgMuted" numberOfLines={1}>
            {blurb}
          </Text>
        </View>
        <Icon name="chevron_right" tone="fgSubtle" />
      </Pressable>
    </Link>
  );
}
