import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/brand';
import { Text } from '@/components/text';
import { SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * The log-in and sign-up frame — the phone's twin of the web's `AuthShell`, without its brand
 * panel: on a phone the form is the only thing worth the space.
 *
 * No top app bar. There is nowhere to go back to before signing in, so a bar would hold only a
 * title; instead the wordmark leads (the one screen where the brand belongs at the top) and the
 * title is a large header TalkBack can jump to. Content is centred when it fits and scrolls
 * when the keyboard or a large font size makes it taller than the screen; the keyboard pushes
 * it up rather than covering the field being typed in.
 */
export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          gap: SPACE.xl,
          paddingHorizontal: SPACE.xl,
          paddingTop: insets.top + SPACE.xxl,
          paddingBottom: insets.bottom + SPACE.xl,
        }}
      >
        <Wordmark />
        <View style={{ gap: SPACE.sm }}>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text tone="fgMuted">{subtitle}</Text> : null}
        </View>
        {children}
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The "or with email" rule between Google and the email form, as on the web. */
export function OrDivider() {
  const { colors } = useAppTheme();
  const line = { flex: 1, height: 1, backgroundColor: colors.border };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
      <View style={line} />
      <Text variant="caption" tone="fgMuted">
        or with email
      </Text>
      <View style={line} />
    </View>
  );
}

/**
 * "No account yet? Create one": a muted question and a link that answers it. The link is its
 * own 48dp target — an inline text link would be a 20dp sliver for a thumb.
 *
 * `dismissTo` goes back to the screen if it is already underneath (Sign up → Log in) instead of
 * stacking another copy, so system back never walks through Log in, Sign up, Log in…
 */
export function FooterLink({
  prompt,
  label,
  href,
}: {
  prompt?: string;
  label: string;
  href: Href;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.xs }}>
      {prompt ? <Text tone="fgMuted">{prompt}</Text> : null}
      <Link href={href} dismissTo asChild>
        <Pressable
          accessibilityRole="link"
          style={{ minHeight: TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: SPACE.xs }}
        >
          <Text variant="bodyStrong" tone="primary">
            {label}
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
