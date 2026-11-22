import { fireEvent, render, screen } from '@testing-library/react-native';

import { CategorySelectionChips } from '@/components/finance/category-selection';
import { ALL_CATEGORIES, type CategorySelection } from '@/lib/finance/categories';
import { category } from '../../support/app';
import { Themed } from '../../support/themed';

const CATEGORIES = [category('food', 'Food'), category('rent', 'Rent')];

async function renderSheet(selection: CategorySelection, hidden: string[] = []) {
  const defaults = { hidden, onReset: jest.fn(), onSave: jest.fn().mockResolvedValue(undefined) };
  await render(
    <CategorySelectionChips
      selection={selection}
      onChange={jest.fn()}
      categories={CATEGORIES}
      defaults={defaults}
    />,
    { wrapper: Themed }
  );
  return defaults;
}

describe('CategorySelectionChips on the charts', () => {
  it('says the charts start with every category, and offers no save until a chip changes', async () => {
    await renderSheet(ALL_CATEGORIES);

    expect(screen.getByText('Charts start with every category.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Save as default/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Reset/ })).toBeNull();
  });

  it('saves what the chips leave out as the list every chart starts without', async () => {
    const defaults = await renderSheet({ ids: ['food'], uncategorized: true });

    await fireEvent.press(screen.getByRole('button', { name: /^Save as default/ }));

    expect(defaults.onSave).toHaveBeenCalledWith(['rent']);
  });

  it('names what is saved, and resets to it after a look at everything', async () => {
    const defaults = await renderSheet(ALL_CATEGORIES, ['rent']);

    expect(screen.getByText('Charts start without Rent.')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Reset to the categories the charts start with' })
    );
    expect(defaults.onReset).toHaveBeenCalled();
  });

  it('offers neither while the chips are the saved list', async () => {
    await renderSheet({ ids: ['food'], uncategorized: true }, ['rent']);

    expect(screen.queryByRole('button', { name: /^Save as default/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Reset/ })).toBeNull();
  });

  it('will not save a list that hides every category', async () => {
    await renderSheet({ ids: [], uncategorized: false });

    expect(screen.queryByRole('button', { name: /^Save as default/ })).toBeNull();
  });

  it('says why a save failed, under the button', async () => {
    const defaults = await renderSheet({ ids: ['food'], uncategorized: true });
    defaults.onSave.mockRejectedValue(new Error('offline'));

    await fireEvent.press(screen.getByRole('button', { name: /^Save as default/ }));

    expect(await screen.findByText('Could not save that.')).toBeOnTheScreen();
  });
});
