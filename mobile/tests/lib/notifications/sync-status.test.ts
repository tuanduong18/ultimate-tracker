import { describeSync } from '@/lib/notifications/sync-status';

const NOW = new Date(2026, 10, 14, 15, 0);
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).toISOString();

describe('describeSync', () => {
  it('says when this phone has never synced', () => {
    expect(describeSync(null, NOW)).toEqual({
      text: 'Not synced yet on this phone.',
      behind: false,
    });
  });

  it('gives the time of a recent sync, and nothing to worry about', () => {
    const lastSync = { at: at(14, 14, 32), ok: true, okAt: at(14, 14, 32) };

    expect(describeSync(lastSync, NOW)).toEqual({
      text: 'Last synced today at 14:32.',
      behind: false,
    });
  });

  it('calls a sync over three hours old behind', () => {
    const lastSync = { at: at(13, 20, 5), ok: true, okAt: at(13, 20, 5) };

    expect(describeSync(lastSync, NOW)).toEqual({
      text: 'Last synced yesterday at 20:05.',
      behind: true,
    });
  });

  it('says a failed sync failed, and when one last worked', () => {
    const lastSync = { at: at(14, 14, 50), ok: false, okAt: at(14, 14, 0) };

    expect(describeSync(lastSync, NOW).text).toBe(
      'Couldn’t reach the server today at 14:50. Last synced today at 14:00.'
    );
  });

  it('dates an older sync', () => {
    const lastSync = { at: at(10, 9, 0), ok: true, okAt: at(10, 9, 0) };

    expect(describeSync(lastSync, NOW).text).toMatch(/^Last synced on .+ at 09:00\.$/);
  });
});
