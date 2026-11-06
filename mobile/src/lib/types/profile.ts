/**
 * The signed-in user's profile, as returned by /auth/me — the same shape as the web's
 * frontend/lib/types/profile.ts.
 */
export interface Profile {
  id: string;
  /** What the app calls the user, or null when they have not chosen one. */
  display_name: string | null;
  timezone: string;
  /** The currency every figure on the finance summary is converted into. */
  display_currency: string;
  /** The currency new expenses, budgets and subscriptions start in. */
  preferred_currency: string;
  created_at: string;
}
