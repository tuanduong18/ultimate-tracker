/**
 * Headers every response gets, files included. The Content-Security-Policy is
 * not here: it carries a per-request nonce, so proxy.ts sets it on each page.
 * HSTS is not here either — Vercel already sends it for the whole domain.
 *
 * - nosniff: a file is only ever run as the type the server says it is.
 * - X-Frame-Options: no other site may frame these pages to trick a click.
 *   The CSP's frame-ancestors says the same to newer browsers; this is for
 *   the rest, and for files the proxy does not touch.
 * - Referrer-Policy: other sites learn which site a request came from, never
 *   which page — no path, no query.
 * - Permissions-Policy: the app uses none of these, so nothing that gets into
 *   a page can ask for them either.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
