import { profileChanges, profileValues } from '@/lib/profile-form';
import type { Profile } from '@/lib/types/profile';

const PROFILE: Profile = {
  id: 'u1',
  display_name: 'Tuan',
  timezone: 'Asia/Singapore',
  display_currency: 'SGD',
  preferred_currency: 'SGD',
  created_at: '2026-08-01T00:00:00Z',
};

describe('profileChanges', () => {
  it('sends nothing when nothing changed', () => {
    expect(profileChanges(PROFILE, profileValues(PROFILE))).toEqual({});
  });

  it('sends only the fields that changed', () => {
    const values = { ...profileValues(PROFILE), display_currency: 'USD' };
    expect(profileChanges(PROFILE, values)).toEqual({ display_currency: 'USD' });
  });

  it('trims the name, and clears it as null so the sign-in name shows again', () => {
    expect(profileChanges(PROFILE, { ...profileValues(PROFILE), name: '  Minh ' })).toEqual({
      display_name: 'Minh',
    });
    expect(profileChanges(PROFILE, { ...profileValues(PROFILE), name: '   ' })).toEqual({
      display_name: null,
    });
    // Spaces around the stored name are not a change.
    expect(profileChanges(PROFILE, { ...profileValues(PROFILE), name: ' Tuan ' })).toEqual({});
  });

  it('starts an unnamed profile with an empty field', () => {
    expect(profileValues({ ...PROFILE, display_name: null }).name).toBe('');
  });
});
