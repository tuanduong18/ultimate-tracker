/**
 * Money on the phone: shown from the API's decimal strings, added exactly, checked before it is
 * sent. The phone's copy of `formatMoney` and `amountProblem` (frontend/lib/types/finance.ts)
 * and `sumAmounts` (frontend/lib/money.ts) — the same rules, so a total reads the same on both.
 */

/**
 * One formatter per currency, made on first use.
 *
 * Building an Intl.NumberFormat is far slower than using one, and a list of expenses asks for
 * the same handful of currencies on every row. Keyed by currency alone because the locale is
 * always the phone's.
 */
const moneyFormats = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string): Intl.NumberFormat {
  let format = moneyFormats.get(currency);
  if (!format) {
    format = new Intl.NumberFormat(undefined, { style: 'currency', currency });
    moneyFormats.set(currency, format);
  }
  return format;
}

/**
 * An API money string in its own currency, the way the phone's locale writes it ("S$12.50").
 *
 * The float `Number(amount)` makes only ever sizes the digits for display — nothing is added
 * through it. A code Intl does not know still shows, as "12.50 XYZ", rather than throwing.
 */
export function formatMoney(amount: string, currency: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  try {
    return moneyFormat(currency).format(value);
  } catch {
    return `${amount} ${currency}`;
  }
}

let currencyNames: Intl.DisplayNames | null | undefined;

/**
 * A currency's name in the phone's language ("Singapore Dollar"), or null where the engine can't
 * say — Hermes may not have `Intl.DisplayNames`, and then the code alone has to do.
 */
export function currencyName(code: string): string | null {
  if (currencyNames === undefined) {
    try {
      currencyNames =
        typeof Intl.DisplayNames === 'function'
          ? new Intl.DisplayNames(undefined, { type: 'currency' })
          : null;
    } catch {
      currencyNames = null;
    }
  }
  try {
    const name = currencyNames?.of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

/**
 * What is wrong with a typed amount for *any* currency, or null.
 *
 * How many decimals a currency actually allows (0 for VND, 3 for KWD) is the backend's call — it
 * owns the minor-units table, and a copy here is how the two would drift. This catches the typo;
 * the API catches the rest, and `describeError` turns its answer into a sentence.
 */
export function amountProblem(raw: string): string | null {
  const value = raw.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(value)) return 'Enter an amount like 12.50.';
  if (Number(value) <= 0) return 'The amount must be more than zero.';
  return null;
}

/** Decimal places a money string actually carries. */
function scaleOf(amount: string): number {
  const [, fraction = ''] = amount.split('.');
  return fraction.length;
}

/**
 * Add money strings exactly, within one currency.
 *
 * Shifts each value to an integer number of its smallest unit, sums those, and shifts back — so
 * no step ever holds a fraction: "0.1" + "0.2" is "0.3", not 0.30000000000000004. Integers in a
 * double are exact below 2^53, about nine billion units at three decimals — past any personal
 * budget. Anything unparseable is skipped rather than turning the total into "NaN".
 */
export function sumAmounts(amounts: string[]): string {
  const usable = amounts.filter((amount) => /^-?\d+(\.\d+)?$/.test(amount.trim()));
  if (usable.length === 0) return '0';

  const scale = Math.max(...usable.map(scaleOf));
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
