import { render, screen } from '@testing-library/react-native';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import type { ReactNode } from 'react';

import Home from '@/app/index';

// The root layout supplies the theme in the app; a screen rendered alone needs it too.
function Themed({ children }: { children: ReactNode }) {
  return <ThemeProvider value={DefaultTheme}>{children}</ThemeProvider>;
}

describe('Home', () => {
  it('names the app and says sign-in is next', async () => {
    await render(<Home />, { wrapper: Themed });

    expect(screen.getByRole('header', { name: 'Ultimate Tracker' })).toBeOnTheScreen();
    expect(screen.getByText(/Sign-in comes next/)).toBeOnTheScreen();
  });
});
