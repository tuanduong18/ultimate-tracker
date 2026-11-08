import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import ArrangeCategories from '@/app/(forms)/arrange-categories';
import { api, resetApi, serve } from '../../support/api';
import { category, renderScreen } from '../../support/app';
import { resetRouter, router } from '../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../support/api').apiClient);

beforeEach(() => {
  resetApi();
  resetRouter();
  serve({
    '/finance/categories': [
      category('food', 'Food'),
      category('rent', 'Rent'),
      category('fun', 'Fun'),
    ],
  });
});

describe('Arrange categories', () => {
  it('saves the whole new order in one request', async () => {
    await renderScreen(<ArrangeCategories />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Move Fun up' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Move Fun up' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save order' }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/finance/categories/order', {
        ids: ['fun', 'food', 'rent'],
      })
    );
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('just closes when nothing moved, with nothing to send', async () => {
    await renderScreen(<ArrangeCategories />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Save order' }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(api.put).not.toHaveBeenCalled();
  });
});
