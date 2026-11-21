import { isXiaomi, setupGuide } from '@/lib/notifications/background-setup';

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

describe('setupGuide', () => {
  it('names HyperOS’s two switches on a Xiaomi', () => {
    const guide = setupGuide(true);

    expect(guide.steps.map((step) => step.title)).toEqual([
      'Autostart: on',
      'Battery saver: No restrictions',
    ]);
    expect(guide.intro).toMatch(/^HyperOS/);
  });

  it('names only Android’s own battery setting anywhere else, never Autostart or HyperOS', () => {
    const guide = setupGuide(false);

    expect(guide.steps.map((step) => step.title)).toEqual(['Battery: Unrestricted']);
    expect(JSON.stringify(guide)).not.toMatch(/HyperOS|Autostart|Battery saver/);
  });

  it('says on every phone that reminders ring either way', () => {
    for (const guide of [setupGuide(true), setupGuide(false)]) {
      expect(guide.intro).toContain('Reminders ring on time either way');
    }
  });
});
