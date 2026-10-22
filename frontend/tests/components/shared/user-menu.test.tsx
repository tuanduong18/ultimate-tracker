import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { pathname, signOut } = vi.hoisted(() => ({
  pathname: { current: '/dashboard' },
  signOut: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}));

// The menu reads /auth/me for the name. Leaving it unanswered keeps these
// tests on the session fallback, which is what they are about.
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get: () => new Promise(() => {}) } };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: { email: 'tuan@example.com' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut,
    },
  },
}));

import { ACCOUNT_LINKS } from '@/components/shared/nav-items';
import { UserMenu } from '@/components/shared/user-menu';
import { ThemeProvider } from '@/components/shared/theme-provider';

afterEach(() => {
  vi.clearAllMocks();
  pathname.current = '/dashboard';
  window.localStorage.clear();
  delete document.documentElement.dataset.mode;
});

async function openMenu() {
  render(<UserMenu />, { wrapper: ThemeProvider });
  const button = screen.getByRole('button', { name: 'Account menu' });
  // Wait for the session, so the avatar and the email have landed.
  expect(await screen.findByText('T')).toBeInTheDocument();
  fireEvent.click(button);
  return button;
}

describe('UserMenu', () => {
  it('shows the signed-in user’s initial and starts closed', async () => {
    render(<UserMenu />, { wrapper: ThemeProvider });

    expect(await screen.findByText('T')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
  });

  it('opens to who is signed in, every account page, and log out', async () => {
    const button = await openMenu();

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('tuan@example.com')).toBeInTheDocument();
    for (const link of ACCOUNT_LINKS) {
      expect(screen.getByRole('link', { name: link.label })).toHaveAttribute('href', link.href);
    }
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('marks the account page being viewed', async () => {
    pathname.current = '/settings';
    await openMenu();

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current');
  });

  it('closes on Escape and hands focus back to its button', async () => {
    const button = await openMenu();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes on a click anywhere outside it', async () => {
    const button = await openMenu();

    fireEvent.pointerDown(document.body);

    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes once a link is followed', async () => {
    const button = await openMenu();

    fireEvent.click(screen.getByRole('link', { name: 'Profile' }));

    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('signs the user out', async () => {
    await openMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(signOut).toHaveBeenCalledOnce();
  });

  describe('dark mode switch', () => {
    it('says it is following the device until it is flipped', async () => {
      await openMenu();
      const toggle = screen.getByRole('switch', { name: /Dark mode/ });

      // jsdom has no matchMedia, so "system" resolves to light.
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveTextContent('Following your device');

      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(toggle).not.toHaveTextContent('Following your device');
      expect(document.documentElement.dataset.mode).toBe('dark');
      expect(window.localStorage.getItem('ultimate-tracker:mode')).toBe('dark');
    });

    it('flips back to light and keeps the menu open to show it', async () => {
      window.localStorage.setItem('ultimate-tracker:mode', 'dark');
      await openMenu();
      const toggle = await screen.findByRole('switch', { name: /Dark mode/, checked: true });

      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(document.documentElement.dataset.mode).toBe('light');
      expect(screen.getByRole('button', { name: 'Account menu' })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });
  });
});
