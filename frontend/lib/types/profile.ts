import type * as Api from '@/lib/types/api.gen';

/**
 * The signed-in user's profile, as returned by /auth/me. Its fields come from
 * the backend's schema (api.gen.ts).
 *
 * - `display_name`: what the app calls the user, or null when they have not
 *   chosen one — use `displayNameOf` from lib/identity rather than reading this
 *   directly, so the sign-in provider's name fills the gap.
 * - `display_currency`: the currency every figure on /finance/summary is
 *   converted into. Expenses and budgets keep whatever currency they were
 *   recorded in.
 * - `preferred_currency`: the currency new expenses, budgets and subscriptions
 *   start in.
 */
export type Profile = Api.ProfileRead;
