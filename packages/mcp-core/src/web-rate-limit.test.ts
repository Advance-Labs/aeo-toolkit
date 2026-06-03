import { describe, expect, it, vi } from 'vitest';

import {
  ANONYMOUS_CALLER_KEY,
  callerKeyFromHeaders,
  enforceWebRateLimit,
  rateLimitedBody,
  rateLimitedResponse,
  type WebRateLimiter,
  type WebRateLimitResult,
} from './web-rate-limit.js';

describe('callerKeyFromHeaders', () => {
  it('prefers an explicit mcp-client-id', () => {
    const headers = new Headers({
      'mcp-client-id': 'caller-7',
      authorization: 'Bearer tok',
      'x-forwarded-for': '203.0.113.4',
    });
    expect(callerKeyFromHeaders(headers)).toBe('client:caller-7');
  });

  it('falls back to the bearer token when no client id', () => {
    const headers = new Headers({ authorization: 'Bearer secret-tok' });
    expect(callerKeyFromHeaders(headers)).toBe('bearer:secret-tok');
  });

  it('ignores a bare Bearer with no credential and uses the forwarded IP', () => {
    const headers = new Headers({
      authorization: 'Bearer ',
      'x-forwarded-for': '198.51.100.9, 10.0.0.1',
    });
    expect(callerKeyFromHeaders(headers)).toBe('ip:198.51.100.9');
  });

  it('returns the anonymous key when no signal is present', () => {
    expect(callerKeyFromHeaders(new Headers())).toBe(ANONYMOUS_CALLER_KEY);
  });
});

/** A `WebRateLimiter` with a fixed decision that records its keys. */
function fakeLimiter(result: WebRateLimitResult): { limiter: WebRateLimiter; keys: string[] } {
  const keys: string[] = [];
  const limiter: WebRateLimiter = {
    check: (key: string) => {
      keys.push(key);
      return Promise.resolve(result);
    },
  };
  return { limiter, keys };
}

describe('rateLimitedBody / rateLimitedResponse', () => {
  it('builds a structured body with the retry hint', () => {
    const body = rateLimitedBody({ allowed: false, remaining: 0, resetSeconds: 30 });
    expect(body.error).toBe('rate_limited');
    expect(body.retryAfterSeconds).toBe(30);
  });

  it('builds a 429 Response with a Retry-After header', async () => {
    const res = rateLimitedResponse({ allowed: false, remaining: 0, resetSeconds: 42 });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
    const parsed = (await res.json()) as { error: string; retryAfterSeconds: number };
    expect(parsed.error).toBe('rate_limited');
    expect(parsed.retryAfterSeconds).toBe(42);
  });
});

describe('enforceWebRateLimit', () => {
  it('returns a 429 Response when the caller is over budget', async () => {
    const { limiter, keys } = fakeLimiter({ allowed: false, remaining: 0, resetSeconds: 12 });
    const request = new Request('https://mcp.test/api/mcp/x', {
      headers: { 'mcp-client-id': 'over' },
    });
    const res = await enforceWebRateLimit(limiter, request);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
    expect(keys).toEqual(['client:over']);
  });

  it('returns null when the caller is under budget', async () => {
    const { limiter, keys } = fakeLimiter({ allowed: true, remaining: 5, resetSeconds: 60 });
    const request = new Request('https://mcp.test/api/mcp/x', {
      headers: { authorization: 'Bearer ok-tok' },
    });
    const res = await enforceWebRateLimit(limiter, request);
    expect(res).toBeNull();
    expect(keys).toEqual(['bearer:ok-tok']);
  });

  it('consults the limiter exactly once per request', async () => {
    const result: WebRateLimitResult = { allowed: false, remaining: 0, resetSeconds: 5 };
    const check = vi.fn(() => Promise.resolve(result));
    const limiter: WebRateLimiter = { check };
    const request = new Request('https://mcp.test/api/mcp/x');
    await enforceWebRateLimit(limiter, request);
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith(ANONYMOUS_CALLER_KEY);
  });
});
