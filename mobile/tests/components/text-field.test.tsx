import { render, screen } from '@testing-library/react-native';

import { TextField } from '@/components/text-field';
import { Themed } from '../support/themed';

describe('TextField kinds', () => {
  it('opens the number pad with a decimal point for an amount, in steady-width figures', async () => {
    await render(<TextField label="Amount" kind="amount" value="" onChangeText={jest.fn()} />, {
      wrapper: Themed,
    });
    const field = screen.getByLabelText('Amount');

    expect(field).toHaveProp('keyboardType', 'decimal-pad');
    expect(field).toHaveStyle({ fontVariant: ['tabular-nums'] });
    // An amount is not a word: no autofill, no corrections.
    expect(field).toHaveProp('importantForAutofill', 'no');
    expect(field).toHaveProp('autoCorrect', false);
  });

  it('lets free text take the phone’s capitals and corrections', async () => {
    await render(<TextField label="Description" kind="text" value="" onChangeText={jest.fn()} />, {
      wrapper: Themed,
    });
    const field = screen.getByLabelText('Description');

    expect(field).toHaveProp('autoCapitalize', 'sentences');
    expect(field).toHaveProp('autoCorrect', true);
    expect(field).toHaveProp('secureTextEntry', false);
  });

  it('keeps the sign-in kinds exact, with passwords hidden', async () => {
    await render(
      <TextField label="Password" kind="current-password" value="" onChangeText={jest.fn()} />,
      { wrapper: Themed }
    );
    const field = screen.getByLabelText('Password');

    expect(field).toHaveProp('secureTextEntry', true);
    expect(field).toHaveProp('autoCapitalize', 'none');
    expect(field).toHaveProp('importantForAutofill', 'yes');
  });
});
