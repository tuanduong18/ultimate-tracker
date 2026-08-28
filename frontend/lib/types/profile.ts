/** The signed-in user's profile, as returned by /auth/me. */
export interface Profile {
  id: string;
  timezone: string;
  /**
   * The currency every figure on /finance/summary is converted into. Expenses
   * and budgets keep whatever currency they were recorded in.
   */
  display_currency: string;
  created_at: string;
}
