// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { proxy } from '@/proxy';

function policyFor(path = '/dashboard') {
  const response = proxy(new NextRequest(`https://app.example${path}`));
  const policy = response.headers.get('Content-Security-Policy') ?? '';
  const directives = Object.fromEntries(
    policy.split('; ').map((part) => {
      const [name, ...values] = part.split(' ');
      return [name, values];
    })
  );
  return { policy, directives };
}

describe('proxy', () => {
  it('runs only scripts that carry this response’s nonce, and what they load', () => {
    const { directives } = policyFor();
    const script = directives['script-src'];

    expect(script).toEqual(expect.arrayContaining(["'self'", "'strict-dynamic'"]));
    expect(script.some((value: string) => /^'nonce-[A-Za-z0-9+/=]+'$/.test(value))).toBe(true);
    expect(script).not.toContain("'unsafe-inline'");
  });

  it('draws a new nonce for every page', () => {
    expect(policyFor().policy).not.toBe(policyFor().policy);
  });

  it('lets the page talk only to itself, the API and Supabase', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example/');

    expect(policyFor().directives['connect-src']).toEqual([
      "'self'",
      'https://project.supabase.co',
      'wss://project.supabase.co',
      'https://api.example',
    ]);
    vi.unstubAllEnvs();
  });

  it('refuses framing, plugins and a rewritten base address', () => {
    const { directives } = policyFor();

    expect(directives['frame-ancestors']).toEqual(["'none'"]);
    expect(directives['object-src']).toEqual(["'none'"]);
    expect(directives['base-uri']).toEqual(["'self'"]);
  });
});
