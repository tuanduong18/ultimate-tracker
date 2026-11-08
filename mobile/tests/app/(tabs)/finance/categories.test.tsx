import { fireEvent, screen } from '@testing-library/react-native';

import Categories from '@/app/(tabs)/finance/categories';
import { resetApi, serve } from '../../../support/api';
import { category, renderScreen } from '../../../support/app';
import { resetRouter, router } from '../../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../../support/api').apiClient);

beforeEach(() => {
  resetApi();
  resetRouter();
});

describe('Categories', () => {
  it('lists the categories in the person’s order and opens one to edit', async () => {
    serve({ '/finance/categories': [category('rent', 'Rent'), category('food', 'Food')] });
    await renderScreen(<Categories />);

    const names = (await screen.findAllByRole('button', { name: /^(Rent|Food)$/ })).map(
      (row) => row.props.accessibilityLabel
    );
    expect(names).toEqual(['Rent', 'Food']);

    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/category', params: { id: 'food' } });
  });

  it('says a budget needs a category first when there are none', async () => {
    serve({ '/finance/categories': [] });
    await renderScreen(<Categories />);

    expect(
      await screen.findByText('No categories yet. Create one before setting a budget.')
    ).toBeOnTheScreen();
  });

  it('adds one from the floating button', async () => {
    serve({ '/finance/categories': [] });
    await renderScreen(<Categories />);

    await fireEvent.press(screen.getByRole('button', { name: 'New category' }));
    expect(router.push).toHaveBeenCalledWith('/category');
  });
});
