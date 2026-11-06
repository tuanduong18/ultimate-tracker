import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import Settings from '@/app/(tabs)/more/settings';
import { THEMES } from '@/theme/themes';
import { AppThemeProvider } from '@/theme/theme-provider';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));

const onChange = jest.fn();

function Remembering({ children }: { children: ReactNode }) {
  return (
    <AppThemeProvider initialTheme="pastel-blue" initialMode="system" onChange={onChange}>
      {children}
    </AppThemeProvider>
  );
}

beforeEach(() => onChange.mockReset());

describe('Settings', () => {
  it('asks the web’s two questions, with the current answers checked', async () => {
    await render(<Settings />, { wrapper: Remembering });

    expect(screen.getByRole('header', { name: 'Appearance' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Colour scheme' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Match system' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Blue' })).toBeChecked();
    expect(screen.getAllByRole('radio')).toHaveLength(3 + THEMES.length);
  });

  it('applies a mode at once and remembers it', async () => {
    await render(<Settings />, { wrapper: Remembering });
    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Match system' })).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith({ theme: 'pastel-blue', mode: 'dark' });
  });

  it('applies a scheme at once and remembers it', async () => {
    await render(<Settings />, { wrapper: Remembering });
    await fireEvent.press(screen.getByRole('radio', { name: 'Graphite' }));

    expect(screen.getByRole('radio', { name: 'Graphite' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Blue' })).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith({ theme: 'slate', mode: 'system' });
  });

  it('gives TalkBack each scheme’s description, as the web shows it in words', async () => {
    await render(<Settings />, { wrapper: Remembering });
    expect(screen.getByRole('radio', { name: 'Teal' }).props.accessibilityHint).toBe(
      'Cool sea-glass blue-green.'
    );
  });
});
