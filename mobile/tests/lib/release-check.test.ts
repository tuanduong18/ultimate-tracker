import {
  compareVersions,
  findNewestRelease,
  laterThan,
  newestRelease,
  type GitHubRelease,
} from '@/lib/release-check';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void mockStore.set(key, value),
}));

const release = (tag: string, overrides: Partial<GitHubRelease> = {}): GitHubRelease => ({
  tag_name: tag,
  html_url: `https://github.com/example/releases/tag/${tag}`,
  draft: false,
  prerelease: false,
  ...overrides,
});

describe('which release to offer', () => {
  it('compares versions as numbers, not text', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('0.2.0', '0.2.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
  });

  it('takes the newest published APK release', () => {
    const newest = newestRelease([release('android-v0.2.0'), release('android-v0.3.1')]);

    expect(newest).toEqual({
      version: '0.3.1',
      url: 'https://github.com/example/releases/tag/android-v0.3.1',
    });
  });

  it('ignores drafts, pre-releases and tags that are not an APK’s', () => {
    const newest = newestRelease([
      release('android-v0.2.0'),
      release('android-v0.4.0', { draft: true }),
      release('android-v0.5.0', { prerelease: true }),
      release('v0.9.0'),
      release('android-v1.0'),
    ]);

    expect(newest?.version).toBe('0.2.0');
  });

  it('offers it only when it is newer than the app running', () => {
    const newest = { version: '0.2.0', url: 'u' };

    expect(laterThan(newest, '0.1.0')).toBe(newest);
    expect(laterThan(newest, '0.2.0')).toBeNull();
    expect(laterThan(null, '0.1.0')).toBeNull();
  });
});

describe('findNewestRelease', () => {
  const NOW = new Date('2026-11-14T10:00:00Z');
  const fetchMock = jest.fn();

  beforeEach(() => {
    mockStore.clear();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('asks GitHub at most once a day', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [release('android-v0.2.0')] });

    await findNewestRelease(NOW);
    const later = await findNewestRelease(new Date('2026-11-14T20:00:00Z'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(later?.version).toBe('0.2.0');
  });

  it('asks again the next day', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

    await findNewestRelease(NOW);
    await findNewestRelease(new Date('2026-11-15T10:30:00Z'));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('is quiet offline or rate-limited', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network request failed'));
    expect(await findNewestRelease(NOW)).toBeNull();

    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    expect(await findNewestRelease(NOW)).toBeNull();
  });
});
