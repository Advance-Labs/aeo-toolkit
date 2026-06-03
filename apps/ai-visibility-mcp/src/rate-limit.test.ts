import type { IncomingMessage } from 'node:http';

import { InMemoryRateLimiter, UpstashRateLimiter } from '@aeo/storage';
import { describe, expect, it } from 'vitest';

import {
  ANONYMOUS_CALLER_KEY,
  callerKeyFromRequest,
  createDistributedRateLimiter,
  rateLimitedBody,
} from './rate-limit.js';

/** Build a minimal `IncomingMessage`-shaped object with the given headers/socket. */
function fakeReq(
  headers: Record<string, string | string[] | undefined> = {},
  remoteAddress?: string,
): IncomingMessage {
  return {
    headers,
    socket: { remoteAddress },
  } as unknown as IncomingMessage;
}

describe('callerKeyFromRequest', () => {
  it('prefers an explicit mcp-client-id header', () => {
    const key = callerKeyFromRequest(
      fakeReq({
        'mcp-client-id': 'app-42',
        authorization: 'Bearer abc',
        'x-forwarded-for': '1.1.1.1',
      }),
    );
    expect(key).toBe('client:app-42');
  });

  it('falls back to the bearer token, stripping the scheme', () => {
    const key = callerKeyFromRequest(fakeReq({ authorization: 'Bearer tok-123' }));
    expect(key).toBe('bearer:tok-123');
  });

  it('handles a lowercase bearer scheme', () => {
    const key = callerKeyFromRequest(fakeReq({ authorization: 'bearer tok-xyz' }));
    expect(key).toBe('bearer:tok-xyz');
  });

  it('uses the first hop of x-forwarded-for when no auth is present', () => {
    const key = callerKeyFromRequest(fakeReq({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }));
    expect(key).toBe('ip:203.0.113.7');
  });

  it('collapses array-valued headers to the first entry', () => {
    const key = callerKeyFromRequest(fakeReq({ 'mcp-client-id': ['first', 'second'] }));
    expect(key).toBe('client:first');
  });

  it('falls back to the socket remote address', () => {
    const key = callerKeyFromRequest(fakeReq({}, '198.51.100.9'));
    expect(key).toBe('ip:198.51.100.9');
  });

  it('uses the anonymous bucket when nothing identifies the caller', () => {
    expect(callerKeyFromRequest(fakeReq({}))).toBe(ANONYMOUS_CALLER_KEY);
  });

  it('does not treat an empty/whitespace bearer as a token', () => {
    const key = callerKeyFromRequest(fakeReq({ authorization: 'Bearer    ' }, '192.0.2.5'));
    expect(key).toBe('ip:192.0.2.5');
  });
});

describe('createDistributedRateLimiter (env-gated factory)', () => {
  it('returns the in-memory fallback when Upstash env is absent', () => {
    const limiter = createDistributedRateLimiter({});
    expect(limiter).toBeInstanceOf(InMemoryRateLimiter);
  });

  it('returns the in-memory fallback when only one Upstash var is set', () => {
    const limiter = createDistributedRateLimiter({
      UPSTASH_REDIS_REST_URL: 'https://x.upstash.io',
    });
    expect(limiter).toBeInstanceOf(InMemoryRateLimiter);
  });

  it('returns the Upstash limiter when both credentials are present', () => {
    // The Upstash SDK clients are constructed lazily; no network call happens
    // until check() runs, so building the limiter here is offline-safe.
    const limiter = createDistributedRateLimiter({
      UPSTASH_REDIS_REST_URL: 'https://x.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'redis-token',
    });
    expect(limiter).toBeInstanceOf(UpstashRateLimiter);
  });
});

describe('rateLimitedBody', () => {
  it('produces a structured 429 body carrying the retry window', () => {
    const body = rateLimitedBody({ allowed: false, remaining: 0, resetSeconds: 17 });
    expect(body).toEqual({
      error: 'rate_limited',
      message: expect.stringContaining('Rate limit exceeded'),
      retryAfterSeconds: 17,
    });
  });
});
