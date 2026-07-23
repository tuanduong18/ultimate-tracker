import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Ultimate Tracker',
  description: 'Track every domain of your life — and see how they connect.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
