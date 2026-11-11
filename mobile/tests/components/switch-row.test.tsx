import { fireEvent, render, screen } from '@testing-library/react-native';

import { SwitchRow } from '@/components/switch-row';
import { Themed } from '../support/themed';

describe('SwitchRow', () => {
  it('is one switch to TalkBack, with its state, and the whole row flips it', async () => {
    const onChange = jest.fn();
    await render(
      <SwitchRow
        label="Also import 2 rows"
        description="Left out unless you turn this on."
        value={false}
        onChange={onChange}
      />,
      { wrapper: Themed }
    );

    const row = screen.getByRole('switch', { name: 'Also import 2 rows' });
    expect(row).not.toBeChecked();

    await fireEvent.press(row);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
