import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getSession, onAuthStateChange, replace } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange } },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/finance',
}));

import { AuthGuard } from '@/components/shared/auth-guard';

afterEach(() => {
  vi.clearAllMocks();
});

function stubAuth(session: unknown) {
  getSession.mockResolvedValue({ data: { session } });
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
}

describe('AuthGuard', () => {
  it('sends a signed-out visitor to the login page, remembering where they were', async () => {
    stubAuth(null);

    render(
      <AuthGuard>
        <p>secret</p>
      </AuthGuard>
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Ffinance'));
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders the page once a session is present', async () => {
    stubAuth({ user: { email: 'someone@example.com' } });

    render(
      <AuthGuard>
        <p>secret</p>
      </AuthGuard>
    );

    expect(await screen.findByText('secret')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not redirect before the stored session has been read', () => {
    getSession.mockReturnValue(new Promise(() => {}));
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });

    render(
      <AuthGuard>
        <p>secret</p>
      </AuthGuard>
    );

    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});
