import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { RadioList, RadioRow } from '@/components/radio-list';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { ACCENTS } from '@/theme/tokens';
import {
  MODES,
  THEMES,
  type ModePreference,
  type ResolvedMode,
  type ThemeId,
} from '@/theme/themes';
import { useAppTheme } from '@/theme/theme-provider';

const MODE_ICONS: Record<ModePreference, IconName> = {
  light: 'light_mode',
  dark: 'dark_mode',
  system: 'smartphone',
};

/**
 * Settings — the twin of the web's /settings: how the app looks on this phone. The same two
 * questions, in the same words: light or dark (Appearance), then the accent (Colour scheme).
 * Two questions rather than one list of sixteen looks, because people answer them for different
 * reasons — the room they are in, the colour they like.
 *
 * A choice applies the moment it's tapped, with no Save: the whole screen recolours under the
 * finger, a better preview than any swatch, and there is nothing to lose by changing your mind.
 * It is remembered on this phone; the display currency, which travels with the account, will
 * live with the profile.
 */
export default function Settings() {
  const { theme, setTheme, modePreference, setModePreference, mode } = useAppTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <Screen>
        <Section
          title="Appearance"
          description="Match system follows your phone’s light or dark setting, and changes when it does."
        >
          <RadioList label="Appearance">
            {MODES.map((option) => (
              <RadioRow
                key={option.id}
                label={option.label}
                selected={modePreference === option.id}
                onSelect={() => setModePreference(option.id)}
                leading={<Icon name={MODE_ICONS[option.id]} tone="fgMuted" />}
              />
            ))}
          </RadioList>
        </Section>

        <Section
          title="Colour scheme"
          description="Applies straight away, and is remembered on this phone. Every scheme has a light and a dark version."
        >
          <RadioList label="Colour scheme">
            {THEMES.map((option) => (
              <RadioRow
                key={option.id}
                label={option.label}
                description={option.blurb}
                selected={theme === option.id}
                onSelect={() => setTheme(option.id)}
                leading={<Swatches theme={option.id} mode={mode} />}
              />
            ))}
          </RadioList>
        </Section>
      </Screen>
    </>
  );
}

/**
 * A scheme's two colours — its pastel and its accent — in the mode on screen now, so what you
 * pick is what you get. From the generated tokens, like every other colour.
 */
function Swatches({ theme, mode }: { theme: ThemeId; mode: ResolvedMode }) {
  const { colors } = useAppTheme();
  const accent = ACCENTS[theme][mode];
  return (
    <View style={{ flexDirection: 'row', gap: SWATCH_GAP }}>
      {[accent.primarySoft, accent.primary].map((colour) => (
        <View
          key={colour}
          style={{
            width: SWATCH,
            height: SWATCH,
            borderRadius: SWATCH / 2,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colour,
          }}
        />
      ))}
    </View>
  );
}

const SWATCH = 20;
const SWATCH_GAP = 4;
