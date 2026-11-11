import type { Profile, ProfileUpdate } from '@/lib/types/profile';

/** Mirrors the backend's String(80) column, as the web's Name field does. */
export const NAME_MAX = 80;

/** What the Profile screen holds while it is edited: the field's text, not the stored value. */
export interface ProfileValues {
  name: string;
  preferred_currency: string;
  display_currency: string;
}

export function profileValues(profile: Profile): ProfileValues {
  return {
    name: profile.display_name ?? '',
    preferred_currency: profile.preferred_currency,
    display_currency: profile.display_currency,
  };
}

/**
 * Only what changed, as PATCH /auth/me takes it — the web's two cards each send their own fields
 * the same way. An empty name is a real choice, not an error: it is sent as null, and the name
 * from the sign-in provider shows again. Spaces around a name are dropped.
 */
export function profileChanges(profile: Profile, values: ProfileValues): ProfileUpdate {
  const changes: ProfileUpdate = {};
  const name = values.name.trim() || null;
  if (name !== profile.display_name) changes.display_name = name;
  if (values.preferred_currency !== profile.preferred_currency) {
    changes.preferred_currency = values.preferred_currency;
  }
  if (values.display_currency !== profile.display_currency) {
    changes.display_currency = values.display_currency;
  }
  return changes;
}
