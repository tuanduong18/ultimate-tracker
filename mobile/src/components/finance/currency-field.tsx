import { useState } from 'react';

import { PickerField } from '@/components/picker-field';
import { RadioList, RadioRow } from '@/components/radio-list';
import { SearchField } from '@/components/search-field';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { currencyName } from '@/lib/money';

/**
 * The currency an amount is in — the phone's twin of the web's CurrencySelect.
 *
 * A field that opens a sheet of the currencies the API supports (`/finance/currencies`, the only
 * source of codes — never a hard-coded list), searchable by code or name, with the current one
 * first. A code the list no longer has (delisted since the entry was made) is still shown and
 * kept, so editing an old entry never changes its currency behind the person's back. If the list
 * couldn't load, it falls back to typing the three-letter code, as the web does.
 */
export function CurrencyField({
  value,
  onChange,
  currencies,
  label = 'Currency',
  hint,
  error,
}: {
  value: string;
  onChange: (code: string) => void;
  currencies: readonly string[];
  label?: string;
  /** What the choice does (the profile's two currencies), under the field. */
  hint?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  if (currencies.length === 0) {
    return (
      <TextField
        label={label}
        kind="text"
        value={value}
        onChangeText={(typed) => onChange(typed.toUpperCase())}
        maxLength={3}
        hint={hint ?? 'A three-letter code, like SGD.'}
        error={error}
      />
    );
  }

  const phrase = query.trim().toLowerCase();
  const listed = [value, ...currencies.filter((code) => code !== value)].filter(
    (code) =>
      code &&
      (!phrase ||
        code.toLowerCase().includes(phrase) ||
        (currencyName(code) ?? '').toLowerCase().includes(phrase))
  );

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <PickerField
        label={label}
        value={value}
        icon="expand_more"
        hint={hint}
        error={error}
        accessibilityHint="Opens the list of currencies"
        onPress={() => setOpen(true)}
      />
      <Sheet visible={open} onClose={close} title={label}>
        <SearchField
          label="Search currencies"
          placeholder="Code or name"
          value={query}
          onChangeText={setQuery}
        />
        {listed.length > 0 ? (
          <RadioList label={label}>
            {listed.map((code) => (
              <RadioRow
                key={code}
                label={code}
                description={currencyName(code) ?? undefined}
                selected={code === value}
                onSelect={() => {
                  onChange(code);
                  close();
                }}
              />
            ))}
          </RadioList>
        ) : (
          <Text tone="fgMuted" accessibilityLiveRegion="polite">
            No currency matches “{query.trim()}”.
          </Text>
        )}
      </Sheet>
    </>
  );
}
