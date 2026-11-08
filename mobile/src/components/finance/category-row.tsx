import { Pressable, View } from 'react-native';

import { CategoryBadge } from '@/components/finance/category-badge';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import type { Category } from '@/lib/finance/types';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A category in the Categories list: its badge exactly as every expense row will draw it, its
 * name, and the chevron that says a tap opens it. The whole row is the target, at least 64dp.
 */
export function CategoryRow({ category, onPress }: { category: Category; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={category.name}
      accessibilityHint="Opens it to rename, recolour or delete"
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
      <CategoryBadge colour={category.colour} name={category.name} icon={category.icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong">{category.name}</Text>
      </View>
      <Icon name="chevron_right" tone="fgSubtle" />
    </Pressable>
  );
}
