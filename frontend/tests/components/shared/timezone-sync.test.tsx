import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { get, patch } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, api: { get, patch } };
});

import { TimezoneSync, browserTimezone } from '@/components/shared/timezone-sync';
import type { Profile } from '@/lib/types/profile';

function profile(timezone: string): Profile {
  return {
    id: 'u1',
    display_name: null,
    timezone,
    display_currency: 'SGD',
    preferred_currency: 'SGD',
    created_at: '2026-08-01T00:00:00Z',
  };
}

/** Pretend the browser is in `zone`. */
function browserIn(zone: string) {
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...new Intl.DateTimeFormat().resolvedOptions(),
    timeZone: zone,
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('TimezoneSync', () => {
  it('moves the profile to where the browser is, without rendering anything', async () => {
    browserIn('Asia/Tokyo');
    get.mockResolvedValue(profile('Asia/Singapore'));
    patch.mockResolvedValue(profile('Asia/Tokyo'));

    const { container } = render(<TimezoneSync />);

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/auth/me', { timezone: 'Asia/Tokyo' }));
    // Silent: no notice, no prompt.
    expect(container).toBeEmptyDOMElement();
  });

  it('leaves the profile alone when it already matches', async () => {
    browserIn('Asia/Singapore');
    get.mockResolvedValue(profile('Asia/Singapore'));

    render(<TimezoneSync />);

    await waitFor(() => expect(get).toHaveBeenCalledWith('/auth/me'));
    expect(patch).not.toHaveBeenCalled();
  });

  it('swallows a failed load rather than surfacing an error', async () => {
    browserIn('Asia/Tokyo');
    get.mockRejectedValue(new Error('offline'));

    const { container } = render(<TimezoneSync />);

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(patch).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('does nothing when the browser will not name its timezone', async () => {
    browserIn('');

    render(<TimezoneSync />);

    // Nothing to compare against, so not even the profile is fetched.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(get).not.toHaveBeenCalled();
  });
});

describe('browserTimezone', () => {
  it('reads the IANA name the browser reports', () => {
    browserIn('Europe/Berlin');

    expect(browserTimezone()).toBe('Europe/Berlin');
  });
});
