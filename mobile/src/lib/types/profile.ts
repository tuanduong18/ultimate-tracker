import type * as Api from '@/lib/types/api.gen';

/**
 * The signed-in user's profile, as returned by /auth/me. Its fields come from the backend's
 * schema (api.gen.ts), the same generated file the web imports.
 *
 * - `display_name`: what the app calls the user, or null when they have not chosen one.
 * - `display_currency`: the currency every figure on the finance summary is converted into.
 * - `preferred_currency`: the currency new expenses, budgets and subscriptions start in.
 */
export type Profile = Api.ProfileRead;

/**
 * A change to the profile (PATCH /auth/me): only the fields sent are changed. `display_name: null`
 * clears the name, so the sign-in provider's shows again. The timezone is the phone's to send
 * (auth/timezone-sync.ts), never the Profile screen's.
 */
export type ProfileUpdate = Api.ProfileUpdate;
