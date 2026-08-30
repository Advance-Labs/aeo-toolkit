/**
 * Token-bucket rate limiter for MCP servers.
 *
 * Pure, deterministic, and side-effect free apart from its internal token count.
 * Time is injectable so refill/exhaustion behaviour can be unit-tested without
 * real clocks or timers.
 */
import type { RateLimitConfig } from '@advance-labs/types';

/** A monotonic clock returning milliseconds. Injectable for deterministic tests. */
export type Clock = () => number;

const DEFAULT_CLOCK: Clock = () => Date.now();

export class RateLimiter {
  private readonly capacity: number;
  private readonly refillPerSec: number;
  private readonly clock: Clock;

  /** Current token count (fractional between refills). */
  private tokens: number;
  /** Timestamp (ms) of the last refill calculation. */
  private lastRefillMs: number;

  /**
   * @param config       capacity (max tokens) + refillPerSec (tokens added per second)
   * @param clock        injectable millisecond clock (defaults to `Date.now`)
   */
  constructor(config: RateLimitConfig, clock: Clock = DEFAULT_CLOCK) {
    if (config.capacity <= 0) {
      throw new RangeError('RateLimiter capacity must be > 0');
    }
    if (config.refillPerSec < 0) {
      throw new RangeError('RateLimiter refillPerSec must be >= 0');
    }
    this.capacity = config.capacity;
    this.refillPerSec = config.refillPerSec;
    this.clock = clock;
    // Buckets start full so a freshly-created limiter does not reject the first burst.
    this.tokens = config.capacity;
    this.lastRefillMs = clock();
  }

  /** Top up tokens based on elapsed wall-clock time since the last refill. */
  private refill(): void {
    const nowMs = this.clock();
    const elapsedMs = nowMs - this.lastRefillMs;
    if (elapsedMs <= 0) {
      // Clock did not advance (or moved backwards): anchor to now, add nothing.
      this.lastRefillMs = nowMs;
      return;
    }
    const added = (elapsedMs / 1000) * this.refillPerSec;
    if (added > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + added);
    }
    this.lastRefillMs = nowMs;
  }

  /**
   * Attempt to consume `count` tokens. Returns `true` and deducts them when the
   * bucket has enough; otherwise returns `false` and leaves the bucket untouched.
   */
  tryRemove(count = 1): boolean {
    if (count <= 0) {
      throw new RangeError('RateLimiter.tryRemove count must be > 0');
    }
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  /** Tokens currently available (after a refill). Useful for diagnostics/tests. */
  available(): number {
    this.refill();
    return this.tokens;
  }
}
