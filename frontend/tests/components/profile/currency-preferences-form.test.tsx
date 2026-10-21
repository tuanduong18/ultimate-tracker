import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { get, patch } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get, patch } };
});

import { CurrencyPreferencesForm } from '@/components/profile/currency-preferences-form';
import { ApiError } from '@/lib/api-client';
import type { Profile } from '@/lib/types/profile';

const PROFILE: Profile = {
  id: 'u1',
  display_name: null,
  timezone: 'UTC',
  display_currency: 'SGD',
  preferred_currency: 'USD',
  created_at: '2026-08-01T00:00:00Z',
};

afterEach(() => vi.clearAllMocks());

describe('CurrencyPreferencesForm', () => {
  it('starts on the stored currencies with nothing to save', async () => {
    get.mockResolvedValue(['USD', 'SGD', 'VND']);
    render(<CurrencyPreferencesForm profile={PROFILE} onSaved={vi.fn()} />);

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(await screen.findByLabelText('Preferred currency')).toHaveValue('USD');
    expect(screen.getByLabelText('Report totals in')).toHaveValue('SGD');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('patches only the currency that changed', async () => {
    get.mockResolvedValue(['USD', 'SGD', 'VND']);
    patch.mockResolvedValue({ ...PROFILE, preferred_currency: 'VND' });
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<CurrencyPreferencesForm profile={PROFILE} onSaved={onSaved} />);

    await waitFor(() => expect(screen.getAllByRole('option', { name: 'VND' })).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('Preferred currency'), { target: { value: 'VND' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/auth/me', { preferred_currency: 'VND' })
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('has nothing to save when a change is put back', async () => {
    get.mockResolvedValue(['USD', 'SGD', 'VND']);
    render(<CurrencyPreferencesForm profile={PROFILE} onSaved={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByRole('option', { name: 'VND' })).toHaveLength(2));
    const select = screen.getByLabelText('Report totals in');
    fireEvent.change(select, { target: { value: 'VND' } });
    fireEvent.change(select, { target: { value: 'SGD' } });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('still offers both pickers when the currency list fails to load', async () => {
    get.mockRejectedValue(new ApiError(500, { code: 'HTTP_ERROR', message: 'Boom.' }));
    render(<CurrencyPreferencesForm profile={PROFILE} onSaved={vi.fn()} />);

    // Falls back to free-text boxes: a reference list being down is not a
    // reason to lock someone out of their own preference.
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.getByLabelText('Preferred currency')).toHaveValue('USD');
    expect(screen.getByLabelText('Report totals in')).toHaveValue('SGD');
  });
});
