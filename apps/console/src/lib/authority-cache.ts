/**
 * A per-domain cache in front of the authority index.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The free tier meters 30,000 domains per month, and `lookupAuthority` spends one
 * unit per domain per call. A launch post that puts a few thousand people on
 * /tools/authority would burn the month in an afternoon, and the failure is not
 * graceful: once the quota is gone every visitor gets the honest "index refused
 * the request" sentence. The tool whose entire pitch is that it does not lie to
 * you would spend its launch day telling everyone it is broken.
 *
 * Caching is the lever that makes that unlikely. Launch traffic is overwhelmingly
 * repeat lookups of a small set of domains: people check their own site, then the
 * two competitors named in the post, then whatever domain the top comment is
 * arguing about. Those collapse to a handful of upstream reads.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY PER DOMAIN AND NOT PER REQUEST
 * ─────────────────────────────────────────────────────────────────────────────
 * The route accepts up to 100 domains in one body, so caching whole responses
 * would miss on every batch that differs by a single entry while still spending
 * 100 units. Caching each domain separately means a 100-domain batch with 99
 * previously-seen entries costs exactly one upstream unit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY 24 HOURS IS NOT AGGRESSIVE
 * ─────────────────────────────────────────────────────────────────────────────
 * Common Crawl rebuilds the webgraph MONTHLY, so a figure can be up to a month
 * old at the source no matter what we do. A 24-hour TTL is therefore an order of
 * magnitude fresher than the data itself, and `asOf` on the report tells the
 * reader which graph build they are looking at regardless.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT A CACHE MUST NOT DO HERE
 * ─────────────────────────────────────────────────────────────────────────────
 * The same rule as the rest of this feature: a cache miss, a decode failure or an
 * unavailable cache must never turn into a rendered number. Every read is
 * defensive and any entry that does not parse is discarded and re-fetched rather
 * than trusted. The key carries a schema version so that a deploy that changes
 * `AuthorityResult` cannot serve yesterday's shape into today's parser.
 */
import { getCache } from '@vercel/functions';
import { MAX_DOMAINS_PER_LOOKUP, AuthorityError, lookupAuthority, normalizeDomain } from './authority';
import type { AuthorityReport, AuthorityResult, LookupOptions } from './authority';

/**
 * Bump when the cached shape changes. Old entries then miss rather than decode
 * into a type they predate, which is the difference between a stale number and a
 * wrong one.
 */
const CACHE_SCHEMA_VERSION = 'v1';

/** One day. See the note above on why this is conservative, not aggressive. */
export const DOMAIN_TTL_SECONDS = 24 * 60 * 60;

/** Lets `invalidateByTag('authority')` drop every entry at once if upstream corrects a build. */
const CACHE_TAG = 'authority';

/**
 * The two operations this module needs from a cache, so tests can supply a Map and
 * production can supply Vercel's Runtime Cache without either knowing about the other.
 */
export interface AuthorityCacheStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, options?: { ttl?: number; tags?: string[] }): Promise<void>;
}

/** What we persist per domain. `asOf` rides along so a hit still knows its graph build. */
interface CachedEntry {
  asOf: string;
  result: AuthorityResult;
}

function cacheKey(domain: string, includeHistory: boolean): string {
  // History is part of the identity: an entry fetched without it has an empty
  // `history`, and serving that to a caller that asked for the series would render
  // a score with no sparkline and no way to tell that the data was simply not requested.
  return `authority:${CACHE_SCHEMA_VERSION}:${includeHistory ? 'h' : 'n'}:${domain}`;
}

/**
 * Validate an entry read back from the cache.
 *
 * Deliberately total, for the same reason `parseAuthorityResponse` is: the cache is
 * a second untrusted input. Anything shaped unexpectedly returns null and becomes a
 * miss, which costs one upstream unit and is always the right trade against
 * rendering a partially-decoded result.
 */
function decodeEntry(value: unknown): CachedEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.asOf !== 'string') return null;

  const result = entry.result;
  if (typeof result !== 'object' || result === null) return null;
  const row = result as Record<string, unknown>;

  if (typeof row.domain !== 'string' || row.domain === '') return null;
  if (typeof row.found !== 'boolean') return null;

  const numberOrNull = (v: unknown): boolean => v === null || (typeof v === 'number' && Number.isFinite(v));
  if (!numberOrNull(row.openPageRank)) return null;
  if (!numberOrNull(row.rank)) return null;
  if (!numberOrNull(row.referringDomains)) return null;
  if (!Array.isArray(row.history)) return null;

  return { asOf: entry.asOf, result: result as unknown as AuthorityResult };
}

/** Production store: Vercel Runtime Cache, shared across function invocations in a region. */
function defaultStore(): AuthorityCacheStore {
  const cache = getCache();
  return {
    get: (key) => cache.get(key),
    set: (key, value, options) => cache.set(key, value, options),
  };
}

export interface CachedLookupOptions extends LookupOptions {
  /** Injectable for tests; defaults to the Vercel Runtime Cache. */
  store?: AuthorityCacheStore;
  /** Set false to bypass reads while still writing. Used by the cache-warming cron. */
  readThrough?: boolean;
}

/** What a lookup cost, so the caller can meter the quota it actually spent. */
export interface CachedLookupOutcome {
  report: AuthorityReport;
  /** Domains answered from cache. These cost nothing upstream. */
  hits: number;
  /** Domains fetched live. These are the units billed against the monthly tier. */
  misses: number;
}

/**
 * Look up authority, reading through a per-domain cache.
 *
 * Normalization and de-duplication happen here rather than being left to
 * `lookupAuthority`, because the cache has to be keyed by the same normalized
 * domain the index is keyed by. `https://WWW.Example.com/pricing` and `example.com`
 * are one cache entry and one quota unit, not two.
 *
 * A cache that is unreachable degrades to a plain live lookup: cache failures are
 * swallowed, never surfaced, because the caller asked about a domain and the cache
 * being down is not an answer to that question.
 */
export async function lookupAuthorityCached(
  rawDomains: readonly string[],
  options: CachedLookupOptions = {},
): Promise<CachedLookupOutcome> {
  const includeHistory = options.includeHistory !== false;
  const store = options.store ?? defaultStore();

  const seen = new Set<string>();
  for (const raw of rawDomains) {
    const normalized = normalizeDomain(raw);
    if (normalized !== null) seen.add(normalized);
    if (seen.size >= MAX_DOMAINS_PER_LOOKUP) break;
  }
  const domains = [...seen];
  if (domains.length === 0) {
    throw new AuthorityError('bad_input', 'No valid domain was supplied.');
  }

  const cached = new Map<string, CachedEntry>();
  if (options.readThrough !== false) {
    await Promise.all(
      domains.map(async (domain) => {
        try {
          const entry = decodeEntry(await store.get(cacheKey(domain, includeHistory)));
          if (entry !== null) cached.set(domain, entry);
        } catch {
          // A cache read failure is a miss. It is never an error the user sees.
        }
      }),
    );
  }

  const misses = domains.filter((domain) => !cached.has(domain));

  let fetchedAsOf: string | null = null;
  let invalid: readonly string[] = [];
  const fetched = new Map<string, AuthorityResult>();

  if (misses.length > 0) {
    const report = await lookupAuthority(misses, options);
    fetchedAsOf = report.asOf;
    invalid = report.invalid;
    for (const result of report.results) {
      fetched.set(result.domain, result);
      try {
        await store.set(
          cacheKey(result.domain, includeHistory),
          { asOf: report.asOf, result } satisfies CachedEntry,
          { ttl: DOMAIN_TTL_SECONDS, tags: [CACHE_TAG] },
        );
      } catch {
        // Failing to persist costs a unit next time. It does not affect this answer.
      }
    }
  }

  // Preserve the caller's order. A response whose rows do not line up with the
  // submitted list is a subtle way to attribute one site's score to another.
  const results: AuthorityResult[] = [];
  for (const domain of domains) {
    const hit = cached.get(domain);
    if (hit !== undefined) {
      results.push(hit.result);
      continue;
    }
    const live = fetched.get(domain);
    if (live !== undefined) results.push(live);
    // A domain in neither map was rejected upstream and is reported via `invalid`.
  }

  // Prefer the freshest graph build any row came from, so `asOf` never claims a
  // build older than data actually shown beside it.
  const asOfCandidates = [fetchedAsOf, ...[...cached.values()].map((e) => e.asOf)].filter(
    (v): v is string => typeof v === 'string' && v !== 'unknown',
  );
  const asOf = asOfCandidates.length > 0 ? asOfCandidates.sort().at(-1)! : 'unknown';

  return {
    report: { asOf, source: 'open-pagerank', results, invalid },
    hits: cached.size,
    misses: misses.length,
  };
}
