import { fireEvent, render, screen } from '@testing-library/react-native';

import { LogButton } from '@/components/log-button';
import { resetRouter, router } from '../support/router';
import { Themed } from '../support/themed';

jest.mock('expo-router', () => jest.requireActual('../support/router').expoRouter);

beforeEach(() => resetRouter());

describe('LogButton', () => {
  it('opens a sheet of what can be logged, and each row opens its form', async () => {
    await render(<LogButton />, { wrapper: Themed });

    await fireEvent.press(screen.getByRole('button', { name: 'Log something' }));
    expect(screen.getByRole('header', { name: 'Log' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Expense/ }));
    expect(router.push).toHaveBeenCalledWith('/expense');
  });
});
