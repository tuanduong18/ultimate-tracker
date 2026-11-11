import { render, screen } from '@testing-library/react-native';

import { ModulePlaceholder } from '@/components/module-placeholder';
import { moduleFor, type PlaceholderEntry } from '@/navigation/modules';

import { Themed } from '../support/themed';

/** A module the app has no screens for yet — the only kind a placeholder is for. */
function placeholderFor(key: string): PlaceholderEntry {
  const entry = moduleFor(key);
  if (entry.status === 'app') throw new Error(`${key} is in the app`);
  return entry;
}

describe('ModulePlaceholder', () => {
  it('says when an unbuilt module lands and lists what it will do', async () => {
    await render(<ModulePlaceholder module={placeholderFor('fitness')} />, { wrapper: Themed });

    expect(screen.getByText('Coming in v0.2')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Fitness is on its way' })).toBeOnTheScreen();
    expect(screen.getByText('Daily steps, counted by your phone')).toBeOnTheScreen();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
