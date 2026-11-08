import { render, screen } from '@testing-library/react-native';

import { CategoryBadge } from '@/components/finance/category-badge';
import { Themed } from '../../support/themed';

// The badge is decorative — hidden from TalkBack, since the row names the category in words — so
// every query here has to look past that.
const hidden = { includeHiddenElements: true };

describe('CategoryBadge', () => {
  it('draws the category’s symbol when it has one this app knows', async () => {
    await render(<CategoryBadge colour="#22c55e" name="Food" icon="food" />, { wrapper: Themed });

    expect(screen.getByTestId('symbol-food', hidden)).toBeOnTheScreen();
    expect(screen.queryByText('F', hidden)).toBeNull();
  });

  it('falls back to the initial for no symbol or a key it has not been taught', async () => {
    const view = await render(<CategoryBadge colour="#22c55e" name="rent" icon={null} />, {
      wrapper: Themed,
    });
    expect(screen.getByText('R', hidden)).toBeOnTheScreen();

    await view.rerender(<CategoryBadge colour="#22c55e" name="Car wash" icon="car-wash" />);
    expect(screen.getByText('C', hidden)).toBeOnTheScreen();
  });

  it('inks the initial in white or black, whichever reads on the category’s colour', async () => {
    const view = await render(<CategoryBadge colour="#1e3a8a" name="Navy" />, { wrapper: Themed });
    expect(screen.getByText('N', hidden)).toHaveStyle({ color: '#ffffff' });

    await view.rerender(<CategoryBadge colour="#facc15" name="Yellow" />);
    expect(screen.getByText('Y', hidden)).toHaveStyle({ color: '#000000' });
  });
});
