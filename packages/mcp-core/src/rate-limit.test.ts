import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit.js';

/** A controllable clock: tests advance time explicitly, no timers involved. */
function fakeClock(startMs = 0) {
  let nowMs = startMs;
  return {
    now: () => nowMs,
    advance: (deltaMs: number) => {
      nowMs += deltaMs;
    },
    set: (ms: number) => {
      nowMs = ms;
    },
  };
}

describe('RateLimiter', () => {
  it('starts full and allows a burst up to capacity, then rejects', () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ capacity: 3, refillPerSec: 1 }, clock.now);

    // capacity = 3 → three immediate removals succeed.
    expect(limiter.tryRemove()).toBe(true);
    expect(limiter.tryRemove()).toBe(true);
    expect(limiter.tryRemove()).toBe(true);
    // Bucket now empty (no time has passed → no refill).
    expect(limiter.tryRemove()).toBe(false);
  });

  it('refills tokens over injected time and permits more removals', () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ capacity: 2, refillPerSec: 2 }, clock.now);

    // Exhaust the bucket.
    expect(limiter.tryRemove()).toBe(true);
    expect(limiter.tryRemove()).toBe(true);
    expect(limiter.tryRemove()).toBe(false);

    // After 500ms at 2 tokens/sec, exactly 1 token should be available again.
    clock.advance(500);
    expect(limiter.tryRemove()).toBe(true);
    expect(limiter.tryRemove()).toBe(false);

    // After a full second, 2 more tokens accrue but capacity caps at 2.
    clock.advance(2000);
    expect(limiter.available()).toBe(2);
  });

  it('never refills above capacity even after long idle periods', () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ capacity: 5, refillPerSec: 10 }, clock.now);
    limiter.tryRemove(5);
    expect(limiter.available()).toBe(0);

    clock.advance(60_000); // one minute of accrual
    expect(limiter.available()).toBe(5); // capped, not 600
  });

  it('tolerates a clock that moves backwards without granting free tokens', () => {
    const clock = fakeClock(10_000);
    const limiter = new RateLimiter({ capacity: 2, refillPerSec: 5 }, clock.now);
    limiter.tryRemove(2);
    expect(limiter.available()).toBe(0);

    clock.set(0); // clock jumped backwards
    expect(limiter.available()).toBe(0); // no negative elapsed → no refill
  });

  it('supports removing multiple tokens atomically', () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ capacity: 4, refillPerSec: 1 }, clock.now);
    expect(limiter.tryRemove(4)).toBe(true);
    // Asking for 1 more than available leaves the bucket untouched.
    expect(limiter.tryRemove(1)).toBe(false);
    expect(limiter.available()).toBe(0);
  });

  it('rejects invalid configuration and arguments', () => {
    expect(() => new RateLimiter({ capacity: 0, refillPerSec: 1 })).toThrow(RangeError);
    expect(() => new RateLimiter({ capacity: 1, refillPerSec: -1 })).toThrow(RangeError);
    const limiter = new RateLimiter({ capacity: 1, refillPerSec: 1 });
    expect(() => limiter.tryRemove(0)).toThrow(RangeError);
  });
});
