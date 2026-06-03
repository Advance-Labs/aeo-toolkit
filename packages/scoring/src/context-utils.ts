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
} from '@aeo/types';

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
