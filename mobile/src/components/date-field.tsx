import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import { IconButton } from '@/components/button';
import { PickerField } from '@/components/picker-field';
import { formatDate, fromIso, toIsoDate } from '@/lib/dates';

/**
 * A date, chosen in Android's own Material 3 date picker — the calendar every Android user has
 * met, with its own keyboard-entry mode, TalkBack support and the phone's first day of the week
 * — rather than a calendar drawn in the app, which would only look like it. The picker is
 * themed to the app (plugins/with-android-theme.js) and titled with the field's label.
 *
 * Holds the API's YYYY-MM-DD, built from the picked day's local parts, so the date never slips
 * a day across time zones. An optional field shows `emptyLabel` until set and gets a Clear
 * button; a required one always has a value (forms start them on today).
 */
export function DateField({
  label,
  value,
  onChange,
  optional = false,
  emptyLabel = 'Not set',
  minimum,
  maximum,
  hint,
  error,
}: {
  label: string;
  /** YYYY-MM-DD, or '' when an optional date is not set. */
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  emptyLabel?: string;
  /** Earliest and latest days the picker offers, as YYYY-MM-DD. */
  minimum?: string;
  maximum?: string;
  hint?: string;
  error?: string;
}) {
  function open() {
    DateTimePickerAndroid.open({
      value: fromIso(value) ?? fromIso(minimum ?? '') ?? new Date(),
      mode: 'date',
      design: 'material',
      title: label,
      minimumDate: minimum ? (fromIso(minimum) ?? undefined) : undefined,
      maximumDate: maximum ? (fromIso(maximum) ?? undefined) : undefined,
      onChange: (event, picked) => {
        if (event.type === 'set' && picked) onChange(toIsoDate(picked));
      },
    });
  }

  return (
    <PickerField
      label={label}
      value={value ? formatDate(value) : ''}
      placeholder={emptyLabel}
      icon="calendar_month"
      hint={hint}
      error={error}
      accessibilityHint="Opens a calendar"
      onPress={open}
      trailing={
        optional && value ? (
          <IconButton
            icon="close"
            label={`Clear ${label.toLowerCase()}`}
            tone="fgMuted"
            onPress={() => onChange('')}
          />
        ) : null
      }
    />
  );
}
