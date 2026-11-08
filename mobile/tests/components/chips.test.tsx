import { fireEvent, render, screen } from '@testing-library/react-native';

import { CheckChips, ChoiceChips } from '@/components/chips';
import { Themed } from '../support/themed';

const OPTIONS = [
  { value: 'day', label: 'Days' },
  { value: 'month', label: 'Months' },
  { value: 'year', label: 'Years', accessibilityLabel: 'Every year' },
];

describe('ChoiceChips', () => {
  it('labels the group and marks the one chosen, by state as well as by look', async () => {
    await render(
      <ChoiceChips label="Unit" options={OPTIONS} selected="month" onSelect={jest.fn()} />,
      {
        wrapper: Themed,
      }
    );

    expect(screen.getByText('Unit')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Months' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Days' })).not.toBeChecked();
    // A chip can say more to TalkBack than its short visible word.
    expect(screen.getByRole('radio', { name: 'Every year' })).toBeOnTheScreen();
  });

  it('hands back the value tapped', async () => {
    const onSelect = jest.fn();
    await render(
      <ChoiceChips label="Unit" options={OPTIONS} selected="month" onSelect={onSelect} />,
      {
        wrapper: Themed,
      }
    );

    await fireEvent.press(screen.getByRole('radio', { name: 'Days' }));

    expect(onSelect).toHaveBeenCalledWith('day');
  });
});

describe('CheckChips', () => {
  it('marks every chosen chip as a checked box and toggles the one tapped', async () => {
    const onToggle = jest.fn();
    await render(
      <CheckChips label="Units" options={OPTIONS} selected={['day', 'year']} onToggle={onToggle} />,
      { wrapper: Themed }
    );

    expect(screen.getByRole('checkbox', { name: 'Days' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Months' })).not.toBeChecked();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Days' }));
    expect(onToggle).toHaveBeenCalledWith('day');
  });
});
