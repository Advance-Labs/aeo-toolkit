import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as OAuthModule from '@/lib/oauth';

/**
 * Stand-in for `NextResponse.redirect` that records the Location and every cookie write, so the
 * route can be unit-tested without Next's server runtime.
 */
interface FakeRedirect {
  status: number;
  location: string;
  cookies: { set: (name: string, value: string, opts: { maxAge?: number }) => void };
  written: Map<string, { value: string; maxAge?: number }>;
}

vi.mock('next/server', () => ({
  NextResponse: {
    redirect(url: string | URL): FakeRedirect {
      const written = new Map<string, { value: string; maxAge?: number }>();
      return {
        status: 307,
        location: String(url),
        written,
        cookies: { set: (name, value, opts) => written.set(name, { value, maxAge: opts.maxAge }) },
      };
    },
  },
}));

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    }),
}));

const exchangeCode = vi.fn();
vi.mock('@/lib/oauth', async (importOriginal) => ({
  ...(await importOriginal<typeof OAuthModule>()),
  createOAuth: () => ({ exchangeCode }),
}));

const storeSet = vi.fn();
vi.mock('@/lib/token-store', () => ({ getTokenStore: () => ({ set: storeSet }) }));

const { GET } = await import('./route.js');
const { STATE_COOKIE, USER_COOKIE } = await import('@/lib/oauth');
const { RETURN_COOKIE } = await import('@/lib/oauth-return');

const ORIGIN = 'https://console.test';

async function callback(query: string): Promise<FakeRedirect> {
  const req = new Request(`${ORIGIN}/api/auth/google/callback?${query}`);
  return (await GET(req as never)) as unknown as FakeRedirect;
}

describe('GET /api/auth/google/callback', () => {
  beforeEach(() => {
    jar.clear();
    exchangeCode.mockReset();
    storeSet.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    jar.set(STATE_COOKIE, 'nonce');
    jar.set(USER_COOKIE, 'user-1');
    jar.set(RETURN_COOKIE, `${ORIGIN}/tools/chat`);
  });

  it('returns to the chat tool, not the landing page, once connected', async () => {
    exchangeCode.mockResolvedValue({ accessToken: 'a', expiresAt: 1 });
    const res = await callback('code=c&state=nonce');
    expect(res.location).toBe(`${ORIGIN}/tools/chat?connected=1`);
    expect(storeSet).toHaveBeenCalledWith('user-1', { accessToken: 'a', expiresAt: 1 });
  });

  it('returns to the chat tool with the reason when state does not match', async () => {
    const res = await callback('code=c&state=forged');
    expect(res.location).toBe(`${ORIGIN}/tools/chat?error=state_mismatch`);
    expect(exchangeCode).not.toHaveBeenCalled();
  });

  it('reports a failed exchange instead of pretending to connect', async () => {
    exchangeCode.mockRejectedValue(new Error('invalid_grant'));
    const res = await callback('code=c&state=nonce');
    expect(res.location).toBe(`${ORIGIN}/tools/chat?error=exchange_failed`);
    expect(storeSet).not.toHaveBeenCalled();
  });

  it("logs Google's error code so a bad client secret is distinguishable", async () => {
    const { GoogleApiError } = await import('@advance-labs/google-api');
    exchangeCode.mockRejectedValue(
      new GoogleApiError('Google API request failed: 401 Unauthorized', 401, JSON.stringify({
        error: 'invalid_client',
        error_description: 'Unauthorized',
      })),
    );
    await callback('code=c&state=nonce');
    expect(console.error).toHaveBeenCalledWith(
      '[oauth] token exchange failed: 401 invalid_client (Unauthorized)',
    );
  });

  it('passes through a plain Google error code but not arbitrary text', async () => {
    expect((await callback('error=access_denied')).location).toBe(
      `${ORIGIN}/tools/chat?error=access_denied`,
    );
    expect((await callback('error=%3Cscript%3E')).location).toBe(
      `${ORIGIN}/tools/chat?error=oauth_error`,
    );
  });

  it('defaults to the chat tool when the return cookie is missing', async () => {
    jar.delete(RETURN_COOKIE);
    const res = await callback('code=c&state=forged');
    expect(res.location).toBe(`${ORIGIN}/tools/chat?error=state_mismatch`);
  });

  it('clears the one-time state and return cookies whatever the outcome', async () => {
    const res = await callback('code=c&state=forged');
    expect(res.written.get(STATE_COOKIE)?.maxAge).toBe(0);
    expect(res.written.get(RETURN_COOKIE)?.maxAge).toBe(0);
  });
});
