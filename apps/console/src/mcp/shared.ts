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
import { resolveRateLimiter, type RateLimiter } from '@aeo/storage';

/** Per-caller budget applied at each MCP route entry (one window per caller). */
export const MCP_DISTRIBUTED_RATE_LIMIT = { limit: 60, windowSeconds: 60 } as const;

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
  return resolveRateLimiter({
    limit: MCP_DISTRIBUTED_RATE_LIMIT.limit,
    windowSeconds: MCP_DISTRIBUTED_RATE_LIMIT.windowSeconds,
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
