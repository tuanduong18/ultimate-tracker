import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { current } = vi.hoisted(() => ({ current: { session: null as object | null } }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: current.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

import { HomeActions } from '@/components/home/home-actions';

afterEach(() => {
  current.session = null;
});

describe('HomeActions', () => {
  it('invites a visitor to sign up or log in', async () => {
    render(<HomeActions />);

    expect(await screen.findByRole('link', { name: /Get started/ })).toHaveAttribute(
      'href',
      '/signup'
    );
    expect(screen.getByRole('link', { name: 'I already have an account' })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  it('sends someone already signed in straight back to the app', async () => {
    current.session = { user: { email: 'tuan@example.com' } };
    render(<HomeActions compact />);

    expect(await screen.findByRole('link', { name: /Open dashboard/ })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });
});
