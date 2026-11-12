import { NextResponse, type NextRequest } from 'next/server';

/**
 * The Content-Security-Policy, with a fresh nonce for every page.
 *
 * Why a nonce and not the simpler policy in next.config: the session lives in
 * localStorage, where any script on the page can read it, so the policy's job
 * is to stop a script that got into the page from running at all. The
 * nonce-free policy has to allow `'unsafe-inline'` scripts, which lets exactly
 * that kind of script run. With a nonce, Next stamps its own scripts as it
 * renders (it reads the nonce back out of this header), the root layout stamps
 * the theme script, and `'strict-dynamic'` lets those load the rest of the
 * bundle — anything else is refused.
 *
 * The cost is that every page renders on request instead of being prebuilt
 * (a nonce must differ per response). The pages are thin client shells and
 * the users a handful of people, so that is one small server render per page
 * load — a fair price for closing the hole the alternative leaves.
 *
 * `connect-src` lists the only places the page talks to: this site, the API,
 * and Supabase (HTTPS for auth, WSS for the notification bell's live updates).
 * Even a script that ran could not post a stolen token anywhere else by fetch.
 * Styles keep `'unsafe-inline'`: React writes style attributes for chart and
 * category colours, and CSS cannot run code.
 */
function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development';
  const supabase = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const api = originOf(process.env.NEXT_PUBLIC_API_BASE_URL);
  const connect = ["'self'", supabase, supabase?.replace(/^http/, 'ws'), api].filter(Boolean);

  return [
    "default-src 'self'",
    // React rebuilds server error stacks with eval in development only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy(nonce);

  // On the request so Next can read the nonce while rendering; on the response
  // so the browser enforces it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not built assets, not files (anything with a dot), and not
      // the router's prefetches, which are not documents.
      source: '/((?!_next/static|_next/image|.*\\..*).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
