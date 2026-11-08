import { fireEvent, render, screen } from '@testing-library/react-native';

import { RangeControl } from '@/components/finance/range-control';
import { monthRange, weekRange } from '@/lib/dates';
import { ALL_CATEGORIES } from '@/lib/finance/categories';
import { Themed } from '../../support/themed';

const OCTOBER = { start: '2026-10-01', end: '2026-10-31' };

async function renderControl(range = OCTOBER, onRange = jest.fn()) {
  await render(
    <RangeControl
      range={range}
      onRange={onRange}
      selection={ALL_CATEGORIES}
      onSelection={jest.fn()}
      categories={[]}
    />,
    { wrapper: Themed }
  );
  return onRange;
}

describe('RangeControl', () => {
  it('steps a whole month as a month', async () => {
    const onRange = await renderControl();

    await fireEvent.press(screen.getByRole('button', { name: 'Previous period' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next period' }));

    expect(onRange.mock.calls).toEqual([
      [{ start: '2026-09-01', end: '2026-09-30' }],
      [{ start: '2026-11-01', end: '2026-11-30' }],
    ]);
  });

  it('jumps to this week or this month, and reads a calendar month as one', async () => {
    const onRange = await renderControl();

    expect(screen.getByRole('button', { name: 'Period: This month' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Period: This week' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Period: This month' }));

    expect(onRange.mock.calls).toEqual([[weekRange()], [monthRange()]]);
  });

  it('says when the categories are narrowed', async () => {
    await renderControl();
    expect(screen.getByRole('button', { name: 'Categories: All categories' })).toBeOnTheScreen();
  });
});
