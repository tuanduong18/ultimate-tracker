/** The signed-in user's profile, as returned by /auth/me. */
export interface Profile {
  id: string;
  /**
   * What the app calls the user, or null when they have not chosen one — use
   * `displayNameOf` from lib/identity rather than reading this directly, so the
   * sign-in provider's name fills the gap.
   */
  display_name: string | null;
  timezone: string;
  /**
   * The currency every figure on /finance/summary is converted into. Expenses
   * and budgets keep whatever currency they were recorded in.
   */
  display_currency: string;
  /** The currency new expenses, budgets and subscriptions start in. */
  preferred_currency: string;
  created_at: string;
}
