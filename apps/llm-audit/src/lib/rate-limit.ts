/**
 * Per-IP rate limiting for the public audit endpoint.
 *
 * The limiter is resolved by `@aeo/storage#resolveRateLimiter`, which returns a distributed
 * Upstash Redis sliding-window limiter when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 * are configured, and otherwise falls back to a real (but single-instance, cold-start-resetting)
 * in-memory fixed-window limiter. This keeps local dev and the offline unit tests credential-free
 * while making the production deployment durable and multi-instance-safe.
 *
 * Credentials come only from the environment — never hard-coded, never logged.
 */
import { resolveRateLimiter } from '@aeo/storage';
import type { RateLimiter } from '@aeo/storage';

export type { RateLimiter, RateLimitResult } from '@aeo/storage';

/** Max audits allowed per IP within {@link AUDIT_WINDOW_SECONDS}. */
export const AUDIT_RATE_LIMIT = 10;
/** Rate-limit window length in seconds (10 minutes). */
export const AUDIT_WINDOW_SECONDS = 10 * 60;

/**
 * Build the audit limiter from the environment. Returns the Upstash adapter when Redis credentials
 * are present, else the in-memory fallback. Reading env lazily (rather than at module load) keeps
 * the factory test-friendly and avoids capturing stale values.
 */
export function resolveAuditRateLimiter(
  env: Record<string, string | undefined> = process.env,
): RateLimiter {
  return resolveRateLimiter({
    limit: AUDIT_RATE_LIMIT,
    windowSeconds: AUDIT_WINDOW_SECONDS,
    redisUrl: env.UPSTASH_REDIS_REST_URL,
    redisToken: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

/**
 * Process-wide default limiter for the audit endpoint: 10 audits per IP per 10 minutes. A
 * module-level singleton so the in-memory window (dev fallback) survives across requests in one
 * instance; in production this resolves to the shared Upstash limiter.
 */
export const auditRateLimiter: RateLimiter = resolveAuditRateLimiter();

/** Best-effort client IP extraction from standard proxy headers. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    if (first && first.trim().length > 0) return first.trim();
  }
  return headers.get('x-real-ip') ?? 'unknown';
}
