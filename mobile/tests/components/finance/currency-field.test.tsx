import { fireEvent, render, screen } from '@testing-library/react-native';

import { CurrencyField } from '@/components/finance/currency-field';
import { Themed } from '../../support/themed';

const CURRENCIES = ['EUR', 'SGD', 'USD', 'VND'];

describe('CurrencyField', () => {
  it('opens the list with the current currency first, and picks one', async () => {
    const onChange = jest.fn();
    await render(<CurrencyField value="SGD" onChange={onChange} currencies={CURRENCIES} />, {
      wrapper: Themed,
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Currency, SGD' }));
    const codes = screen.getAllByRole('radio').map((row) => row.props.accessibilityLabel);
    expect(codes).toEqual(['SGD', 'EUR', 'USD', 'VND']);
    expect(screen.getByRole('radio', { name: 'SGD' })).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: 'VND' }));
    expect(onChange).toHaveBeenCalledWith('VND');
  });

  it('narrows the list as the person types, and says when nothing matches', async () => {
    await render(<CurrencyField value="SGD" onChange={jest.fn()} currencies={CURRENCIES} />, {
      wrapper: Themed,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Currency, SGD' }));

    await fireEvent.changeText(screen.getByLabelText('Search currencies'), 'us');
    expect(screen.getAllByRole('radio').map((row) => row.props.accessibilityLabel)).toContain(
      'USD'
    );
    expect(screen.queryByRole('radio', { name: 'EUR' })).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Search currencies'), 'zzz');
    expect(screen.getByText('No currency matches “zzz”.')).toBeOnTheScreen();
  });

  it('keeps a currency the list no longer has, so an old entry never changes by itself', async () => {
    await render(<CurrencyField value="XAU" onChange={jest.fn()} currencies={CURRENCIES} />, {
      wrapper: Themed,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Currency, XAU' }));

    expect(screen.getByRole('radio', { name: 'XAU' })).toBeChecked();
  });

  it('lets the code be typed when the list could not load, as the web does', async () => {
    const onChange = jest.fn();
    await render(<CurrencyField value="" onChange={onChange} currencies={[]} />, {
      wrapper: Themed,
    });

    await fireEvent.changeText(screen.getByLabelText('Currency'), 'sgd');
    expect(onChange).toHaveBeenCalledWith('SGD');
  });
});
