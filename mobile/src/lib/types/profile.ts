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
