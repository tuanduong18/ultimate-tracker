import { isXiaomi } from '@/lib/notifications/background-setup';

describe('isXiaomi', () => {
  it.each([
    { Brand: 'Redmi', Manufacturer: 'Xiaomi' },
    { Brand: 'xiaomi' },
    { Brand: 'POCO', Manufacturer: 'Xiaomi' },
  ])('knows Xiaomi’s phones, whatever the brand on them: %o', (constants) => {
    expect(isXiaomi(constants)).toBe(true);
  });

  it.each([{ Brand: 'samsung', Manufacturer: 'samsung' }, { Brand: 'google' }, {}])(
    'leaves other phones alone: %o',
    (constants) => {
      expect(isXiaomi(constants)).toBe(false);
    }
  );
});
