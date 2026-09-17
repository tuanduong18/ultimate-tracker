import type { Metadata } from 'next';

import { ThemeProvider } from '@/components/shared/theme-provider';
import { ThemeScript } from '@/components/shared/theme-script';

import './globals.css';

export const metadata: Metadata = {
  title: 'Ultimate Tracker',
  description: 'Track every domain of your life — and see how they connect.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning because ThemeScript writes data-theme onto this
    // element before React sees it, so the server's markup and the client's
    // disagree here by design.
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
