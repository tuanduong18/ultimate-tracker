import { useTheme } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Placeholder home: proves a development build boots, routes and follows the system theme.
 * It says plainly what the app is not doing yet rather than showing a fake dashboard — the
 * copy rule is never to claim a state nobody has seen. Replaced by sign-in and the shell.
 */
export default function Home() {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        Ultimate Tracker
      </Text>
      <Text style={[styles.body, { color: colors.text }]}>
        The Android app is being built. Sign-in comes next.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 24, fontWeight: '600' },
  body: { fontSize: 16, textAlign: 'center' },
});
