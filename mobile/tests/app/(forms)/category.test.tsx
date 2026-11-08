import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import CategoryScreen from '@/app/(forms)/category';
import { ApiError } from '@/lib/api-error';
import { api, resetApi, serve } from '../../support/api';
import { category, renderScreen } from '../../support/app';
import { resetRouter, router, setParams } from '../../support/router';

jest.mock('expo-router', () => jest.requireActual('../../support/router').expoRouter);
jest.mock('@/lib/api-client', () => jest.requireActual('../../support/api').apiClient);

const FOOD = category('food', 'Food', { icon: 'food' });

beforeEach(() => {
  resetApi();
  resetRouter();
  serve({ '/finance/categories': [FOOD] });
});

describe('New category', () => {
  it('asks for a name before sending anything', async () => {
    await renderScreen(<CategoryScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Add category' }));

    expect(screen.getByText('Enter a name for the category.')).toBeOnTheScreen();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('creates it with the symbol and colour picked', async () => {
    await renderScreen(<CategoryScreen />);

    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Coffee');
    expect(screen.getByRole('radio', { name: 'No symbol — show the initial' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Coffee' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Stone' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add category' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/finance/categories', {
        name: 'Coffee',
        colour: '#78716c',
        icon: 'coffee',
      })
    );
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('turns a duplicate name into something the person can act on', async () => {
    api.post.mockRejectedValueOnce(
      new ApiError(409, { code: 'CATEGORY_NAME_TAKEN', message: 'Taken.' })
    );
    await renderScreen(<CategoryScreen />);

    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Food');
    await fireEvent.press(screen.getByRole('button', { name: 'Add category' }));

    expect(
      await screen.findByText('You already have a category with that name.')
    ).toBeOnTheScreen();
  });
});

describe('Edit category', () => {
  it('starts on what it had and renames it without touching the symbol', async () => {
    setParams({ id: 'food' });
    await renderScreen(<CategoryScreen />);

    expect(await screen.findByDisplayValue('Food')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Food' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Green' })).toBeChecked();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Eating out');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/finance/categories/food', {
        name: 'Eating out',
        colour: '#22c55e',
      })
    );
  });

  it('keeps a colour picked on the web that isn’t on the phone’s palette', async () => {
    serve({ '/finance/categories': [{ ...FOOD, colour: '#123456' }] });
    setParams({ id: 'food' });
    await renderScreen(<CategoryScreen />);

    expect(await screen.findByRole('radio', { name: 'Current colour' })).toBeChecked();
  });

  it('deletes only after a dialog that says what happens to its expenses', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    setParams({ id: 'food' });
    await renderScreen(<CategoryScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete category' }));
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Delete Food?');
    expect(message).toMatch(/expenses become uncategorised/);

    await buttons?.[1].onPress?.();
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/finance/categories/food'));
  });
});
