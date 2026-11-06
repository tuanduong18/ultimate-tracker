import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { AppThemeProvider, useAppTheme } from '@/theme/theme-provider';
import { ACCENTS } from '@/theme/tokens';

function Probe() {
  const { theme, modePreference, colors, setTheme, setModePreference } = useAppTheme();
  return (
    <>
      <Text testID="state">{`${theme} ${modePreference} ${colors.primary}`}</Text>
      <Pressable accessibilityRole="button" onPress={() => setTheme('pastel-teal')}>
        <Text>Teal</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setModePreference('dark')}>
        <Text>Dark</Text>
      </Pressable>
    </>
  );
}

describe('AppThemeProvider', () => {
  it('starts from the stored choice it is given', async () => {
    await render(
      <AppThemeProvider initialTheme="pastel-rose" initialMode="light">
        <Probe />
      </AppThemeProvider>
    );
    expect(screen.getByTestId('state')).toHaveTextContent(
      `pastel-rose light ${ACCENTS['pastel-rose'].light.primary}`
    );
  });

  it('applies a change at once and reports the whole new appearance to remember', async () => {
    const onChange = jest.fn();
    await render(
      <AppThemeProvider initialTheme="pastel-blue" initialMode="light" onChange={onChange}>
        <Probe />
      </AppThemeProvider>
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Teal' }));
    expect(onChange).toHaveBeenLastCalledWith({ theme: 'pastel-teal', mode: 'light' });

    await fireEvent.press(screen.getByRole('button', { name: 'Dark' }));
    expect(onChange).toHaveBeenLastCalledWith({ theme: 'pastel-teal', mode: 'dark' });
    expect(screen.getByTestId('state')).toHaveTextContent(
      `pastel-teal dark ${ACCENTS['pastel-teal'].dark.primary}`
    );
  });
});
