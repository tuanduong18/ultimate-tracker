'use client';

import { useEffect, useRef } from 'react';

/**
 * Money moved somewhere other than the view showing it.
 *
 * Expenses are added from a dialog that lives outside the views that show them
 * — beside the Finance title, and on the dashboard — so whichever view is on
 * screen has to hear about it to show the new row and redo its totals. Same
 * shape as NOTIFICATIONS_CHANGED: a window event, because the adder and the
 * listeners share no parent short of the layout.
 */
export const EXPENSES_CHANGED = 'finance:expenses-changed';

export function announceExpensesChange(): void {
  window.dispatchEvent(new Event(EXPENSES_CHANGED));
}

/** Run `onChange` whenever an expense is added, edited or deleted elsewhere. */
export function useExpensesChanged(onChange: () => void): void {
  const latest = useRef(onChange);

  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    const fire = () => latest.current();
    window.addEventListener(EXPENSES_CHANGED, fire);
    return () => window.removeEventListener(EXPENSES_CHANGED, fire);
  }, []);
}
