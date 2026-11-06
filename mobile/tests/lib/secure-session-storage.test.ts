import { CHUNK_BYTES, secureSessionStorage, splitByBytes } from '@/lib/secure-session-storage';

// SecureStore as an in-memory map that, like the real one, refuses values over 2048 bytes.
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (new TextEncoder().encode(value).length > 2048) throw new Error(`${key} is over 2048 bytes`);
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

const bytes = (value: string) => new TextEncoder().encode(value).length;

beforeEach(() => mockStore.clear());

describe('splitByBytes', () => {
  it('keeps a short value whole', () => {
    expect(splitByBytes('abc')).toEqual(['abc']);
  });

  it('measures in UTF-8 bytes, so multi-byte text makes more, smaller chunks', () => {
    const name = 'Nguyễn Tuấn Dương '.repeat(200); // Vietnamese letters are 2–3 bytes each
    const chunks = splitByBytes(name);
    expect(chunks.join('')).toBe(name);
    for (const chunk of chunks) expect(bytes(chunk)).toBeLessThanOrEqual(CHUNK_BYTES);
  });

  it('never cuts an emoji (a surrogate pair) in half', () => {
    const value = '😀'.repeat(1000); // 4 bytes each
    const chunks = splitByBytes(value, 10);
    for (const chunk of chunks) expect([...chunk].every((char) => char === '😀')).toBe(true);
    expect(chunks.join('')).toBe(value);
  });
});

describe('secureSessionStorage', () => {
  const key = 'sb-project-auth-token';
  const session = JSON.stringify({ access_token: 'a'.repeat(1500), user: { name: 'Dương' } });

  it('round-trips a session bigger than one SecureStore value', async () => {
    const big = session.repeat(3);
    await secureSessionStorage.setItem(key, big);
    expect(await secureSessionStorage.getItem(key)).toBe(big);
    expect(Number(mockStore.get(`${key}.count`))).toBeGreaterThan(1);
  });

  it('removes the chunks a shorter value no longer needs', async () => {
    await secureSessionStorage.setItem(key, session.repeat(4));
    await secureSessionStorage.setItem(key, 'short');
    expect(await secureSessionStorage.getItem(key)).toBe('short');
    expect([...mockStore.keys()].sort()).toEqual([`${key}.0`, `${key}.count`]);
  });

  it('removes every chunk and the count', async () => {
    await secureSessionStorage.setItem(key, session.repeat(3));
    await secureSessionStorage.removeItem(key);
    expect(mockStore.size).toBe(0);
    expect(await secureSessionStorage.getItem(key)).toBeNull();
  });

  it('reports no session rather than half of one when a chunk is missing', async () => {
    await secureSessionStorage.setItem(key, session.repeat(3));
    mockStore.delete(`${key}.1`);
    expect(await secureSessionStorage.getItem(key)).toBeNull();
  });

  it('runs operations on one key in order, so a save and a removal never interleave', async () => {
    const save = secureSessionStorage.setItem(key, session.repeat(3));
    const remove = secureSessionStorage.removeItem(key);
    await Promise.all([save, remove]);
    expect(mockStore.size).toBe(0);
  });
});
