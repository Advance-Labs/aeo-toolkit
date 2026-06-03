/**
 * Web-standard (`Request`/`Response`) distributed rate-limit guard for MCP servers
 * mounted as Next.js App Router route handlers.
 *
 * The in-process token bucket in `rate-limit.ts` caps a single process's overall
 * tool throughput, but on stateless serverless (Vercel) each invocation can be a
 * fresh process — so it cannot enforce a *per-caller* budget across the fleet.
 * This module adds that layer using a structural {@link WebRateLimiter} seam that
 * `@aeo/storage`'s `RateLimiter` satisfies (an Upstash sliding window in prod, an
 * in-memory fixed window in dev/tests). It is kept structural so `@aeo/mcp-core`
 * does not depend on `@aeo/storage`; consumers inject the concrete limiter.
 *
 * Pure of any Node `http` types: it derives the caller key from the standard
 * `Headers` and returns a structured `Response` (HTTP 429) when the budget is
 * exhausted, or `null` to let the request proceed. No secrets are read or logged.
 */

/** The decision a limiter returns for a single keyed request. */
export interface WebRateLimitResult {
  /** Whether this request is within the limit. */
  allowed: boolean;
  /** Requests remaining in the current window after this call. */
  remaining: number;
  /** Seconds until the window resets (non-negative). */
  resetSeconds: number;
}

/**
 * Structural rate-limiter seam. `@aeo/storage`'s `RateLimiter` conforms to this
 * exactly, so a console route can pass `resolveRateLimiter(...)` straight in.
 */
export interface WebRateLimiter {
  check(key: string): Promise<WebRateLimitResult>;
}

/** Header carrying the bearer credential a hosted MCP client presents. */
const AUTHORIZATION_HEADER = 'authorization';
/** Header set by Vercel / proxies with the originating client IP chain. */
const FORWARDED_FOR_HEADER = 'x-forwarded-for';
/** Optional explicit caller id some clients send for attribution. */
const MCP_CLIENT_ID_HEADER = 'mcp-client-id';

/** Caller key used when no identifying header is present (shared bucket). */
export const ANONYMOUS_CALLER_KEY = 'anonymous';

/**
 * Derive a stable rate-limit key from a request's headers, preferring the
 * strongest caller signal available: an explicit client id, then the bearer
 * token, then the originating IP. The bearer token is keyed on verbatim but is
 * never logged. Falls back to a shared anonymous bucket so unauthenticated/local
 * traffic is still bounded.
 */
export function callerKeyFromHeaders(headers: Headers): string {
  const clientId = headers.get(MCP_CLIENT_ID_HEADER)?.trim();
  if (clientId) return `client:${clientId}`;

  const auth = headers.get(AUTHORIZATION_HEADER);
  if (auth) {
    // Require a non-empty credential after the scheme; a bare "Bearer " is NOT a token.
    const token = /^\s*bearer\s+(\S.*)$/i.exec(auth)?.[1]?.trim();
    if (token && token.length > 0) return `bearer:${token}`;
  }

  const fwd = headers.get(FORWARDED_FOR_HEADER);
  if (fwd) {
    // x-forwarded-for may be a comma-separated chain; the client is the first hop.
    const first = fwd.split(',')[0]?.trim();
    if (first && first.length > 0) return `ip:${first}`;
  }

  return ANONYMOUS_CALLER_KEY;
}

/** The structured 429 JSON body returned when a caller exceeds its budget. */
export interface RateLimitedBody {
  error: 'rate_limited';
  message: string;
  retryAfterSeconds: number;
}

/** Build the JSON body for a rate-limited response (machine-readable, no secrets). */
export function rateLimitedBody(result: WebRateLimitResult): RateLimitedBody {
  return {
    error: 'rate_limited',
    message: 'Rate limit exceeded. Retry after the indicated number of seconds.',
    retryAfterSeconds: result.resetSeconds,
  };
}

/** Build the HTTP 429 `Response` with a `Retry-After` header for a blocked caller. */
export function rateLimitedResponse(result: WebRateLimitResult): Response {
  return new Response(JSON.stringify(rateLimitedBody(result)), {
    status: 429,
    headers: {
      'content-type': 'application/json',
      'retry-after': String(Math.max(result.resetSeconds, 0)),
    },
  });
}

/**
 * Enforce the per-caller distributed limit for a request. Returns a 429
 * `Response` when the caller is over budget (the route should return it
 * directly), or `null` when the request may proceed to the MCP handler.
 *
 * Never throws on a limiter rejection — the decision is data, not an exception.
 */
export async function enforceWebRateLimit(
  limiter: WebRateLimiter,
  request: Request,
): Promise<Response | null> {
  const key = callerKeyFromHeaders(request.headers);
  const result = await limiter.check(key);
  if (!result.allowed) {
    return rateLimitedResponse(result);
  }
  return null;
}
