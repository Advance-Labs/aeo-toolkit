/**
 * Defensive accessors over a {@link ScoringContext}.
 *
 * Rules read crawl / pages / structuredData arrays that may be empty and whose
 * indexes may be `undefined` under `noUncheckedIndexedAccess`. Centralizing the
 * guards here keeps each rule body small and avoids repeating the same
 * null-checks ~50 times across the three rule sets.
 */
import type {
  AiBotName,
  CrawledPage,
  ParsedHtml,
  ScoringContext,
  StructuredDataReport,
  Url,
} from '@advance-labs/types';

/** The AI bots whose access matters most for answer-engine visibility. */
export const KEY_AI_BOTS: readonly AiBotName[] = [
  'GPTBot',
  'ClaudeBot',
  'PerplexityBot',
  'OAI-SearchBot',
  'Google-Extended',
];

/** First parsed page, or `undefined` when no pages were parsed. */
export function firstPage(ctx: ScoringContext): ParsedHtml | undefined {
  return ctx.pages[0];
}

/** First structured-data report, or `undefined` when none exist. */
export function firstStructured(ctx: ScoringContext): StructuredDataReport | undefined {
  return ctx.structuredData[0];
}

/** All successfully-fetched HTML pages from the crawl (2xx status). */
export function okPages(ctx: ScoringContext): CrawledPage[] {
  return ctx.crawl.pages.filter((p) => p.ok && p.status >= 200 && p.status < 300);
}

/** Pages whose crawl status indicates a broken/error response (>=400). */
export function brokenPages(ctx: ScoringContext): CrawledPage[] {
  return ctx.crawl.pages.filter((p) => p.status >= 400 || (!p.ok && p.status !== 0));
}

/** URLs of pages with redirect chains longer than the given threshold. */
export function longRedirectChains(ctx: ScoringContext, maxHops: number): Url[] {
  const out: Url[] = [];
  for (const page of ctx.crawl.pages) {
    if (page.redirectChain.length > maxHops) out.push(page.url);
  }
  return out;
}

/**
 * URLs whose redirect chain revisits a URL it has already been to.
 *
 * Distinct from {@link longRedirectChains}: a loop is not a long chain. A chain that cycles
 * never terminates, so hop-count thresholds never fire on it — the request simply fails with
 * "too many redirects" and the page is invisible to crawlers and users alike.
 *
 * Includes the requested URL in the visited set, which catches the self-referential case
 * (a URL 3xx-ing to itself) that a chain-internal comparison alone would miss.
 */
export function redirectLoops(ctx: ScoringContext): Url[] {
  const out: Url[] = [];
  for (const page of ctx.crawl.pages) {
    if (page.redirectChain.length === 0) continue;
    const seen = new Set<string>([normalizeUrl(page.url)]);
    for (const hop of page.redirectChain) {
      const key = normalizeUrl(hop.url);
      if (seen.has(key)) {
        out.push(page.url);
        break;
      }
      seen.add(key);
    }
  }
  return out;
}

/**
 * Canonical key for comparing two URLs that address the same resource.
 *
 * Lowercases the host, drops the fragment, and collapses a bare trailing slash so
 * `https://Example.com/a/` and `https://example.com/a#x` compare equal. Deliberately KEEPS
 * the query string: `?a=1` and `?a=2` are usually different resources.
 *
 * Falls back to the trimmed input when the value will not parse, so a malformed URL compares
 * as itself rather than throwing inside a rule.
 */
export function normalizeUrl(raw: string, options: { keepFragment?: boolean } = {}): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    // Schema.org `@id` values are distinguished BY their fragment — `#organization` vs `#org`
    // are two different nodes on one page. Dropping it would silently merge them, so callers
    // comparing identifiers (rather than page addresses) must opt to keep it.
    if (!options.keepFragment) u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    // A bare origin renders as "https://host/" while "https://host#x" renders without the
    // slash; unify so the two forms of the same id compare equal.
    if (u.pathname === '/') u.pathname = '';
    return u.toString().toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/** True when at least one parsed page or crawled page exists to evaluate. */
export function hasAnyPage(ctx: ScoringContext): boolean {
  return ctx.pages.length > 0 || ctx.crawl.pages.length > 0;
}

/**
 * Aggregate the mean of a numeric per-page signal across all parsed pages.
 * Returns the fallback when there are no pages to average.
 */
export function meanOverPages(
  ctx: ScoringContext,
  select: (page: ParsedHtml) => number,
  fallback: number,
): number {
  if (ctx.pages.length === 0) return fallback;
  let sum = 0;
  for (const page of ctx.pages) sum += select(page);
  return sum / ctx.pages.length;
}

/** True when EVERY parsed page satisfies the predicate (vacuously true if none). */
export function everyPage(ctx: ScoringContext, pred: (page: ParsedHtml) => boolean): boolean {
  return ctx.pages.every(pred);
}

/** Parsed pages that FAIL the predicate, returned by URL for `affectedUrls`. */
export function pagesFailing(ctx: ScoringContext, pred: (page: ParsedHtml) => boolean): Url[] {
  const out: Url[] = [];
  for (const page of ctx.pages) {
    if (!pred(page)) out.push(page.url);
  }
  return out;
}

/** Whether a robots `<meta>` directive on a page marks it noindex. */
export function isNoindex(page: ParsedHtml): boolean {
  const robots = page.meta.robots?.toLowerCase() ?? '';
  return robots.includes('noindex');
}

/**
 * True when this audit covers exactly one page and that page is the site root (ADV-175).
 *
 * Used by rules that are meaningful on a deep page but not on a homepage. Deliberately
 * narrow: in a full-site crawl the homepage sits alongside deep pages, the cross-page rules
 * already look at all of them, and nothing should be skipped.
 */
export function isSingleRootPage(ctx: ScoringContext): boolean {
  if (ctx.mode !== 'single-page') return false;
  const page = firstPage(ctx);
  if (!page) return false;
  try {
    const path = new URL(page.url).pathname;
    return path === '/' || path === '';
  } catch {
    return false;
  }
}

