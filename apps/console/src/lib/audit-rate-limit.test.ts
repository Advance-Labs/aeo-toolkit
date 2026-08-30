import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter, UpstashRateLimiter } from '@advance-labs/storage';
import {
  AUDIT_RATE_LIMIT,
  AUDIT_WINDOW_SECONDS,
  clientIp,
  resolveAuditRateLimiter,
} from './audit-rate-limit.js';

describe('resolveAuditRateLimiter', () => {
  it('falls back to the in-memory limiter when Upstash env vars are absent', () => {
    const limiter = resolveAuditRateLimiter({});
    expect(limiter).toBeInstanceOf(InMemoryRateLimiter);
  });

  it('falls back to in-memory when only one Upstash credential is present', () => {
    const limiter = resolveAuditRateLimiter({
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
    });
    expect(limiter).toBeInstanceOf(InMemoryRateLimiter);
  });

  it('selects the Upstash limiter when both credentials are present (no network until check)', () => {
    // Constructing the Upstash limiter builds the Redis/Ratelimit clients but issues no network
    // call — so this asserts branch selection without touching Redis.
    const limiter = resolveAuditRateLimiter({
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    });
    expect(limiter).toBeInstanceOf(UpstashRateLimiter);
  });

  it('produces a working async limiter that allows then blocks within the window', async () => {
    const env = {};
    const limiter = resolveAuditRateLimiter(env);

    // The fallback enforces AUDIT_RATE_LIMIT requests per key, then denies with a Retry-After hint.
    let last = await limiter.check('203.0.113.7');
    for (let i = 1; i < AUDIT_RATE_LIMIT; i += 1) {
      last = await limiter.check('203.0.113.7');
      expect(last.allowed).toBe(true);
    }
    expect(last.remaining).toBe(0);

    const blocked = await limiter.check('203.0.113.7');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetSeconds).toBeGreaterThan(0);
    expect(blocked.resetSeconds).toBeLessThanOrEqual(AUDIT_WINDOW_SECONDS);
  });

  it('tracks distinct keys (IPs) independently', async () => {
    const limiter = resolveAuditRateLimiter({});
    // Exhaust one IP's budget.
    for (let i = 0; i < AUDIT_RATE_LIMIT; i += 1) {
      await limiter.check('a');
    }
    expect((await limiter.check('a')).allowed).toBe(false);
    // A different IP is unaffected.
    expect((await limiter.check('b')).allowed).toBe(true);
  });
});

describe('clientIp', () => {
  it('reads the first x-forwarded-for entry', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' });
    expect(clientIp(headers)).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip then unknown', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});
