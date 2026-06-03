import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter, resolveRateLimiter, UpstashRateLimiter } from './rate-limit.js';
import type { UpstashLimitResult, UpstashLimiterLike } from './rate-limit.js';

describe('InMemoryRateLimiter', () => {
  it('allows up to the limit then denies within the same window', async () => {
    const now = 1_000;
    const limiter = new InMemoryRateLimiter({ limit: 2, windowMs: 10_000, now: () => now });

    const first = await limiter.check('k');
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);

    const second = await limiter.check('k');
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    const third = await limiter.check('k');
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    // Window started at 1000, so 10s remain on the first call's window.
    expect(third.resetSeconds).toBe(10);
  });

  it('resets the window after windowMs elapses (edge case: boundary)', async () => {
    let now = 0;
    const limiter = new InMemoryRateLimiter({ limit: 1, windowMs: 5_000, now: () => now });

    expect((await limiter.check('k')).allowed).toBe(true);
    expect((await limiter.check('k')).allowed).toBe(false);

    // Advance exactly one window — counter resets, request allowed again.
    now += 5_000;
    const afterReset = await limiter.check('k');
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(0);
    expect(afterReset.resetSeconds).toBe(5);
  });

  it('tracks keys independently', async () => {
    const now = 0;
    const limiter = new InMemoryRateLimiter({ limit: 1, windowMs: 1_000, now: () => now });

    expect((await limiter.check('a')).allowed).toBe(true);
    expect((await limiter.check('a')).allowed).toBe(false);
    // A different key has its own fresh window.
    expect((await limiter.check('b')).allowed).toBe(true);
  });

  it('rejects non-positive configuration', () => {
    expect(() => new InMemoryRateLimiter({ limit: 0, windowMs: 1_000 })).toThrow();
    expect(() => new InMemoryRateLimiter({ limit: 1, windowMs: 0 })).toThrow();
  });
});

describe('UpstashRateLimiter (with injected limiter seam)', () => {
  function fakeLimiter(result: UpstashLimitResult): UpstashLimiterLike {
    return { limit: () => Promise.resolve(result) };
  }

  it('maps a successful Upstash result to RateLimitResult with relative resetSeconds', async () => {
    const now = 100_000;
    const limiter = new UpstashRateLimiter({
      redisUrl: 'https://example.upstash.io',
      redisToken: 'token',
      limit: 10,
      windowSeconds: 60,
      now: () => now,
      limiter: fakeLimiter({ success: true, remaining: 9, reset: now + 30_000 }),
    });

    const result = await limiter.check('user-1');
    expect(result).toEqual({ allowed: true, remaining: 9, resetSeconds: 30 });
  });

  it('maps a denied result and clamps a past reset to zero seconds (edge case)', async () => {
    const now = 100_000;
    const limiter = new UpstashRateLimiter({
      redisUrl: 'https://example.upstash.io',
      redisToken: 'token',
      limit: 10,
      windowSeconds: 60,
      now: () => now,
      // reset is in the past and remaining is negative — both must be clamped.
      limiter: fakeLimiter({ success: false, remaining: -1, reset: now - 5_000 }),
    });

    const result = await limiter.check('user-1');
    expect(result).toEqual({ allowed: false, remaining: 0, resetSeconds: 0 });
  });

  it('rejects non-positive configuration', () => {
    expect(
      () =>
        new UpstashRateLimiter({
          redisUrl: 'u',
          redisToken: 't',
          limit: 0,
          windowSeconds: 60,
          limiter: fakeLimiter({ success: true, remaining: 0, reset: 0 }),
        }),
    ).toThrow();
  });
});

describe('resolveRateLimiter', () => {
  it('returns an UpstashRateLimiter when redisUrl and redisToken are both present', () => {
    const limiter = resolveRateLimiter({
      limit: 5,
      windowSeconds: 60,
      redisUrl: 'https://example.upstash.io',
      redisToken: 'token',
    });
    expect(limiter).toBeInstanceOf(UpstashRateLimiter);
  });

  it('falls back to InMemoryRateLimiter when credentials are missing', () => {
    expect(resolveRateLimiter({ limit: 5, windowSeconds: 60 })).toBeInstanceOf(InMemoryRateLimiter);
    expect(
      resolveRateLimiter({ limit: 5, windowSeconds: 60, redisUrl: 'https://x' }),
    ).toBeInstanceOf(InMemoryRateLimiter);
    expect(resolveRateLimiter({ limit: 5, windowSeconds: 60, redisToken: 't' })).toBeInstanceOf(
      InMemoryRateLimiter,
    );
  });

  it('treats empty-string credentials as absent', () => {
    expect(
      resolveRateLimiter({ limit: 5, windowSeconds: 60, redisUrl: '', redisToken: '' }),
    ).toBeInstanceOf(InMemoryRateLimiter);
  });

  it('the in-memory fallback honors windowSeconds (converted to ms)', async () => {
    const now = 0;
    const limiter = resolveRateLimiter({ limit: 1, windowSeconds: 2 });
    // We cannot inject a clock through resolve, but resetSeconds reflects the 2s window.
    const result = await limiter.check('k');
    expect(result.allowed).toBe(true);
    expect(result.resetSeconds).toBeLessThanOrEqual(2);
    expect(result.resetSeconds).toBeGreaterThan(0);
    void now;
  });
});
