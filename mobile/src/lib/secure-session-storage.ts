import * as SecureStore from 'expo-secure-store';

/**
 * Where Supabase keeps the session on the phone: Android's encrypted storage, never plain
 * AsyncStorage, because the refresh token in it is as good as a password.
 *
 * SecureStore takes values up to 2048 bytes, and a Supabase session is around 2.1 KB — more
 * with a Google profile in it. So a value is split into chunks, each well under the limit,
 * under `<key>.0`, `<key>.1`… with the count in `<key>.count`. Supabase's own guide instead
 * encrypts the session with a key kept in SecureStore and puts the ciphertext in
 * AsyncStorage; chunking does the same job with no crypto library and no second store.
 *
 * Chunks are measured in UTF-8 bytes, not characters: a display name with Vietnamese
 * diacritics (three bytes a letter) would otherwise overflow a chunk that "looks" small.
 */

/** Bytes per chunk, with room to spare under SecureStore's 2048. */
export const CHUNK_BYTES = 1800;

function utf8Bytes(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** Split a string into pieces of at most `maxBytes` UTF-8 bytes, never inside a character. */
export function splitByBytes(value: string, maxBytes = CHUNK_BYTES): string[] {
  const chunks: string[] = [];
  let current = '';
  let size = 0;
  // `for…of` walks code points, so a surrogate pair (an emoji) is never cut in half.
  for (const char of value) {
    const bytes = utf8Bytes(char.codePointAt(0) ?? 0);
    if (size + bytes > maxBytes && current) {
      chunks.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  chunks.push(current);
  return chunks;
}

const countKey = (key: string) => `${key}.count`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function storedCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(countKey(key));
  const count = Number(raw);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

// Operations on one key run one after another: a refresh that saves while a sign-out removes
// would otherwise interleave their chunk writes and leave a session stitched from two.
const queues = new Map<string, Promise<unknown>>();

function serial<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(run, run);
  queues.set(
    key,
    next.catch(() => undefined)
  );
  return next;
}

export const secureSessionStorage = {
  getItem(key: string): Promise<string | null> {
    return serial(key, async () => {
      const count = await storedCount(key);
      if (count === 0) return null;
      const parts = await Promise.all(
        Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index)))
      );
      // A missing chunk means a write was cut short: report no session rather than half of one.
      if (parts.some((part) => part === null)) return null;
      return parts.join('');
    });
  },

  setItem(key: string, value: string): Promise<void> {
    return serial(key, async () => {
      const previous = await storedCount(key);
      const chunks = splitByBytes(value);
      for (const [index, chunk] of chunks.entries()) {
        await SecureStore.setItemAsync(chunkKey(key, index), chunk);
      }
      // The count goes last, so a reader never sees a count that promises chunks not yet written.
      await SecureStore.setItemAsync(countKey(key), String(chunks.length));
      for (let index = chunks.length; index < previous; index += 1) {
        await SecureStore.deleteItemAsync(chunkKey(key, index));
      }
    });
  },

  removeItem(key: string): Promise<void> {
    return serial(key, async () => {
      const count = await storedCount(key);
      await SecureStore.deleteItemAsync(countKey(key));
      for (let index = 0; index < count; index += 1) {
        await SecureStore.deleteItemAsync(chunkKey(key, index));
      }
    });
  },
};
