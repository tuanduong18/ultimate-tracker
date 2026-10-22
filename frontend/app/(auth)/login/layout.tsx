import type { Metadata } from 'next';

/**
 * Exists only to name the page. The log-in page is a client component, which
 * cannot export metadata itself, and without a title of its own every route
 * announces itself to a screen reader as plain "Ultimate Tracker".
 */
export const metadata: Metadata = { title: 'Log in' };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
