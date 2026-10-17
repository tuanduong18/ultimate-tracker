import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { get, post, patch, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get, post, patch, delete: del } };
});

import { ApiError } from '@/lib/api-client';
import { DisplayCurrencyForm } from '@/components/profile/display-currency-form';

const PROFILE = {
  id: 'u1',
  timezone: 'UTC',
  display_currency: 'USD',
  created_at: '2026-08-01T00:00:00Z',
};

/** Both hooks fetch on mount; answer by path rather than by call order. */
function respond(profile = PROFILE) {
  get.mockImplementation((path: string) =>
    path === '/auth/me' ? Promise.resolve(profile) : Promise.resolve(['USD', 'SGD', 'VND'])
  );
}

afterEach(() => vi.clearAllMocks());

describe('DisplayCurrencyForm', () => {
  it('starts on the stored currency with nothing to save', async () => {
    respond();
    render(<DisplayCurrencyForm />);

    expect(await screen.findByLabelText('Currency')).toHaveValue('USD');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('patches the profile and confirms it saved', async () => {
    respond();
    patch.mockResolvedValue({ ...PROFILE, display_currency: 'SGD' });
    render(<DisplayCurrencyForm />);

    fireEvent.change(await screen.findByLabelText('Currency'), { target: { value: 'SGD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/auth/me', { display_currency: 'SGD' })
    );
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('reports a failed save instead of implying it worked', async () => {
    respond();
    patch.mockRejectedValue(new ApiError(503, { code: 'AUTH_UNAVAILABLE', message: 'Down.' }));
    render(<DisplayCurrencyForm />);

    fireEvent.change(await screen.findByLabelText('Currency'), { target: { value: 'VND' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('still offers the picker when the currency list fails to load', async () => {
    get.mockImplementation((path: string) =>
      path === '/auth/me'
        ? Promise.resolve(PROFILE)
        : Promise.reject(new ApiError(500, { code: 'HTTP_ERROR', message: 'Boom.' }))
    );
    render(<DisplayCurrencyForm />);

    // Falls back to a free-text box: a reference list being down is not a
    // reason to lock someone out of their own preference.
    expect(await screen.findByLabelText('Currency')).toHaveValue('USD');
  });
});
