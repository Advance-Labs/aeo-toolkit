/**
 * Distributed, per-caller rate limiting for the hosted HTTP entry.
 *
 * The in-process token bucket in `@aeo/mcp-core` caps a single process's overall
 * tool throughput, but on stateless serverless (Vercel) each invocation gets a
 * fresh process — so it cannot enforce a per-caller budget across the fleet. This
 * module adds that layer using `@aeo/storage`'s `resolveRateLimiter`, which
 * prefers an Upstash Redis sliding window when credentials are configured and
 * falls back to an in-memory fixed window for local/dev (and tests) when they are
 * not. No secrets are read except from the supplied `env`/config; nothing is
 * logged.
 */
import { resolveRateLimiter, type RateLimiter, type RateLimitResult } from '@aeo/storage';
import type { IncomingMessage } from 'node:http';

import { DISTRIBUTED_RATE_LIMIT } from './config.js';

/** Header carrying the bearer credential a hosted MCP client presents. */
const AUTHORIZATION_HEADER = 'authorization';
/** Header set by Vercel / proxies with the originating client IP. */
const FORWARDED_FOR_HEADER = 'x-forwarded-for';
/** Optional explicit caller id some clients send for attribution. */
const MCP_CLIENT_ID_HEADER = 'mcp-client-id';

/** Caller key used when no identifying header is present (shared bucket). */
export const ANONYMOUS_CALLER_KEY = 'anonymous';

/** Read a single header value, collapsing the array form Node may hand back. */
function headerValue(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/**
 * Derive a stable rate-limit key for a request, preferring the strongest caller
 * signal available: an explicit client id, then the bearer token, then the
 * originating IP. The bearer token is hashed-by-prefix only conceptually here —
 * we key on the opaque token string itself and never log it. Falls back to a
 * shared anonymous bucket so unauthenticated/local traffic is still bounded.
 */
export function callerKeyFromRequest(req: IncomingMessage): string {
  const clientId = headerValue(req, MCP_CLIENT_ID_HEADER)?.trim();
  if (clientId) return `client:${clientId}`;

  const auth = headerValue(req, AUTHORIZATION_HEADER);
  if (auth) {
    // Require a non-empty credential after the scheme; a bare/whitespace "Bearer " is NOT a token.
    const token = /^\s*bearer\s+(\S.*)$/i.exec(auth)?.[1]?.trim();
    if (token && token.length > 0) return `bearer:${token}`;
  }

  const fwd = headerValue(req, FORWARDED_FOR_HEADER);
  if (fwd) {
    // x-forwarded-for may be a comma-separated chain; the client is the first hop.
    const first = fwd.split(',')[0]?.trim();
    if (first && first.length > 0) return `ip:${first}`;
  }

  const remote = req.socket?.remoteAddress?.trim();
  if (remote && remote.length > 0) return `ip:${remote}`;

  return ANONYMOUS_CALLER_KEY;
}

/**
 * Build the distributed limiter for the configured caller budget. Returns the
 * Upstash-backed limiter when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 * are present in `env`, otherwise the in-memory fallback (so local dev and tests
 * run with no secrets). Inject the result; it is cheap to hold one per process.
 */
export function createDistributedRateLimiter(
  env: Record<string, string | undefined> = process.env,
): RateLimiter {
  const redisUrl = env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN;
  return resolveRateLimiter({
    limit: DISTRIBUTED_RATE_LIMIT.limit,
    windowSeconds: DISTRIBUTED_RATE_LIMIT.windowSeconds,
    ...(redisUrl !== undefined ? { redisUrl } : {}),
    ...(redisToken !== undefined ? { redisToken } : {}),
  });
}

/**
 * Lazily-built process-singleton limiter for the production HTTP path. Tests and
 * callers that need a specific limiter inject one explicitly instead.
 */
let sharedLimiter: RateLimiter | undefined;

/** Get (building once) the process-wide distributed limiter from the environment. */
export function getSharedRateLimiter(): RateLimiter {
  sharedLimiter ??= createDistributedRateLimiter();
  return sharedLimiter;
}

/** Reset the cached singleton — test-only seam so env changes take effect. */
export function resetSharedRateLimiter(): void {
  sharedLimiter = undefined;
}

/**
 * Check a request against the limiter and return the decision plus the caller key
 * (for diagnostics) and the full {@link RateLimitResult}. Never throws on a
 * limiter rejection — the caller decides how to surface a 429.
 */
export async function checkRequestRateLimit(
  limiter: RateLimiter,
  req: IncomingMessage,
): Promise<{ key: string; result: RateLimitResult }> {
  const key = callerKeyFromRequest(req);
  const result = await limiter.check(key);
  return { key, result };
}

/**
 * The structured 429 body returned over HTTP when a caller exceeds its budget.
 * Mirrors the MCP structured-error ethos: machine-readable, no secrets.
 */
export interface RateLimitedBody {
  error: 'rate_limited';
  message: string;
  retryAfterSeconds: number;
}

/** Build the JSON body for a rate-limited response. */
export function rateLimitedBody(result: RateLimitResult): RateLimitedBody {
  return {
    error: 'rate_limited',
    message: 'Rate limit exceeded. Retry after the indicated number of seconds.',
    retryAfterSeconds: result.resetSeconds,
  };
}
