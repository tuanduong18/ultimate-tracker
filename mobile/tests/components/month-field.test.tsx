import { fireEvent, render, screen } from '@testing-library/react-native';

import { MonthField } from '@/components/month-field';
import { Themed } from '../support/themed';

describe('MonthField', () => {
  it('steps a month back and forward with the buttons, across a year', async () => {
    const onChange = jest.fn();
    await render(<MonthField label="First month" value="2026-12-01" onChange={onChange} />, {
      wrapper: Themed,
    });

    await fireEvent.press(screen.getByRole('button', { name: 'First month: next month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'First month: previous month' }));

    expect(onChange.mock.calls).toEqual([['2027-01-01'], ['2026-11-01']]);
  });

  it('is adjustable for TalkBack: swiping up and down changes the month', async () => {
    const onChange = jest.fn();
    await render(<MonthField label="First month" value="2026-12-01" onChange={onChange} />, {
      wrapper: Themed,
    });
    const month = screen.getByRole('adjustable', { name: 'First month' });

    await fireEvent(month, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await fireEvent(month, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });

    expect(onChange.mock.calls).toEqual([['2027-01-01'], ['2026-11-01']]);
  });

  it('leaves an optional month empty until set, from where it should start', async () => {
    const onChange = jest.fn();
    await render(
      <MonthField
        label="Last month"
        value=""
        optional
        emptyLabel="Ongoing"
        setLabel="Set a last month"
        startFrom="2026-11-01"
        onChange={onChange}
      />,
      { wrapper: Themed }
    );

    expect(screen.getByText('Ongoing')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Set a last month' }));
    expect(onChange).toHaveBeenCalledWith('2026-11-01');
  });
});
