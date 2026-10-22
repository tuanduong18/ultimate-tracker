import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';

import { ThemeProvider } from '@/components/shared/theme-provider';
import { ThemeScript } from '@/components/shared/theme-script';

import './globals.css';

/**
 * Geist, self-hosted by next/font at build time — no request to Google from the
 * browser, and no layout shift while it loads.
 *
 * Chosen over the system stack, which renders as Segoe on Windows, San
 * Francisco on Apple and Roboto on Android: three different apps. Geist is
 * neutral and compact enough for dense dashboards, has true tabular figures
 * for columns of money, and a variable weight axis, so every weight is one file.
 */
const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });

/**
 * Each page sets its own short title and the template adds the app's name, so
 * a tab — and the route announcer, which reads document.title to tell screen
 * reader users where a client-side navigation landed — says "Finance ·
 * Ultimate Tracker" rather than the same two words on every page.
 */
export const metadata: Metadata = {
  title: { default: 'Ultimate Tracker', template: '%s · Ultimate Tracker' },
  description: 'Track every domain of your life — and see how they connect.',
};

/**
 * `viewport-fit=cover` lets the page run under a phone's rounded corners and
 * home indicator, which is what makes `env(safe-area-inset-*)` report real
 * values — the bottom tab bar pads itself by them. The theme colour tints the
 * browser's own toolbar to the page background in each mode.
 */
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf8' },
    { media: '(prefers-color-scheme: dark)', color: '#151312' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning because ThemeScript writes data-theme onto this
    // element before React sees it, so the server's markup and the client's
    // disagree here by design.
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
