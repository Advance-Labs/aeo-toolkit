/**
 * Rate-limit adapters shared by the MCP servers and web apps.
 *
 *  - {@link InMemoryRateLimiter} — a real fixed-window limiter for single-instance / dev use, with
 *    an injectable clock for deterministic tests. No external dependencies.
 *  - {@link UpstashRateLimiter} — a distributed sliding-window limiter over Upstash Redis, used in
 *    production (serverless, multi-instance). The Upstash SDKs are constructed lazily inside the
 *    class so they are never invoked in tests.
 *  - {@link resolveRateLimiter} — picks Upstash when Redis credentials are present, else the
 *    in-memory fallback.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitResult {
  /** Whether this request is within the limit. */
  allowed: boolean;
  /** Requests remaining in the current window after this call. */
  remaining: number;
  /** Seconds until the window resets (non-negative). */
  resetSeconds: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

export interface InMemoryRateLimiterOptions {
  /** Maximum requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock (defaults to `Date.now`) for deterministic tests. */
  now?: () => number;
}

interface WindowState {
  /** Start timestamp (ms) of the current fixed window. */
  windowStart: number;
  /** Requests counted in the current window. */
  count: number;
}

/**
 * Fixed-window, in-process rate limiter. Each key gets an independent counter that resets when the
 * window elapses. Suitable as a single-instance fallback; it does not coordinate across processes.
 */
export class InMemoryRateLimiter implements RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;
  readonly #windows = new Map<string, WindowState>();

  constructor(options: InMemoryRateLimiterOptions) {
    if (options.limit <= 0) {
      throw new Error('InMemoryRateLimiter requires a positive limit');
    }
    if (options.windowMs <= 0) {
      throw new Error('InMemoryRateLimiter requires a positive windowMs');
    }
    this.#limit = options.limit;
    this.#windowMs = options.windowMs;
    this.#now = options.now ?? Date.now;
  }

  check(key: string): Promise<RateLimitResult> {
    const now = this.#now();
    const existing = this.#windows.get(key);

    let state: WindowState;
    if (existing === undefined || now - existing.windowStart >= this.#windowMs) {
      state = { windowStart: now, count: 0 };
    } else {
      state = existing;
    }

    const allowed = state.count < this.#limit;
    if (allowed) {
      state.count += 1;
    }
    this.#windows.set(key, state);

    const elapsed = now - state.windowStart;
    const resetMs = Math.max(this.#windowMs - elapsed, 0);
    const remaining = Math.max(this.#limit - state.count, 0);

    return Promise.resolve({
      allowed,
      remaining,
      resetSeconds: Math.ceil(resetMs / 1000),
    });
  }
}

export interface UpstashRateLimiterOptions {
  redisUrl: string;
  redisToken: string;
  /** Maximum requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /**
   * Injectable clock for converting Upstash's absolute `reset` (Unix ms) into a relative
   * `resetSeconds`. Defaults to `Date.now`. Exposed for deterministic tests; not part of the
   * documented public option set.
   */
  now?: () => number;
  /**
   * Pre-built limiter seam. When provided, the Upstash SDK clients are not constructed and the
   * supplied limiter is used directly. This is the test injection point that keeps the SDK out of
   * unit tests; production callers omit it and the real `Ratelimit`/`Redis` clients are built.
   */
  limiter?: UpstashLimiterLike;
}

/** Minimal structural view of the Upstash `Ratelimit.limit()` result we consume. */
export interface UpstashLimitResult {
  success: boolean;
  remaining: number;
  /** Unix timestamp (ms) when the window resets. */
  reset: number;
}

/** A limiter exposing the single `limit()` call we use — the real `Ratelimit` satisfies this. */
export interface UpstashLimiterLike {
  limit(identifier: string): Promise<UpstashLimitResult>;
}

/**
 * Distributed sliding-window limiter backed by Upstash Redis. The SDK clients are constructed in
 * the constructor from the supplied credentials; no network call happens until `check()` runs.
 */
export class UpstashRateLimiter implements RateLimiter {
  readonly #limiter: UpstashLimiterLike;
  readonly #now: () => number;

  constructor(options: UpstashRateLimiterOptions) {
    if (options.limit <= 0) {
      throw new Error('UpstashRateLimiter requires a positive limit');
    }
    if (options.windowSeconds <= 0) {
      throw new Error('UpstashRateLimiter requires a positive windowSeconds');
    }
    if (options.limiter !== undefined) {
      this.#limiter = options.limiter;
    } else {
      const redis = new Redis({ url: options.redisUrl, token: options.redisToken });
      this.#limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(options.limit, `${options.windowSeconds} s`),
      });
    }
    this.#now = options.now ?? Date.now;
  }

  async check(key: string): Promise<RateLimitResult> {
    const result = await this.#limiter.limit(key);
    const resetMs = Math.max(result.reset - this.#now(), 0);
    return {
      allowed: result.success,
      remaining: Math.max(result.remaining, 0),
      resetSeconds: Math.ceil(resetMs / 1000),
    };
  }
}

export interface ResolveRateLimiterOptions {
  /** Maximum requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Upstash Redis REST URL. When present with `redisToken`, the Upstash adapter is chosen. */
  redisUrl?: string;
  /** Upstash Redis REST token. */
  redisToken?: string;
}

/** Emit the production-fallback warning at most once per process, not once per resolve call. */
let warnedInMemoryFallback = false;

/**
 * Choose the production limiter when Upstash credentials are present, otherwise fall back to the
 * in-memory limiter (converting `windowSeconds` to `windowMs`).
 *
 * The fallback is a real limiter, but it is per-instance and resets on cold start. On a
 * multi-instance serverless deploy that means the effective ceiling is roughly
 * `limit × instance count`, and a traffic spike (which is exactly when the cap matters) also
 * scales up instances — so protection is weakest precisely when it is most needed.
 *
 * That degradation used to be silent. It is now warned about once per process in production,
 * because "the rate limit is quietly not what the constant says" is the kind of thing you want
 * to discover from a log line rather than from a bill.
 */
export function resolveRateLimiter(options: ResolveRateLimiterOptions): RateLimiter {
  const { redisUrl, redisToken, limit, windowSeconds } = options;

  if (
    redisUrl !== undefined &&
    redisUrl.length > 0 &&
    redisToken !== undefined &&
    redisToken.length > 0
  ) {
    return new UpstashRateLimiter({ redisUrl, redisToken, limit, windowSeconds });
  }

  if (process.env.NODE_ENV === 'production' && !warnedInMemoryFallback) {
    warnedInMemoryFallback = true;
    console.warn(
      '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN are not set — falling back to the in-memory ' +
        `limiter (${limit} per ${windowSeconds}s). This is PER-INSTANCE and resets on cold start, ` +
        'so the shared cap is not enforced across a multi-instance deployment.',
    );
  }

  return new InMemoryRateLimiter({ limit, windowMs: windowSeconds * 1000 });
}
