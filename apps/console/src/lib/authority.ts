/**
 * Domain authority from the open web link graph.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS, AND WHAT IT IS EMPHATICALLY NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * This is Open PageRank: classic PageRank recomputed over Common Crawl's public
 * domain-level webgraph (~90M naked domains, ~2B edges), published monthly.
 *
 * It is NOT Moz's Domain Authority, NOT Ahrefs' Domain Rating, and NOT Semrush's
 * Authority Score. Each of those is a proprietary metric computed over that
 * company's own private crawl, and none of them can be reproduced — legally or
 * technically — without paying for that company's API. Any free tool claiming to
 * return "DA" is either reselling Moz or making it up.
 *
 * Saying so is the product. The copy on /tools/authority must keep saying so:
 * the differentiator here is a metric whose inputs a reader can go download.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY AN API AND NOT THE RAW GRAPH
 * ─────────────────────────────────────────────────────────────────────────────
 * Common Crawl publishes the ranks themselves (cc-webgraph: PageRank + harmonic
 * centrality, on S3 under the AWS Open Data programme). We could own the index
 * outright by loading those files into Postgres — and we probably should, later.
 * But they are multi-gigabyte gzipped TSVs of ~90M rows: unqueryable from a
 * serverless function on a cold request. The API is the same data, hosted.
 *
 * So the provider is deliberately behind one narrow interface (`AuthorityProvider`).
 * Swapping in a self-hosted table later means implementing that one function and
 * changing nothing else in the route or the page.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ UNVERIFIED AGAINST THE LIVE API
 * ─────────────────────────────────────────────────────────────────────────────
 * Open PageRank moved hosts (domcop.com → openpagerank.keywordseverywhere.com) and
 * the request/response shape below is transcribed from the current published docs.
 * It has NOT been exercised against the live service, because that needs a free
 * API key nobody has claimed yet (OPENPAGERANK_API_KEY).
 *
 * The parser is therefore TOTAL: every field is validated, and anything unexpected
 * raises `AuthorityError('upstream_shape')` naming the field rather than silently
 * yielding `undefined` and rendering a blank score. A wrong guess about the schema
 * fails loudly on the first real call instead of shipping a plausible-looking zero.
 * (See the memory on verification methods that lie: a tool that renders "0" because
 * a field was renamed is worse than one that renders an error.)
 */

/** Where a score came from. Widen this union when a second provider lands. */
export type AuthoritySource = 'open-pagerank';

/** One monthly observation of a domain's score. */
export interface AuthorityHistoryPoint {
  /** ISO-ish month stamp as published upstream (e.g. "2026-08"). */
  date: string;
  /** Open PageRank, 0–10, two decimals upstream. */
  openPageRank: number;
  /** True when upstream interpolated this month rather than observing it. */
  estimated: boolean;
}

/** A single domain's authority reading. */
export interface AuthorityResult {
  /** The naked domain actually queried (lowercased, no scheme/www/path). */
  domain: string;
  /** False when the domain is absent from the graph — a real answer, not an error. */
  found: boolean;
  /** Open PageRank 0–10, or null when `found` is false. */
  openPageRank: number | null;
  /** Global position in the graph (1 = strongest), or null when absent. */
  rank: number | null;
  /** Distinct referring domains counted by the graph, or null when not supplied. */
  referringDomains: number | null;
  /** Oldest-first monthly history. Empty when history was not requested or is absent. */
  history: readonly AuthorityHistoryPoint[];
}

/** A whole lookup, including the crawl date the numbers describe. */
export interface AuthorityReport {
  /** The graph build these numbers come from, as published upstream. */
  asOf: string;
  source: AuthoritySource;
  results: readonly AuthorityResult[];
  /** Inputs upstream rejected as unparseable domains. */
  invalid: readonly string[];
}

/** Failure modes the UI distinguishes. Each maps to different copy. */
export type AuthorityErrorCode =
  /** No API key configured — an operator problem, not a user problem. */
  | 'not_configured'
  /** Caller passed nothing usable. */
  | 'bad_input'
  /** Upstream said no (bad key, quota exhausted, rate limited). */
  | 'upstream_rejected'
  /** Upstream answered, but not in the shape we parse. See the ⚠ note above. */
  | 'upstream_shape'
  /** Network failure or timeout. */
  | 'unreachable';

export class AuthorityError extends Error {
  readonly code: AuthorityErrorCode;
  constructor(code: AuthorityErrorCode, message: string) {
    super(message);
    this.name = 'AuthorityError';
    this.code = code;
  }
}

/** The one seam a future self-hosted Common Crawl table would implement. */
export type AuthorityProvider = (domains: readonly string[]) => Promise<AuthorityReport>;

const API_BASE = 'https://openpagerank.keywordseverywhere.com';
/** Upstream caps a bulk call at 100 domains. */
export const MAX_DOMAINS_PER_LOOKUP = 100;
/** Serverless-friendly ceiling; the call is a single index read, not a crawl. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Reduce user input to the naked domain the graph is keyed by.
 *
 * The graph's nodes are registrable domains, so `https://www.Example.com/pricing?a=1`
 * and `example.com` must collapse to the same key or the tool reports "not found"
 * for a site that is plainly in the index. Returns null for anything that is not a
 * hostname (an empty string, an IP, a bare word with no dot).
 */
export function normalizeDomain(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === '') return null;

  let host: string;
  try {
    // A scheme is required for the URL parser to treat the input as a host rather
    // than a path, so add one when the user omitted it (they usually do).
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    host = new URL(withScheme).hostname;
  } catch {
    return null;
  }

  // `www` is a host, not a domain: the graph keys on the registrable name, and
  // leaving the prefix on is the single most likely cause of a false "not found".
  const bare = host.startsWith('www.') ? host.slice(4) : host;

  // Reject IPs and single-label hosts — neither is a node in a domain-level graph.
  if (!bare.includes('.')) return null;
  if (/^[\d.]+$/.test(bare)) return null;
  return bare;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Parse one upstream result entry, failing loudly on an unexpected shape. */
function parseResult(entry: unknown, index: number): AuthorityResult {
  if (typeof entry !== 'object' || entry === null) {
    throw new AuthorityError('upstream_shape', `results[${index}] is not an object.`);
  }
  const row = entry as Record<string, unknown>;

  const domain = row.domain;
  if (typeof domain !== 'string' || domain === '') {
    throw new AuthorityError('upstream_shape', `results[${index}].domain is missing.`);
  }

  // `found` absent is treated as "present in the graph" only when a score came back;
  // inferring `true` unconditionally would render a 0 for an unknown domain.
  const score = asFiniteNumber(row.open_page_rank);
  const found = typeof row.found === 'boolean' ? row.found : score !== null;

  const rawHistory = row.history;
  const history: AuthorityHistoryPoint[] = [];
  if (Array.isArray(rawHistory)) {
    for (const point of rawHistory) {
      if (typeof point !== 'object' || point === null) continue;
      const p = point as Record<string, unknown>;
      const at = p.date;
      const opr = asFiniteNumber(p.open_page_rank);
      if (typeof at !== 'string' || opr === null) continue;
      history.push({ date: at, openPageRank: opr, estimated: p.estimated === true });
    }
    // Oldest-first, so a sparkline can be drawn straight off the array.
    history.sort((a, b) => a.date.localeCompare(b.date));
  }

  return {
    domain,
    found,
    openPageRank: found ? score : null,
    rank: asFiniteNumber(row.rank),
    referringDomains: asFiniteNumber(row.referring_domains),
    history,
  };
}

/** Parse the whole bulk response. */
export function parseAuthorityResponse(payload: unknown): AuthorityReport {
  if (typeof payload !== 'object' || payload === null) {
    throw new AuthorityError('upstream_shape', 'Response body was not a JSON object.');
  }
  const body = payload as Record<string, unknown>;

  const results = body.results;
  if (!Array.isArray(results)) {
    throw new AuthorityError('upstream_shape', 'Response had no `results` array.');
  }

  const invalid = Array.isArray(body.invalid)
    ? body.invalid.filter((v): v is string => typeof v === 'string')
    : [];

  return {
    asOf: typeof body.as_of === 'string' ? body.as_of : 'unknown',
    source: 'open-pagerank',
    results: results.map(parseResult),
    invalid,
  };
}

export interface LookupOptions {
  /** Injectable for offline tests. */
  fetchImpl?: typeof fetch;
  /** Injectable environment; secrets are read only from here and never logged. */
  env?: Record<string, string | undefined>;
  /** Ask upstream for the monthly series. Off for bulk callers that only need today. */
  includeHistory?: boolean;
}

/**
 * Look up authority for up to `MAX_DOMAINS_PER_LOOKUP` domains in one call.
 *
 * Inputs are normalized and de-duplicated first: the free tier is metered per
 * domain per month, so sending `example.com` twice spends quota twice.
 */
export async function lookupAuthority(
  rawDomains: readonly string[],
  options: LookupOptions = {},
): Promise<AuthorityReport> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;

  const apiKey = env.OPENPAGERANK_API_KEY?.trim();
  if (apiKey === undefined || apiKey === '') {
    throw new AuthorityError(
      'not_configured',
      'OPENPAGERANK_API_KEY is not set, so authority lookups are unavailable.',
    );
  }

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(`${API_BASE}/v1/domains/bulk`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        domains,
        include_history: options.includeHistory !== false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    // Never interpolate the key or the error's own request details into this message.
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timed out' : 'failed';
    throw new AuthorityError('unreachable', `The authority index request ${reason}.`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // 401/403 = bad key, 429 = quota or rate limit. All are operator-side; the user
    // gets one honest sentence rather than a number we do not have.
    throw new AuthorityError(
      'upstream_rejected',
      `The authority index refused the request (HTTP ${response.status}).`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AuthorityError('upstream_shape', 'Response body was not valid JSON.');
  }

  return parseAuthorityResponse(payload);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * PRESENTATION — one deliberate gap, see the note below.
 * ────────────────────────────────────────────────────────────────────────── */

/** A reader-facing reading of a raw score. */
export interface AuthorityVerdict {
  /** Short band name shown beside the figure, e.g. "Establishing". */
  band: string;
  /** One sentence telling the reader what the band means for them. */
  meaning: string;
  /** Which state colour the figure wears: ok / warn / neutral. */
  tone: 'ok' | 'warn' | 'neutral';
}

/**
 * TODO(lucas): implement the band mapping — see the hand-off in the session notes.
 *
 * WHY THIS ONE IS YOURS, NOT MINE
 * Open PageRank is 0–10 and roughly logarithmic: the gap from 3 to 4 is a different
 * amount of work from 6 to 7, and the median indexed domain sits near 2–3. So the
 * bands are not arithmetic thirds, and where you put the cut points is a positioning
 * call, not a maths one:
 *
 *   - Cut generously and most visitors see a flattering band, bounce, and never book.
 *   - Cut harshly and the tool reads as a scare-ware funnel, which is the exact
 *     thing the "we tell you what the metric can't do" angle is selling against.
 *   - advancelabs.dev itself scores in here. Pick bands you'd be happy to publish
 *     your own number against.
 *
 * Suggested shape (5–10 lines): a `const BANDS` array of { min, band, meaning, tone }
 * ordered high→low, and a `.find(b => score >= b.min)`. Handle `score === null`
 * (absent from the graph) as its own case — "not in the index" is not "score 0",
 * and conflating them would be the same class of lie as rendering a blank as a zero.
 */
export function describeAuthority(_score: number | null): AuthorityVerdict {
  throw new Error('describeAuthority is not implemented yet — see the TODO above.');
}
