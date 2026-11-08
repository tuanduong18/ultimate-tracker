import { fireEvent, render, screen } from '@testing-library/react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Themed } from '../support/themed';

describe('the list states', () => {
  it('says it is loading once, rather than reading out grey shapes', async () => {
    await render(<LoadingState rows={4} />, { wrapper: Themed });

    expect(screen.getByLabelText('Loading…')).toBeOnTheScreen();
  });

  it('says why a load failed, and tries again', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState message="Could not load this list." onRetry={onRetry} />, {
      wrapper: Themed,
    });

    expect(screen.getByText('Could not load this list.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('says what goes here and offers the action that fills it', async () => {
    const onPress = jest.fn();
    await render(
      <EmptyState
        icon="receipt_long"
        message="Nothing logged yet."
        action={{ label: 'Add expense', onPress }}
      />,
      { wrapper: Themed }
    );

    expect(screen.getByText('Nothing logged yet.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));
    expect(onPress).toHaveBeenCalled();
  });
});
