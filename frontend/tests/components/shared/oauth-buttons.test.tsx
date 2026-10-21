import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { signInWithOAuth } = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signInWithOAuth } } }));

import { OAuthButtons, oauthErrorFrom } from '@/components/shared/oauth-buttons';

afterEach(() => vi.clearAllMocks());

describe('OAuthButtons', () => {
  it('sends Google back to /login with the page to continue to', async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    render(<OAuthButtons next="/finance?tab=budgets" onError={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() =>
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login?next=%2Ffinance%3Ftab%3Dbudgets`,
        },
      })
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('reports a redirect that never started and lets the user try again', async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: { message: 'Provider disabled' } });
    const onError = vi.fn();
    render(<OAuthButtons next="/dashboard" onError={onError} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Provider disabled'));
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  });
});

describe('oauthErrorFrom', () => {
  it('reads the reason from the query string or the hash', () => {
    expect(oauthErrorFrom('?error=access_denied&error_description=User+cancelled', '')).toBe(
      'User cancelled'
    );
    expect(oauthErrorFrom('', '#error=server_error&error_description=Bad%20state')).toBe(
      'Bad state'
    );
    expect(oauthErrorFrom('?next=%2Fdashboard', '#access_token=abc')).toBeNull();
  });
});
