import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/text';
import { SPACE } from '@/theme/scale';

/**
 * A titled group on a screen — a small header TalkBack can jump to, an optional line saying
 * what the group is for, then its card. The title is quiet (caption size, muted) because the
 * card under it is the thing to read; the description is body text because it explains a
 * consequence ("remembered on this phone").
 */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <View style={{ gap: SPACE.xs }}>
        <Text variant="caption" tone="fgMuted" accessibilityRole="header">
          {title}
        </Text>
        {description ? <Text tone="fgMuted">{description}</Text> : null}
      </View>
      {children}
    </View>
  );
}
