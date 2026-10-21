import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { patch, session } = vi.hoisted(() => ({
  patch: vi.fn(),
  session: {
    user: {
      email: 'tuan@example.com',
      user_metadata: { full_name: 'Tuan Nguyen' },
      app_metadata: { providers: ['google'] },
    },
  },
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { patch } };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

import { AccountForm } from '@/components/profile/account-form';
import { ApiError } from '@/lib/api-client';
import { PROFILE_CHANGED } from '@/lib/identity';
import type { Profile } from '@/lib/types/profile';

const PROFILE: Profile = {
  id: 'u1',
  display_name: null,
  timezone: 'UTC',
  display_currency: 'USD',
  preferred_currency: 'USD',
  created_at: '2026-08-01T00:00:00Z',
};

afterEach(() => vi.clearAllMocks());

describe('AccountForm', () => {
  it('falls back to the Google name, and shows the email and sign-in method', async () => {
    render(<AccountForm profile={PROFILE} onSaved={vi.fn()} />);

    expect(await screen.findByText('Tuan Nguyen')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveAttribute('placeholder', 'Tuan Nguyen');
    expect(screen.getAllByText('tuan@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves a trimmed name, reloads, and tells the rest of the page', async () => {
    patch.mockResolvedValue({ ...PROFILE, display_name: 'Tuan' });
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const announced = vi.fn();
    window.addEventListener(PROFILE_CHANGED, announced);
    render(<AccountForm profile={PROFILE} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Tuan ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/auth/me', { display_name: 'Tuan' }));
    expect(onSaved).toHaveBeenCalled();
    await waitFor(() => expect(announced).toHaveBeenCalled());
    window.removeEventListener(PROFILE_CHANGED, announced);
  });

  it('sends null when the name is emptied', async () => {
    patch.mockResolvedValue(PROFILE);
    render(<AccountForm profile={{ ...PROFILE, display_name: 'Tuan' }} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/auth/me', { display_name: null }));
  });

  it('reports a failed save instead of implying it worked', async () => {
    patch.mockRejectedValue(new ApiError(503, { code: 'AUTH_UNAVAILABLE', message: 'Down.' }));
    render(<AccountForm profile={PROFILE} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Tuan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Down.');
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });
});
