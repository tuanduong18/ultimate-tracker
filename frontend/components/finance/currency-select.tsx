'use client';

interface CurrencySelectProps {
  id: string;
  value: string;
  currencies: string[];
  disabled?: boolean;
  onChange: (currency: string) => void;
}

/**
 * Currency picker fed by GET /finance/currencies.
 *
 * The list is served rather than vendored here so the picker cannot offer a code
 * the schemas would reject. If that fetch fails we fall back to a free-text box:
 * a reference list being down should not stop someone recording what they spent,
 * and the backend validates the code either way.
 */
export function CurrencySelect({
  id,
  value,
  currencies,
  disabled = false,
  onChange,
}: CurrencySelectProps) {
  if (currencies.length === 0) {
    return (
      <input
        id={id}
        className="mt-1 w-24 rounded border px-2 py-2 uppercase"
        value={value}
        disabled={disabled}
        maxLength={3}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
    );
  }

  return (
    <select
      id={id}
      className="mt-1 w-24 rounded border px-2 py-2"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {/* A stored currency that has since left the list would otherwise render
          as the first option and silently rewrite itself on the next save. */}
      {!currencies.includes(value) && <option value={value}>{value}</option>}
      {currencies.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  );
}
