/**
 * CommonCrawl URL-index adapter.
 *
 * CommonCrawl publishes a public, free columnar index of the URLs it has crawled.
 * Each monthly crawl exposes a CDX-style HTTP endpoint at
 * `https://index.commoncrawl.org/<CRAWL>-index?url=<encoded>*&output=json` that
 * returns **newline-delimited JSON** (one capture object per line, NOT a JSON
 * array). We query it with a host wildcard to discover third-party pages that
 * CommonCrawl has seen referencing (or hosted under) a given domain — a free,
 * supplementary signal alongside DuckDuckGo for mention / link-source discovery.
 *
 * Like the other free sources this is inherently brittle: the crawl identifier
 * rolls forward each month, the endpoint rate-limits aggressive callers, and a
 * single malformed line must not sink the whole response. Every fragile point is
 * marked `// STUB:` and the parser degrades to whatever it could read plus a
 * `warnings[]` entry — it never throws.
 */
import type { HttpClient } from './http.js';

/**
 * Fallback crawl index, used ONLY when {@link resolveLatestIndex} cannot reach
 * CommonCrawl's collection listing. CommonCrawl ships a new monthly crawl
 * (`CC-MAIN-YYYY-WW`) and retires old index paths, so a hard-pinned id eventually
 * 404s — which is exactly what broke the live graph. Prefer the dynamically
 * resolved latest index; this constant is just a last-resort, recent-known-good id.
 */
export const DEFAULT_CC_INDEX = 'CC-MAIN-2026-21';

const CC_INDEX_HOST = 'https://index.commoncrawl.org';

/** Public collection listing: a JSON array of `{ id, name, cdx-api, ... }`, newest first. */
const CC_COLLINFO_URL = `${CC_INDEX_HOST}/collinfo.json`;

/**
 * In-process cache of the resolved latest index id. CommonCrawl publishes a new
 * crawl roughly monthly and keeps the listing stable between, so resolving once
 * per server instance (cold start) is both correct and polite. Only a *real*
 * resolved id is cached — a failed lookup falls back to {@link DEFAULT_CC_INDEX}
 * without poisoning the cache, so a transient outage doesn't pin the fallback.
 */
let cachedLatestIndex: string | null = null;

/** Test-only: clear the resolved-index cache so cases don't leak state across each other. */
export function resetLatestIndexCache(): void {
  cachedLatestIndex = null;
}

/**
 * Resolve the newest CommonCrawl index id from `collinfo.json` (the canonical list
 * of available crawls, newest first), through the injectable {@link HttpClient}.
 *
 * This is the fix for the stale-index 404: rather than hard-pinning a crawl id that
 * CommonCrawl eventually retires, we read the current latest at runtime and cache
 * it. Never throws — any failure (transport, non-JSON, unexpected shape) silently
 * degrades to {@link DEFAULT_CC_INDEX} so a build still proceeds.
 */
export async function resolveLatestIndex(http: HttpClient): Promise<string> {
  if (cachedLatestIndex !== null) return cachedLatestIndex;

  const res = await http.getText(CC_COLLINFO_URL, { accept: 'application/json' });
  if (res.ok && res.body !== '') {
    try {
      const parsed: unknown = JSON.parse(res.body);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        if (typeof first === 'object' && first !== null) {
          const id = (first as Record<string, unknown>).id;
          if (typeof id === 'string' && id.trim() !== '') {
            cachedLatestIndex = id.trim();
            return cachedLatestIndex;
          }
        }
      }
    } catch {
      // fall through to the fallback id
    }
  }
  // Don't cache the fallback — a later request can still resolve the real latest.
  return DEFAULT_CC_INDEX;
}

export interface CommonCrawlCapture {
  /** The captured URL. */
  url: string;
  /** Host extracted from {@link url}, lowercased and `www.`-stripped. */
  host: string;
  /** HTTP status the crawler recorded for the capture, when present. */
  status?: string;
  /** MIME type the crawler recorded, when present. */
  mime?: string;
  /** 14-digit capture timestamp, when present. */
  timestamp?: string;
}

export interface CommonCrawlOutcome {
  captures: CommonCrawlCapture[];
  /** Non-fatal problems (blocked, empty, malformed lines) surfaced to the caller. */
  warnings: string[];
}

export interface CommonCrawlOptions {
  /** Override the crawl index id (default {@link DEFAULT_CC_INDEX}). */
  index?: string;
  /** Max captures to return (the endpoint can return tens of thousands). */
  limit?: number;
}

/**
 * Build the CommonCrawl index query URL.
 *
 * We append `*` to the domain to match the host and everything beneath it, and
 * request `output=json` for the newline-delimited JSON body. `limit` is passed to
 * the server so we do not download an unbounded result set.
 */
export function buildIndexUrl(domain: string, index: string, limit: number): string {
  const base = `${CC_INDEX_HOST}/${index}-index`;
  const params = new URLSearchParams({
    // Host wildcard: `example.com*` matches the apex and any path/subpath capture.
    url: `${domain}*`,
    output: 'json',
    limit: String(limit),
  });
  return `${base}?${params.toString()}`;
}

/** Extract a normalised host from a URL string, or `''` when unparseable. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** Read a string field from a parsed capture record, tolerating missing keys. */
function field(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

/**
 * Parse a newline-delimited JSON body into captures. Pure: takes the raw body,
 * returns captures plus any per-line warnings — no network. A malformed or
 * non-object line is skipped (counted once in the warnings) rather than thrown,
 * so one bad line never discards the good ones. Exported for direct unit testing.
 */
export function parseNdjson(body: string): { captures: CommonCrawlCapture[]; malformed: number } {
  const captures: CommonCrawlCapture[] = [];
  let malformed = 0;

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (line === '') continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      // STUB: CommonCrawl occasionally emits a truncated or non-JSON line under
      // load (or a trailing status line). Skip it; don't sink the whole batch.
      malformed += 1;
      continue;
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      malformed += 1;
      continue;
    }

    const record = parsed as Record<string, unknown>;
    const url = field(record, 'url');
    if (url === undefined) {
      malformed += 1;
      continue;
    }

    const host = hostOf(url);
    if (host === '') {
      malformed += 1;
      continue;
    }

    const capture: CommonCrawlCapture = { url, host };
    const status = field(record, 'status');
    if (status !== undefined) capture.status = status;
    const mime = field(record, 'mime') ?? field(record, 'mime-detected');
    if (mime !== undefined) capture.mime = mime;
    const timestamp = field(record, 'timestamp');
    if (timestamp !== undefined) capture.timestamp = timestamp;

    captures.push(capture);
  }

  return { captures, malformed };
}

/**
 * Detect a CommonCrawl error/coverage interstitial. The index endpoint returns a
 * plain-text "No Captures found" / "not found" body (not NDJSON) when a crawl id
 * is wrong or a domain is uncrawled, so we surface a warning rather than logging a
 * spurious "0 results parsed".
 */
function looksEmptyOrBlocked(body: string): boolean {
  const lowered = body.toLowerCase();
  return (
    lowered.includes('no captures found') ||
    lowered.includes('not found') ||
    lowered.includes('blocked') ||
    lowered.includes('rate limit') ||
    lowered.includes('too many requests')
  );
}

/**
 * Query the CommonCrawl index for captures under `domain` through the injectable
 * {@link HttpClient}. Never throws: a network failure, an error/coverage page, an
 * empty body, or malformed lines all degrade to whatever captures we could read
 * plus an explanatory warning.
 */
export async function queryIndex(
  http: HttpClient,
  domain: string,
  options: CommonCrawlOptions = {},
): Promise<CommonCrawlOutcome> {
  const warnings: string[] = [];
  const trimmed = domain
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
  if (trimmed === '') {
    return { captures: [], warnings: ['Empty domain for CommonCrawl lookup.'] };
  }

  const index = options.index?.trim() || DEFAULT_CC_INDEX;
  const limit = options.limit && options.limit > 0 ? options.limit : 50;

  const res = await http.getText(buildIndexUrl(trimmed, index, limit), {
    accept: 'application/x-ndjson, application/json',
  });

  if (!res.ok || res.body === '') {
    warnings.push(
      `CommonCrawl request failed (status ${res.status}). Returning no captures; try again later.`,
    );
    return { captures: [], warnings };
  }

  if (looksEmptyOrBlocked(res.body)) {
    warnings.push(
      `CommonCrawl returned no captures or a rate-limit page for "${trimmed}" in ${index}.`,
    );
    return { captures: [], warnings };
  }

  const { captures, malformed } = parseNdjson(res.body);
  if (malformed > 0) {
    warnings.push(`Skipped ${malformed} malformed CommonCrawl line(s) (degraded parse).`);
  }
  if (captures.length === 0) {
    warnings.push(
      'No usable CommonCrawl captures parsed (markup may have changed, or none found).',
    );
  }

  return { captures: captures.slice(0, limit), warnings };
}
