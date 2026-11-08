import { Stack, usePreventRemove, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/button';
import { confirm } from '@/components/confirm';
import { FormError } from '@/components/form-error';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/** The pinned bar's height when it holds only the button, for the scroll view to clear. */
const BAR = TOUCH_TARGET + SPACE.lg * 2;

/**
 * A form that adds or edits one thing (an expense, a budget): its fields scroll, and its one
 * filled button is pinned at the bottom, riding above the keyboard.
 *
 * Pinned rather than at the end of the fields (the auth screens' pattern) because these forms
 * are longer than the screen once the keyboard is up: logging an expense is "type the amount,
 * tap a category, Save", and Save must be there without first closing the keyboard or scrolling
 * to find it. The bottom is still where the thumb is. A refusal sits right above the button, so
 * it is next to what caused it and above the keyboard too. While saving, the button is disabled
 * with a busy label ("Saving…"), and the screen leaves only once the server has the change.
 *
 * Forms open as full-screen modals over the tabs (src/app/(forms)), Material's full-screen dialog:
 * the tab bar has no job while you're filling one in, and with the keyboard up it would squeeze
 * the fields. The keyboard is handled by react-native-keyboard-controller, which knows Android's
 * edge-to-edge insets; React Native's own KeyboardAvoidingView guesses them.
 */
export function FormScreen({
  title,
  submitLabel,
  busyLabel = 'Saving…',
  busy,
  error,
  onSubmit,
  children,
}: {
  title: string;
  submitLabel: string;
  busyLabel?: string;
  busy: boolean;
  /** Why the last save failed, in words — `describeError`'s sentence. */
  error?: string | null;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title }} />
      <KeyboardAwareScrollView
        bottomOffset={BAR + SPACE.lg}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.lg, paddingBottom: SPACE.xxl }}
      >
        {children}
      </KeyboardAwareScrollView>
      {/* Lifted by the keyboard's height, less the navigation-bar inset it already covers. */}
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View
          style={{
            gap: SPACE.md,
            padding: SPACE.lg,
            paddingBottom: SPACE.lg + insets.bottom,
            backgroundColor: colors.bg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {error ? <FormError message={error} /> : null}
          <PrimaryButton
            fullWidth
            label={busy ? busyLabel : submitLabel}
            disabled={busy}
            accessibilityState={{ disabled: busy, busy }}
            onPress={onSubmit}
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

/**
 * Leaving a form without losing what was typed: while `dirty`, system back (or ✕) asks
 * "Discard changes?" before closing, and Keep editing stays. Returns `leave`, for after a save
 * or a delete has landed — it closes the form without asking, since nothing is lost then.
 */
export function useLeaveGuard(dirty: boolean): () => void {
  const router = useRouter();
  // Both ways out lower the guard before going, so it is never switched off while it still thinks
  // there is something to protect. `leaving` (after a save) goes back from the effect below;
  // `discarding` lets the blocked back gesture itself go through — they stay apart so the screen
  // is never popped twice.
  const [leaving, setLeaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  usePreventRemove(dirty && !leaving && !discarding, ({ repeat }) =>
    confirm({
      title: 'Discard changes?',
      message: 'What you’ve entered here hasn’t been saved.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      destructive: true,
      onConfirm: () => {
        setDiscarding(true);
        repeat();
      },
    })
  );

  useEffect(() => {
    if (leaving && router.canGoBack()) router.back();
  }, [leaving, router]);

  return useCallback(() => setLeaving(true), []);
}
