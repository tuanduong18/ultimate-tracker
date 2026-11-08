import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { SPACE } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';
import { SCRIM } from '@/theme/themes';

/**
 * Material's modal bottom sheet, for a choice that belongs to the screen underneath: a currency
 * for the form, a date range for the list. The screen keeps the state; the sheet only edits it.
 *
 * Built on React Native's `Modal` — a real Android dialog window, so TalkBack's focus stays
 * inside it and system back closes it — rather than as a navigation route: a route would need a
 * store shared between screens just to hand one value back. Rises from the bottom (Reanimated,
 * which honours "Remove animations"), over a scrim that closes it when tapped. Its content
 * scrolls, and lifts with the keyboard for sheets that hold a field.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Actions pinned under the scrolling content (Done, Clear). */
  footer?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
          style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]}
        />
        <Animated.View
          entering={SlideInDown.duration(250)}
          accessibilityViewIsModal
          style={{
            maxHeight: '85%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: insets.bottom,
          }}
        >
          {/* Material's drag handle: says "sheet" at a glance, even though it isn't dragged. */}
          <View
            importantForAccessibility="no-hide-descendants"
            style={{
              alignSelf: 'center',
              width: 32,
              height: 4,
              borderRadius: 2,
              marginTop: SPACE.md,
              backgroundColor: colors.borderControl,
            }}
          />
          <Text
            variant="heading"
            accessibilityRole="header"
            style={{ paddingHorizontal: SPACE.xl, paddingTop: SPACE.lg, paddingBottom: SPACE.sm }}
          >
            {title}
          </Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: SPACE.xl,
              paddingBottom: SPACE.lg,
              gap: SPACE.lg,
            }}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: SPACE.sm,
                paddingHorizontal: SPACE.lg,
                paddingVertical: SPACE.sm,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
