import type { ReactNode } from 'react';

import { AppThemeProvider } from '@/theme/theme-provider';

/**
 * The render wrapper for anything that draws: every component reads its colours from the
 * theme, so a test renders it inside the provider, as the app does.
 *
 *   await render(<Thing />, { wrapper: Themed });
 */
export function Themed({ children }: { children: ReactNode }) {
  return <AppThemeProvider>{children}</AppThemeProvider>;
}
