import { describe, expect, it } from 'vitest';
import { clientIp, InMemoryRateLimiter } from './rate-limit.js';

describe('InMemoryRateLimiter', () => {
  it('allows up to the limit then blocks within a window', () => {
    const t = 0;
    const limiter = new InMemoryRateLimiter({ limit: 2, windowMs: 1000, now: () => t });

    expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(true);
    const blocked = limiter.check('ip');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetSeconds).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    let t = 0;
    const limiter = new InMemoryRateLimiter({ limit: 1, windowMs: 1000, now: () => t });

    expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(false);
    t = 1001;
    expect(limiter.check('ip').allowed).toBe(true);
  });

  it('tracks distinct keys independently', () => {
    const t = 0;
    const limiter = new InMemoryRateLimiter({ limit: 1, windowMs: 1000, now: () => t });

    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
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
