/**
 * Per-IP rate limiting for the public audit endpoint.
 *
 * STUB: This is an in-memory, single-instance limiter. It is real and runnable
 * (it actually enforces a per-IP request budget within the current process), but
 * it is NOT production-grade: it does not share state across serverless instances
 * and resets on cold start. Before production, swap the implementation behind the
 * `RateLimiter` interface for a durable store (e.g. Upstash Redis / Vercel KV).
 * TODO: wire a distributed limiter and surface `Retry-After`.
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Remaining requests in the current window after this decision. */
  remaining: number;
  /** Seconds until the window resets — useful for a `Retry-After` header. */
  resetSeconds: number;
}

/** The typed seam every limiter (stub or durable) must satisfy. */
export interface RateLimiter {
  check(key: string): RateLimitDecision;
}

export interface InMemoryRateLimiterOptions {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock for testability; defaults to `Date.now`. */
  now?: () => number;
}

interface WindowState {
  count: number;
  windowStart: number;
}

/** In-memory fixed-window limiter. See file-level STUB note. */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly windows = new Map<string, WindowState>();

  constructor(opts: InMemoryRateLimiterOptions) {
    this.limit = Math.max(1, opts.limit);
    this.windowMs = Math.max(1, opts.windowMs);
    this.now = opts.now ?? Date.now;
  }

  check(key: string): RateLimitDecision {
    const now = this.now();
    const existing = this.windows.get(key);

    if (existing === undefined || now - existing.windowStart >= this.windowMs) {
      const fresh: WindowState = { count: 1, windowStart: now };
      this.windows.set(key, fresh);
      return {
        allowed: true,
        remaining: this.limit - 1,
        resetSeconds: this.resetSeconds(fresh, now),
      };
    }

    if (existing.count >= this.limit) {
      return { allowed: false, remaining: 0, resetSeconds: this.resetSeconds(existing, now) };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: this.limit - existing.count,
      resetSeconds: this.resetSeconds(existing, now),
    };
  }

  private resetSeconds(state: WindowState, now: number): number {
    const elapsed = now - state.windowStart;
    return Math.max(0, Math.ceil((this.windowMs - elapsed) / 1000));
  }
}

/**
 * Process-wide default limiter for the audit endpoint: 10 audits per IP per 10 minutes.
 * A module-level singleton so the in-memory window survives across requests in one instance.
 */
export const auditRateLimiter: RateLimiter = new InMemoryRateLimiter({
  limit: 10,
  windowMs: 10 * 60 * 1000,
});

/** Best-effort client IP extraction from standard proxy headers. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    if (first && first.trim().length > 0) return first.trim();
  }
  return headers.get('x-real-ip') ?? 'unknown';
}
