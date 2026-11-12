/**
 * Where to go after logging in: a page of this app, and never anywhere else.
 *
 * `next` arrives in the address bar, so anyone can write it, and a link to
 * `/login?next=…` is exactly how a phishing page would borrow this app's real
 * log-in screen and then land the person on its own copy of the app. Checking
 * the first characters of the string was not enough: browsers read
 * `/\evil.example` and `/<tab>/evil.example` as another site, though both start
 * with a single slash. So the value is resolved the way the browser will
 * resolve it, only a result on this origin survives, and the *resolved* path is
 * what is returned — what was checked is what gets followed.
 */

export const DEFAULT_NEXT = '/dashboard';

// Any origin of our own would do; `.invalid` can never be a real host (RFC 2606).
const BASE = 'https://ultimate-tracker.invalid';

export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/')) return DEFAULT_NEXT;

  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return DEFAULT_NEXT;
  }
  if (url.origin !== BASE) return DEFAULT_NEXT;

  const path = `${url.pathname}${url.search}${url.hash}`;
  // "/.//evil.example" resolves on this origin to the path "//evil.example",
  // which the router would then follow as a link to another site.
  return path.startsWith('//') ? DEFAULT_NEXT : path;
}
