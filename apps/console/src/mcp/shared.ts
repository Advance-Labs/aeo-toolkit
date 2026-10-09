/**
 * Shared wiring for the console's three MCP servers, mounted as Next.js App
 * Router route handlers via `mcp-handler`.
 *
 * Centralises the two cross-server concerns:
 *  - the public origin (`MCP_PUBLIC_URL`) every `.well-known` discovery document
 *    and OAuth metadata is based on, and
 *  - the per-caller distributed rate limiter (Upstash in prod, in-memory in
 *    dev/tests) shared across the stateless serverless fleet.
 *
 * BYOK note: no LLM/API keys are read here. Per-request keys arrive as tool args
 * (ai-visibility, backlink) or as the `Authorization` bearer (ga-gsc) and are
 * never read from the environment, persisted, or logged.
 */
import { resolveRateLimiter, type RateLimiter } from '@advance-labs/storage';

/**
 * Per-caller budget applied at each MCP route entry (one window per caller).
 *
 * 20/60s, lowered from 60/60s. The old number was picked while these endpoints were silently
 * 404ing for everyone, so it was never a judgement about anonymous public traffic — it was a
 * placeholder nobody could test. An MCP client issues roughly one tool call per user action,
 * so 20/min is generous for a human driving Claude or Cursor and ungenerous for a scraper.
 *
 * This matters more than a typical read endpoint: `backlink` tools make OUTBOUND fetches to
 * third parties (DuckDuckGo, Wayback, CommonCrawl) on our IP, so an unbounded caller spends
 * our reputation with those services as well as our serverless budget.
 *
 * Override without a deploy via `MCP_RATE_LIMIT` / `MCP_RATE_LIMIT_WINDOW_SECONDS`.
 */
export const MCP_DISTRIBUTED_RATE_LIMIT = { limit: 20, windowSeconds: 60 } as const;

/**
 * Divisor applied to the per-caller limit when running in production WITHOUT a shared store.
 *
 * Without Redis the limiter is per-instance and resets on every cold start, so the real ceiling
 * is `limit × instances × cold starts` — unbounded in practice. Dividing keeps the aggregate in
 * the neighbourhood of the intended cap across a handful of instances instead of multiplying by
 * them. It is a floor for a degraded mode, not a substitute for the shared store.
 */
const IN_MEMORY_FALLBACK_DIVISOR = 4;

/** Read a positive integer from the environment, or `undefined` if unset/invalid. */
function positiveIntFromEnv(
  env: Record<string, string | undefined>,
  key: string,
): number | undefined {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  // Reject 0, negatives, fractions and NaN: a bad value must not silently disable the limiter.
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(`[mcp-rate-limit] ignoring ${key}="${raw}" — expected a positive integer.`);
    return undefined;
  }
  return parsed;
}

/** Default public origin used when `MCP_PUBLIC_URL` is not configured. */
const DEFAULT_PUBLIC_URL = 'https://console.aeo-toolkit.example.com';

/** Strip a single trailing slash so concatenated paths never double up. */
function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

/**
 * Resolve the public origin of this deployment from the environment. Used as the
 * `resource` and `issuer` base for the `.well-known` OAuth discovery documents.
 */
export function mcpPublicUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = env.MCP_PUBLIC_URL?.trim();
  return trimTrailingSlash(raw && raw.length > 0 ? raw : DEFAULT_PUBLIC_URL);
}

/**
 * The authorization servers this deployment can honestly point a client at from
 * the ROOT `.well-known` documents, or `null` when there are none.
 *
 * THE ROOT OF THIS ORIGIN IS NOT AN AUTHORIZATION SERVER. There is no `/authorize`,
 * `/token` or `/register` at the root, and the ai-visibility and backlink servers
 * need no login at all. So the root documents must NEVER name this origin as its
 * own authorization server. (The search server does run one, but at the path-scoped
 * issuer `${origin}/api/mcp/oauth`, discovered through its own path-scoped
 * `.well-known` documents; see `@/mcp/oauth/config`. It never touches these.)
 *
 * It used to. `OAUTH_ISSUER` is unset in production, both `.well-known` documents
 * fell back to this origin, and the authorization-server document advertised
 * `${origin}/register` as a Dynamic Client Registration endpoint. Clients did
 * exactly as told, POSTed there, and got the Next.js 404 HTML page back:
 *
 *   SDK auth failed: Dynamic Client Registration rejected (HTTP 404): <!DOCTYPE html>...
 *
 * Discovering nothing is what makes a client fall back to the header-based
 * credentials that actually work; discovering a broken flow makes it give up. So
 * when no EXTERNAL issuer is configured, the documents 404 rather than lie.
 *
 * Returns the configured servers only when they are genuinely external — a value
 * equal to this origin is treated as unconfigured, since that is the same lie by
 * a longer route.
 */
export function configuredAuthorizationServers(
  origin: string,
  env: Record<string, string | undefined> = process.env,
): string[] | null {
  const explicit = env.OAUTH_AUTHORIZATION_SERVERS?.trim();
  const listed = explicit
    ? explicit
        .split(',')
        .map((s) => trimTrailingSlash(s.trim()))
        .filter((s) => s.length > 0)
    : [trimTrailingSlash(env.OAUTH_ISSUER?.trim() ?? '')].filter((s) => s.length > 0);

  const external = listed.filter((s) => s !== trimTrailingSlash(origin));
  return external.length > 0 ? external : null;
}

/**
 * Build the per-caller distributed rate limiter from the environment. Prefers the
 * Upstash sliding-window adapter when `UPSTASH_REDIS_REST_URL` +
 * `UPSTASH_REDIS_REST_TOKEN` are present (shared across serverless instances) and
 * falls back to the in-memory fixed window otherwise (no secrets in dev/tests).
 */
export function createMcpRateLimiter(
  env: Record<string, string | undefined> = process.env,
): RateLimiter {
  const redisUrl = env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN;
  const hasSharedStore =
    redisUrl !== undefined &&
    redisUrl.length > 0 &&
    redisToken !== undefined &&
    redisToken.length > 0;

  const configuredLimit =
    positiveIntFromEnv(env, 'MCP_RATE_LIMIT') ?? MCP_DISTRIBUTED_RATE_LIMIT.limit;
  const windowSeconds =
    positiveIntFromEnv(env, 'MCP_RATE_LIMIT_WINDOW_SECONDS') ??
    MCP_DISTRIBUTED_RATE_LIMIT.windowSeconds;

  // Degraded mode: no shared counter, so tighten rather than hand each instance a full budget.
  // Math.max(1, …) because a divisor must never round the limit to 0 and close the endpoint.
  const limit = hasSharedStore
    ? configuredLimit
    : Math.max(1, Math.floor(configuredLimit / IN_MEMORY_FALLBACK_DIVISOR));

  if (!hasSharedStore && env.NODE_ENV === 'production') {
    console.warn(
      `[mcp-rate-limit] No UPSTASH_REDIS_REST_URL/TOKEN — per-caller limit tightened to ${limit} ` +
        `per ${windowSeconds}s (from ${configuredLimit}) because the in-memory limiter is ` +
        'PER-INSTANCE and resets on cold start. Provision the shared store before listing these ' +
        'servers in public directories.',
    );
  }

  return resolveRateLimiter({
    limit,
    windowSeconds,
    ...(redisUrl !== undefined ? { redisUrl } : {}),
    ...(redisToken !== undefined ? { redisToken } : {}),
  });
}

/**
 * Lazily-built process-singleton limiter for the production route path. Tests
 * inject a fake limiter into the route helpers instead of using this.
 */
let sharedLimiter: RateLimiter | undefined;

/** Get (building once) the process-wide distributed limiter from the environment. */
export function getSharedMcpRateLimiter(): RateLimiter {
  sharedLimiter ??= createMcpRateLimiter();
  return sharedLimiter;
}

/** Reset the cached singleton — test-only seam so env changes take effect. */
export function resetSharedMcpRateLimiter(): void {
  sharedLimiter = undefined;
}
