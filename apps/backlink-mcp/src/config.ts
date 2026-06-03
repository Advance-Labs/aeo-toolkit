/**
 * Runtime configuration for the backlink MCP server.
 *
 * Everything is environment-driven so the same registry runs identically under
 * stdio (local) and HTTP (hosted). The rate limit is intentionally conservative:
 * DuckDuckGo and the Wayback CDX endpoint both throttle/block aggressive
 * scraping, so we identify the client honestly and stay polite by default.
 */
import type { RateLimitConfig } from '@aeo/types';

/**
 * Configuration for the distributed scrape rate limiter that throttles outbound
 * GETs to the free sources (DuckDuckGo, Wayback CDX, CommonCrawl). This is a
 * *second*, finer limiter on top of `@aeo/mcp-core`'s per-tool-call token bucket:
 * it caps the raw request rate per source so a single tool call that fans out to
 * several sources still stays polite. `resolveRateLimiter` from `@aeo/storage`
 * uses Upstash Redis when its creds are present (shared across serverless
 * instances) and falls back to an in-memory fixed-window limiter otherwise.
 */
export interface ScrapeRateLimitConfig {
  /** Max outbound scrape requests allowed per `windowSeconds`. */
  limit: number;
  /** Sliding/fixed window length in seconds. */
  windowSeconds: number;
  /** Upstash REST URL — when set with the token, enables distributed limiting. */
  redisUrl?: string;
  /** Upstash REST token. */
  redisToken?: string;
}

export interface ServerConfig {
  name: string;
  version: string;
  /** Token-bucket rate limit applied to every tool call by `@aeo/mcp-core`. */
  rateLimit: RateLimitConfig;
  /** Distributed/in-memory limiter around raw outbound scrape requests. */
  scrapeRateLimit: ScrapeRateLimitConfig;
  /** User-Agent sent on every outbound scrape/fetch — honest client identity. */
  userAgent: string;
  /** Per-request network timeout for outbound fetches (ms). */
  requestTimeoutMs: number;
  /** CommonCrawl monthly index id to query (overridable as crawls roll forward). */
  commonCrawlIndex: string;
}

export const SERVER_NAME = 'backlink-mcp';
export const SERVER_VERSION = '0.1.0';

/** Honest default identity; overridable via `BACKLINK_USER_AGENT`. */
export const DEFAULT_USER_AGENT =
  'aeo-backlink-mcp/0.1 (+https://github.com/aeo-toolkit; polite free-source link research)';

const DEFAULT_RATE_CAPACITY = 8;
const DEFAULT_RATE_REFILL_PER_SEC = 1;
const DEFAULT_TIMEOUT_MS = 15_000;

/** Conservative defaults for the outbound scrape limiter — free sources throttle. */
const DEFAULT_SCRAPE_LIMIT = 30;
const DEFAULT_SCRAPE_WINDOW_SECONDS = 60;
const DEFAULT_CC_INDEX = 'CC-MAIN-2024-51';

/** Read a non-empty trimmed env value, or `undefined`. */
function stringFromEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed !== '' ? trimmed : undefined;
}

/** Parse a positive number from env, falling back when absent or invalid. */
function numberFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Resolve the server configuration from a (process) environment map.
 * Pure and injectable so tests can supply a fixture env.
 */
export function resolveConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const scrapeRateLimit: ScrapeRateLimitConfig = {
    limit: numberFromEnv(env.BACKLINK_SCRAPE_LIMIT, DEFAULT_SCRAPE_LIMIT),
    windowSeconds: numberFromEnv(env.BACKLINK_SCRAPE_WINDOW_SECONDS, DEFAULT_SCRAPE_WINDOW_SECONDS),
  };
  // Distributed limiting is opt-in: only attach Upstash creds when BOTH are set,
  // otherwise `resolveRateLimiter` falls back to the in-memory limiter (dev/tests
  // need no secrets). Secrets come only from env — never hard-coded or logged.
  const redisUrl = stringFromEnv(env.UPSTASH_REDIS_REST_URL);
  const redisToken = stringFromEnv(env.UPSTASH_REDIS_REST_TOKEN);
  if (redisUrl !== undefined && redisToken !== undefined) {
    scrapeRateLimit.redisUrl = redisUrl;
    scrapeRateLimit.redisToken = redisToken;
  }

  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    rateLimit: {
      capacity: numberFromEnv(env.BACKLINK_RATE_CAPACITY, DEFAULT_RATE_CAPACITY),
      refillPerSec: numberFromEnv(env.BACKLINK_RATE_REFILL_PER_SEC, DEFAULT_RATE_REFILL_PER_SEC),
    },
    scrapeRateLimit,
    userAgent: env.BACKLINK_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
    requestTimeoutMs: numberFromEnv(env.BACKLINK_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    commonCrawlIndex: stringFromEnv(env.BACKLINK_CC_INDEX) ?? DEFAULT_CC_INDEX,
  };
}
