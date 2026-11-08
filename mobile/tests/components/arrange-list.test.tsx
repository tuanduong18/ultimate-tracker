import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { ArrangeList, ROW_HEIGHT } from '@/components/arrange-list';
import { Text } from '@/components/text';
import { Themed } from '../support/themed';

const ROWS = [
  { id: 'a', name: 'Food' },
  { id: 'b', name: 'Rent' },
  { id: 'c', name: 'Travel' },
];

async function renderList(onMove = jest.fn()) {
  await render(
    <ArrangeList
      items={ROWS}
      nameOf={(row) => row.name}
      onMove={onMove}
      renderRow={(row) => <Text>{row.name}</Text>}
    />,
    { wrapper: Themed }
  );
  return onMove;
}

describe('ArrangeList', () => {
  it('moves a row a step with its buttons, for anyone who can’t drag', async () => {
    const onMove = await renderList();

    await fireEvent.press(screen.getByRole('button', { name: 'Move Rent up' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Move Rent down' }));

    expect(onMove.mock.calls).toEqual([
      [1, 0],
      [1, 2],
    ]);
  });

  it('says where a row went, in the web’s words', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderList();

    await fireEvent.press(screen.getByRole('button', { name: 'Move Food down' }));

    expect(announce).toHaveBeenCalledWith('Food moved to 2 of 3.');
  });

  it('can’t move the first row up or the last row down', async () => {
    await renderList();

    expect(screen.getByRole('button', { name: 'Move Food up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Travel down' })).toBeDisabled();
  });

  it('gives every row the 64dp of a row that moves something', () => {
    expect(ROW_HEIGHT).toBe(64);
  });
});
