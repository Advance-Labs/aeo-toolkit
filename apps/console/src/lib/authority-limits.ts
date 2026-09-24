/**
 * Two backstops in front of the authority index: a per-caller rate limit and a
 * global monthly budget.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT EACH ONE IS ACTUALLY FOR
 * ─────────────────────────────────────────────────────────────────────────────
 * They protect different things and are not interchangeable.
 *
 *   - The RATE LIMIT stops one caller monopolising the tool. The endpoint takes
 *     100 domains per call, so a loop is a bulk-export pipeline someone else is
 *     running on our quota.
 *
 *   - The BUDGET stops everyone, collectively and politely, from spending the
 *     month's 30,000 domains. Cache misses are the only thing that costs, so it
 *     meters misses, not requests.
 *
 * The cache in `authority-cache.ts` is the real defence. These exist for the case
 * the cache cannot help with: a stream of distinct, never-seen domains.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THESE COUNTERS ARE NOT ATOMIC, AND THAT IS A DELIBERATE TRADE
 * ─────────────────────────────────────────────────────────────────────────────
 * Runtime Cache has no compare-and-swap, so `read, add, write` races under
 * concurrency and the counter UNDERCOUNTS. Two simultaneous requests can both read
 * 10 and both write 11.
 *
 * This is stated plainly rather than papered over, because the alternative shapes
 * the budget: the ceiling is set BELOW the real quota so that drift is absorbed by
 * headroom instead of by a surprise. An exact limiter needs Redis or a Postgres
 * row lock, and neither is worth provisioning for a free tool whose failure mode
 * is "an honest sentence instead of a number".
 *
 * If this ever guards something billable, replace the store, not the callers.
 */
import { getCache } from '@vercel/functions';
import type { AuthorityCacheStore } from './authority-cache';

/** Requests one caller may make per window. */
export const RATE_LIMIT_REQUESTS = 20;
/** Domains one caller may submit per window, across those requests. */
export const RATE_LIMIT_DOMAINS = 150;
/** Window length. Short enough to forgive a mistake, long enough to stop a loop. */
export const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

/**
 * Monthly ceiling on upstream domain fetches.
 *
 * The free tier is 30,000. This sits below it on purpose: see the note on
 * non-atomic counters above, and leave room for the cache-warming cron and for
 * hand-testing during a launch.
 */
export const DEFAULT_MONTHLY_BUDGET = 25_000;

export type LimitCode = 'rate_limited' | 'quota_exhausted';

export interface LimitDecision {
  allowed: boolean;
  code?: LimitCode;
  message?: string;
  /** Seconds until the caller could reasonably retry. Surfaced as `Retry-After`. */
  retryAfterSeconds?: number;
}

const ALLOWED: LimitDecision = { allowed: true };

export interface LimitOptions {
  /** Injectable for tests; defaults to the Vercel Runtime Cache. */
  store?: AuthorityCacheStore;
  /** Injectable clock, so window-boundary behaviour is testable without waiting. */
  now?: () => number;
  env?: Record<string, string | undefined>;
}

function defaultStore(): AuthorityCacheStore {
  const cache = getCache();
  return {
    get: (key) => cache.get(key),
    set: (key, value, options) => cache.set(key, value, options),
  };
}

/** Read a counter, treating anything unparseable as zero rather than throwing. */
async function readCounter(store: AuthorityCacheStore, key: string): Promise<number> {
  try {
    const value = await store.get(key);
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    // Runtime Cache round-trips through JSON, so a bare number can come back as a
    // string depending on the backing store. Accept both rather than silently
    // resetting a live counter to zero.
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    return 0;
  } catch {
    // A store failure must not become a 500 on a free tool. Failing OPEN is the
    // right call here: the budget is the real ceiling, and it is checked separately.
    return 0;
  }
}

async function writeCounter(
  store: AuthorityCacheStore,
  key: string,
  value: number,
  ttl: number,
): Promise<void> {
  try {
    await store.set(key, value, { ttl, tags: ['authority-limits'] });
  } catch {
    // Losing a write loosens the limit for one window. It never blocks the answer.
  }
}

/**
 * The caller's identity for limiting purposes.
 *
 * `x-forwarded-for` is the leftmost entry on Vercel, and it is spoofable in
 * general. That is acceptable: this is a fairness mechanism on a free endpoint,
 * not an authentication boundary, and the budget below catches what it misses.
 * Callers with no identifiable address share one bucket, which is strict rather
 * than permissive and is the correct direction to err.
 */
export function callerKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first !== undefined && first !== '') return first;
  const real = request.headers.get('x-real-ip')?.trim();
  if (real !== undefined && real !== '') return real;
  return 'unidentified';
}

/**
 * Decide whether this caller may proceed, and record the attempt.
 *
 * Called BEFORE the lookup, because the point is to avoid the upstream call.
 * `domainCount` is the number of domains in the body, which is what the caller is
 * asking to spend even if the cache ends up serving most of it.
 */
export async function checkRateLimit(
  caller: string,
  domainCount: number,
  options: LimitOptions = {},
): Promise<LimitDecision> {
  const store = options.store ?? defaultStore();
  const now = (options.now ?? Date.now)();

  // A fixed window, not a sliding one: it is one read and one write instead of a
  // sorted set, and the failure mode (a burst straddling a boundary) is harmless
  // for a lookup tool.
  const window = Math.floor(now / 1000 / RATE_LIMIT_WINDOW_SECONDS);
  const secondsIntoWindow = Math.floor(now / 1000) % RATE_LIMIT_WINDOW_SECONDS;
  const retryAfterSeconds = RATE_LIMIT_WINDOW_SECONDS - secondsIntoWindow;

  const requestKey = `authority:rl:${window}:req:${caller}`;
  const domainKey = `authority:rl:${window}:dom:${caller}`;

  const [requests, domains] = await Promise.all([
    readCounter(store, requestKey),
    readCounter(store, domainKey),
  ]);

  if (requests >= RATE_LIMIT_REQUESTS) {
    return {
      allowed: false,
      code: 'rate_limited',
      message: `Too many lookups from this address. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
      retryAfterSeconds,
    };
  }

  if (domains + domainCount > RATE_LIMIT_DOMAINS) {
    return {
      allowed: false,
      code: 'rate_limited',
      message: `Too many domains from this address in one window. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
      retryAfterSeconds,
    };
  }

  // Recorded even when the lookup later fails: a request that errored still
  // consumed our attention, and not counting it makes the limiter loopable.
  const ttl = retryAfterSeconds + 5;
  await Promise.all([
    writeCounter(store, requestKey, requests + 1, ttl),
    writeCounter(store, domainKey, domains + domainCount, ttl),
  ]);

  return ALLOWED;
}

function monthKey(now: number): string {
  const date = new Date(now);
  const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return `authority:budget:${month}`;
}

function budgetCeiling(env: Record<string, string | undefined>): number {
  const raw = env.AUTHORITY_MONTHLY_DOMAIN_BUDGET?.trim();
  if (raw === undefined || raw === '') return DEFAULT_MONTHLY_BUDGET;
  const parsed = Number(raw);
  // An unparseable override falls back to the safe default rather than to
  // Infinity, which would quietly disable the only thing protecting the quota.
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MONTHLY_BUDGET;
}

/**
 * Whether the month's upstream budget still has room.
 *
 * Checked before the lookup. It does not reserve: reserving would need the
 * atomicity this store lacks, and over-reserving on a request the cache ends up
 * serving for free would waste more budget than the drift it prevents.
 */
export async function checkMonthlyBudget(options: LimitOptions = {}): Promise<LimitDecision> {
  const store = options.store ?? defaultStore();
  const now = (options.now ?? Date.now)();
  const env = options.env ?? process.env;

  const spent = await readCounter(store, monthKey(now));
  if (spent < budgetCeiling(env)) return ALLOWED;

  // The honest sentence, in the same register as `not_configured`: our limit, our
  // problem, said as ours. It is emphatically not "your domain has no authority".
  return {
    allowed: false,
    code: 'quota_exhausted',
    message:
      'This month’s lookup budget for the free index is spent. The checker is fine and your domain is fine; we have simply run out of calls until the quota resets.',
  };
}

/**
 * Record what a completed lookup actually cost upstream.
 *
 * Takes the miss count, not the request's domain count: cache hits cost nothing,
 * and metering them would exhaust a 25,000 budget on maybe 2,000 real lookups.
 */
export async function recordSpend(misses: number, options: LimitOptions = {}): Promise<void> {
  if (misses <= 0) return;
  const store = options.store ?? defaultStore();
  const now = (options.now ?? Date.now)();
  const key = monthKey(now);

  const spent = await readCounter(store, key);
  // 40 days: comfortably past any month end, so the key expires on its own rather
  // than needing a sweep, while never expiring mid-month and zeroing the count.
  await writeCounter(store, key, spent + misses, 40 * 24 * 60 * 60);
}
