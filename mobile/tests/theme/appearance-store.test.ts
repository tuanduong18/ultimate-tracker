import { loadAppearance, MODE_KEY, saveAppearance, THEME_KEY } from '@/theme/appearance-store';

const mockStore = new Map<string, string>();
const mockFail = { read: false, write: false };
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => {
    if (mockFail.read) throw new Error('keystore unavailable');
    return mockStore.get(key) ?? null;
  }),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (mockFail.write) throw new Error('keystore unavailable');
    mockStore.set(key, value);
  }),
}));

beforeEach(() => {
  mockStore.clear();
  mockFail.read = false;
  mockFail.write = false;
});

describe('loadAppearance', () => {
  it('starts on Blue and Match system before anything is chosen', async () => {
    await expect(loadAppearance()).resolves.toEqual({ theme: 'pastel-blue', mode: 'system' });
  });

  it('reads back what was chosen', async () => {
    mockStore.set(THEME_KEY, 'pastel-rose');
    mockStore.set(MODE_KEY, 'dark');
    await expect(loadAppearance()).resolves.toEqual({ theme: 'pastel-rose', mode: 'dark' });
  });

  it('falls back to the defaults for a value it no longer knows', async () => {
    mockStore.set(THEME_KEY, 'pastel-retired');
    mockStore.set(MODE_KEY, 'dim');
    await expect(loadAppearance()).resolves.toEqual({ theme: 'pastel-blue', mode: 'system' });
  });

  it('falls back to the defaults when storage can’t be read', async () => {
    mockFail.read = true;
    await expect(loadAppearance()).resolves.toEqual({ theme: 'pastel-blue', mode: 'system' });
  });
});

describe('saveAppearance', () => {
  it('stores both halves under keys SecureStore accepts', async () => {
    await saveAppearance({ theme: 'slate', mode: 'light' });
    expect(mockStore.get(THEME_KEY)).toBe('slate');
    expect(mockStore.get(MODE_KEY)).toBe('light');
    for (const key of [THEME_KEY, MODE_KEY]) expect(key).toMatch(/^[\w.-]+$/);
  });

  it('never throws: the choice already applied, so failing to remember it stays quiet', async () => {
    mockFail.write = true;
    await expect(saveAppearance({ theme: 'slate', mode: 'light' })).resolves.toBeUndefined();
  });
});
