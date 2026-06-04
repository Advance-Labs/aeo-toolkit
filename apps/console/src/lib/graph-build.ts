/**
 * Server-side wrapper over `@aeo/backlinks#buildBacklinkGraph`.
 *
 * Owns the production wiring the engine leaves to the caller: a polite,
 * rate-limited `HttpClient`, a per-build page `limit` resolved from `opts` then
 * `BACKLINK_GRAPH_LIMIT` (default 25), and an optional CommonCrawl monthly index
 * from `COMMONCRAWL_INDEX`. Secrets are read only from `env` and never logged.
 *
 * The builder itself is injectable so route/handler tests can run fully offline
 * without touching the network or the real engine.
 *
 * The rate limiter is a small in-process fixed-window limiter that satisfies the
 * `{ check(key): Promise<{ allowed; remaining; resetSeconds }> }` shape
 * `createRateLimitedHttpClient` consumes. The engine's own client fails *open* on
 * limiter error, so a single bucket here simply caps the aggregate outbound rate
 * to the free sources within one server instance.
 */
import {
  buildBacklinkGraph,
  createLiveHttpClient,
  createRateLimitedHttpClient,
} from '@aeo/backlinks';
import type { BacklinkGraph, BuildBacklinkGraphOptions } from '@aeo/backlinks';

/** Default per-source page cap when neither `opts` nor env supplies one. */
export const DEFAULT_BACKLINK_GRAPH_LIMIT = 25;
/** Max outbound scrapes per rolling window for the shared engine bucket. */
const SCRAPE_RATE_LIMIT = 60;
/** Rolling window length (ms) for the scrape limiter. */
const SCRAPE_WINDOW_MS = 60_000;
/** User-agent for the live client (identifies the tool to the free sources). */
const USER_AGENT = 'aeo-backlink-graph/0.1 (+https://github.com/aeo-toolkit)';

/** Result shape consumed by `createRateLimitedHttpClient`'s limiter contract. */
interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/** The minimal limiter contract `createRateLimitedHttpClient` calls into. */
interface ScrapeLimiter {
  check(key: string): Promise<RateLimitDecision>;
}

/**
 * A process-local fixed-window limiter. Single-instance (resets on cold start),
 * which is acceptable here: it exists to keep the *aggregate* scrape rate polite,
 * not to enforce a hard distributed quota.
 */
function createInMemoryScrapeLimiter(limit: number, windowMs: number): ScrapeLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    check(key: string): Promise<RateLimitDecision> {
      const now = Date.now();
      const win = windows.get(key);
      if (win === undefined || now >= win.resetAt) {
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return Promise.resolve({
          allowed: true,
          remaining: limit - 1,
          resetSeconds: Math.ceil(windowMs / 1000),
        });
      }
      win.count += 1;
      const resetSeconds = Math.max(0, Math.ceil((win.resetAt - now) / 1000));
      return Promise.resolve({
        allowed: win.count <= limit,
        remaining: Math.max(0, limit - win.count),
        resetSeconds,
      });
    },
  };
}

/**
 * Process-wide scrape limiter singleton so the in-memory window survives across
 * requests within one server instance.
 */
const scrapeLimiter: ScrapeLimiter = createInMemoryScrapeLimiter(
  SCRAPE_RATE_LIMIT,
  SCRAPE_WINDOW_MS,
);

/** The slice of options a caller may override per build. */
export interface BuildGraphOptions {
  /** Per-source page cap. Falls back to `BACKLINK_GRAPH_LIMIT`, then the default. */
  limit?: number;
}

/** The engine entry point, narrowed to the surface `buildGraph` depends on. */
export type GraphBuilder = (
  rootUrl: string,
  opts?: BuildBacklinkGraphOptions,
) => Promise<BacklinkGraph>;

/** Resolve the effective page limit from `opts`, then env, then the default. */
function resolveLimit(
  optsLimit: number | undefined,
  env: Record<string, string | undefined>,
): number {
  if (typeof optsLimit === 'number' && optsLimit > 0) return optsLimit;
  const raw = env.BACKLINK_GRAPH_LIMIT;
  if (raw !== undefined && raw.trim() !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_BACKLINK_GRAPH_LIMIT;
}

/**
 * Build a sampled backlink graph for `url`, wiring the engine with a rate-limited
 * HTTP client and env-derived configuration.
 *
 * @param url      the (already-validated) root URL to map
 * @param opts     optional per-build overrides (currently just `limit`)
 * @param builder  injectable engine fn (defaults to `buildBacklinkGraph`; tests pass a fake)
 * @param env      injectable environment (defaults to `process.env`)
 */
export function buildGraph(
  url: string,
  opts: BuildGraphOptions = {},
  builder: GraphBuilder = buildBacklinkGraph,
  env: Record<string, string | undefined> = process.env,
): Promise<BacklinkGraph> {
  const limit = resolveLimit(opts.limit, env);

  // 20s per request: the Wayback CDX domain scan (and a cold CommonCrawl index) can be slow from
  // serverless IPs; a 10s cap aborted Wayback (status 0) on Vercel, leaving CommonCrawl as the only
  // working source. Vercel functions allow far longer, so give the free fallback sources room.
  const http = createRateLimitedHttpClient(
    createLiveHttpClient({ userAgent: USER_AGENT, requestTimeoutMs: 20_000 }),
    scrapeLimiter,
  );

  const ccIndex = env.COMMONCRAWL_INDEX;
  const engineOpts: BuildBacklinkGraphOptions = { http, limit };
  if (ccIndex !== undefined && ccIndex.trim() !== '') {
    engineOpts.commonCrawlIndex = ccIndex;
  }

  return builder(url, engineOpts).then((graph) => {
    // DuckDuckGo reliably 403s from serverless IPs (it blocks datacenter ranges). That failure is
    // expected and not actionable by the user, and the graph is still populated by CommonCrawl +
    // Wayback — so drop the [duckduckgo] warning to avoid a permanent, alarming "provider failed"
    // banner. Real, transient warnings from the other sources are preserved.
    if (graph.warnings) {
      const kept = graph.warnings.filter((w) => !w.startsWith('[duckduckgo]'));
      if (kept.length > 0) graph.warnings = kept;
      else delete graph.warnings;
    }
    return graph;
  });
}
