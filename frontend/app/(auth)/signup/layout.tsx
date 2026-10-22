import type { Metadata } from 'next';

/** Names the page; see the log-in layout beside it for why this file exists. */
export const metadata: Metadata = { title: 'Create account' };

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
