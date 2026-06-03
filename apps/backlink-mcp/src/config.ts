/**
 * Runtime configuration for the backlink MCP server.
 *
 * Everything is environment-driven so the same registry runs identically under
 * stdio (local) and HTTP (hosted). The rate limit is intentionally conservative:
 * DuckDuckGo and the Wayback CDX endpoint both throttle/block aggressive
 * scraping, so we identify the client honestly and stay polite by default.
 */
import type { RateLimitConfig } from '@aeo/types';

export interface ServerConfig {
  name: string;
  version: string;
  /** Token-bucket rate limit applied to every tool call by `@aeo/mcp-core`. */
  rateLimit: RateLimitConfig;
  /** User-Agent sent on every outbound scrape/fetch — honest client identity. */
  userAgent: string;
  /** Per-request network timeout for outbound fetches (ms). */
  requestTimeoutMs: number;
}

export const SERVER_NAME = 'backlink-mcp';
export const SERVER_VERSION = '0.1.0';

/** Honest default identity; overridable via `BACKLINK_USER_AGENT`. */
export const DEFAULT_USER_AGENT =
  'aeo-backlink-mcp/0.1 (+https://github.com/aeo-toolkit; polite free-source link research)';

const DEFAULT_RATE_CAPACITY = 8;
const DEFAULT_RATE_REFILL_PER_SEC = 1;
const DEFAULT_TIMEOUT_MS = 15_000;

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
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    rateLimit: {
      capacity: numberFromEnv(env.BACKLINK_RATE_CAPACITY, DEFAULT_RATE_CAPACITY),
      refillPerSec: numberFromEnv(env.BACKLINK_RATE_REFILL_PER_SEC, DEFAULT_RATE_REFILL_PER_SEC),
    },
    userAgent: env.BACKLINK_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
    requestTimeoutMs: numberFromEnv(env.BACKLINK_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}
