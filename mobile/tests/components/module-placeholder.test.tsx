import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { ModulePlaceholder } from '@/components/module-placeholder';
import { WEB_APP_URL } from '@/config';
import { moduleFor } from '@/navigation/modules';

import { Themed } from '../support/themed';

describe('ModulePlaceholder', () => {
  it('says when an unbuilt module lands and lists what it will do', async () => {
    await render(<ModulePlaceholder module={moduleFor('fitness')} />, { wrapper: Themed });

    expect(screen.getByText('Coming in v0.2')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Fitness is on its way' })).toBeOnTheScreen();
    expect(screen.getByText('Daily steps, counted by your phone')).toBeOnTheScreen();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('opens a module that is built on the web, at its own page', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<ModulePlaceholder module={moduleFor('finance')} />, { wrapper: Themed });

    expect(screen.getByText('On the web now')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: /Open Finance on the web/ }));

    expect(open).toHaveBeenCalledWith(`${WEB_APP_URL}/finance`);
  });
});
