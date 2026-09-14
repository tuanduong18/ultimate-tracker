/**
 * Adding up the money strings the API sends.
 *
 * lib/types/finance explains why every amount arrives as a string: a JSON
 * number becomes a binary float here, and budget arithmetic off by a cent is
 * worse than a string we parse on purpose. It also says that if these ever need
 * adding, it should happen in integer minor units rather than through
 * parseFloat. This is that.
 *
 * Summing is only ever safe within one currency, and the breakdown responses
 * carry a single `currency` covering every row — which is what makes a total
 * over them meaningful at all. Nothing here converts anything.
 */

/** Decimal places a money string actually carries. */
function scaleOf(amount: string): number {
  const [, fraction = ''] = amount.split('.');
  return fraction.length;
}

/**
 * Add money strings exactly.
 *
 * Shifts each value to an integer number of its smallest unit, sums those, and
 * shifts back — so no step ever holds a fraction. Adding "0.1" and "0.2" here
 * gives "0.3" rather than the 0.30000000000000004 that adding them directly
 * would.
 *
 * Anything unparseable is skipped rather than poisoning the total with NaN: a
 * total that silently omits a row is bad, but one reading "NaN" next to a pie
 * chart is worse, and the API's own validation makes malformed input a bug
 * rather than something a user can cause.
 */
export function sumAmounts(amounts: string[]): string {
  const usable = amounts.filter((amount) => /^-?\d+(\.\d+)?$/.test(amount.trim()));
  if (usable.length === 0) return '0';

  const scale = Math.max(...usable.map(scaleOf));

  // Plain numbers, not BigInt: once shifted these are integers, and integer
  // arithmetic in a double is exact below 2^53 — about nine billion units at
  // three decimal places, which no personal budget reaches. The float problem
  // this avoids is in the *fraction*, and after the shift there is not one.
  let total = 0;
  for (const amount of usable) {
    const trimmed = amount.trim();
    const negative = trimmed.startsWith('-');
    const [whole, fraction = ''] = trimmed.replace('-', '').split('.');
    const shifted = Number(whole + fraction.padEnd(scale, '0'));
    total += negative ? -shifted : shifted;
  }

  if (scale === 0) return String(total);

  const negative = total < 0;
  const digits = String(Math.abs(total)).padStart(scale + 1, '0');
  return `${negative ? '-' : ''}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}
