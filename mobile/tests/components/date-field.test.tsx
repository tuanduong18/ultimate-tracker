import { fireEvent, render, screen } from '@testing-library/react-native';

import { DateField } from '@/components/date-field';
import { formatDate } from '@/lib/dates';
import { Themed } from '../support/themed';

const mockOpen = jest.fn();
jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: (options: unknown) => mockOpen(options) },
}));

beforeEach(() => mockOpen.mockReset());

describe('DateField', () => {
  it('opens Android’s Material date picker on the current date, titled by the field', async () => {
    await render(<DateField label="Date" value="2026-11-07" onChange={jest.fn()} />, {
      wrapper: Themed,
    });

    await fireEvent.press(
      screen.getByRole('button', { name: `Date, ${formatDate('2026-11-07')}` })
    );

    const options = mockOpen.mock.calls[0][0];
    expect(options).toMatchObject({ mode: 'date', design: 'material', title: 'Date' });
    expect(options.value).toEqual(new Date(2026, 10, 7));
  });

  it('hands back the picked day from its local parts, and ignores a dismissal', async () => {
    const onChange = jest.fn();
    await render(<DateField label="Date" value="2026-11-07" onChange={onChange} />, {
      wrapper: Themed,
    });
    await fireEvent.press(screen.getByRole('button', { name: /^Date, / }));
    const { onChange: picked } = mockOpen.mock.calls[0][0];

    picked({ type: 'dismissed' }, undefined);
    expect(onChange).not.toHaveBeenCalled();

    // Late evening, when toISOString() would already say tomorrow in UTC+8.
    picked({ type: 'set' }, new Date(2026, 10, 9, 23, 30));
    expect(onChange).toHaveBeenCalledWith('2026-11-09');
  });

  it('shows an optional date as not set, and clears one that is', async () => {
    const onChange = jest.fn();
    const view = await render(
      <DateField
        label="Free trial ends"
        value=""
        optional
        emptyLabel="No trial"
        onChange={onChange}
      />,
      { wrapper: Themed }
    );
    expect(screen.getByRole('button', { name: 'Free trial ends, No trial' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Clear free trial ends' })).toBeNull();

    await view.rerender(
      <DateField label="Free trial ends" value="2026-12-01" optional onChange={onChange} />
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Clear free trial ends' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
