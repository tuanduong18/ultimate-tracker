import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { get, patch } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get, patch } };
});

import { NotificationPreferences } from '@/components/settings/notification-preferences';
import type { Profile } from '@/lib/types/profile';

const PROFILE: Profile = {
  id: 'u1',
  display_name: null,
  timezone: 'UTC',
  display_currency: 'SGD',
  preferred_currency: 'USD',
  muted_notifications: ['subscription_renewals'],
  created_at: '2026-08-01T00:00:00Z',
};

afterEach(() => vi.clearAllMocks());

const toggle = (name: string) => screen.findByRole('switch', { name });

describe('NotificationPreferences', () => {
  it('shows one switch per category, off for the muted ones, and why currency has none', async () => {
    get.mockResolvedValue(PROFILE);
    render(<NotificationPreferences />);

    expect(await toggle('Subscription reminders')).toBeChecked();
    expect(await toggle('Renewals')).not.toBeChecked();
    expect(await toggle('Budget alerts')).toBeChecked();
    expect(screen.getAllByRole('switch')).toHaveLength(3);
    expect(await toggle('Budget alerts')).toHaveAccessibleDescription(
      'When a budget reaches its early warning or its cap.'
    );
    expect(screen.getByText(/Currency notices always arrive/)).toBeInTheDocument();
    expect(screen.getByText(/These apply on every device/)).toBeInTheDocument();
  });

  it('turning one off sends the whole list, and shows what the server stored', async () => {
    const stored = { ...PROFILE, muted_notifications: ['subscription_renewals', 'budget_alerts'] };
    get.mockResolvedValueOnce(PROFILE).mockResolvedValueOnce(stored);
    patch.mockResolvedValue(stored);
    render(<NotificationPreferences />);

    fireEvent.click(await toggle('Budget alerts'));

    // Flipped at once, before the server has answered.
    expect(await toggle('Budget alerts')).not.toBeChecked();
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/auth/me', {
        muted_notifications: ['subscription_renewals', 'budget_alerts'],
      })
    );
    await waitFor(() => expect(screen.queryByText('Saving…')).not.toBeInTheDocument());
    expect(await toggle('Budget alerts')).not.toBeChecked();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('turning one on takes it out of the list', async () => {
    get.mockResolvedValue(PROFILE);
    patch.mockResolvedValue(PROFILE);
    render(<NotificationPreferences />);

    fireEvent.click(await toggle('Renewals'));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/auth/me', { muted_notifications: [] })
    );
  });

  it('flips back and says so when the save fails', async () => {
    get.mockResolvedValue(PROFILE);
    patch.mockRejectedValue(new Error('network'));
    render(<NotificationPreferences />);

    fireEvent.click(await toggle('Budget alerts'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save that. Budget alerts is still on.'
    );
    expect(await toggle('Budget alerts')).toBeChecked();
  });

  it('takes one change at a time, without disabling the switch that has focus', async () => {
    get.mockResolvedValue(PROFILE);
    let finish: (value: Profile) => void = () => undefined;
    patch.mockReturnValue(new Promise<Profile>((resolve) => (finish = resolve)));
    render(<NotificationPreferences />);

    fireEvent.click(await toggle('Budget alerts'));
    fireEvent.click(await toggle('Subscription reminders'));

    expect(patch).toHaveBeenCalledTimes(1);
    expect(await toggle('Subscription reminders')).toHaveAttribute('aria-disabled', 'true');
    expect(await toggle('Subscription reminders')).not.toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');
    finish(PROFILE);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('says so when the profile cannot be loaded, rather than showing switches', async () => {
    get.mockRejectedValue(new Error('network'));
    render(<NotificationPreferences />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this.');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
