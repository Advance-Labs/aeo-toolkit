/**
 * Performance monitor agent — daily GSC + GA4 health scores per published post.
 *
 * Joins Search Console (clicks/impressions/ctr/position by page) with GA4 (pageviews by path) and
 * computes a composite health score in [0,1] for each published post. Pure-ish: both Google calls
 * are injected as typed seams, so tests run with no network and no OAuth.
 */
import type { Ga4Report, Ga4ReportRequest, GscQueryRequest, GscReport, GscRow } from '@advance-labs/types';
import type { Ga4ReportFn } from '../google/ga4.js';
import type { GscQueryFn } from '../google/gsc.js';
import type { Post, PostHealth } from '../types.js';

export interface MonitorInput {
  posts: Post[];
  gscSiteUrl: string;
  ga4PropertyId: string;
  startDate: string;
  endDate: string;
}

/**
 * Composite health score in [0,1]. Rewards clicks and good (low) position, lightly rewards CTR.
 * A post with zero impressions scores 0 — a clear self-correction candidate.
 */
export function healthScore(metrics: {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  pageViews: number;
}): number {
  if (metrics.impressions <= 0 && metrics.pageViews <= 0) return 0;

  // Click signal: log-scaled, ~1.0 at ~100 clicks.
  const clickScore = Math.min(1, Math.log10(metrics.clicks + 1) / 2);
  // Position signal: 1.0 at #1, decaying to 0 by ~position 20.
  const positionScore = metrics.position > 0 ? Math.max(0, 1 - (metrics.position - 1) / 19) : 0;
  // CTR signal: 5% CTR maps to ~1.0.
  const ctrScore = Math.min(1, metrics.ctr / 0.05);

  return round(0.5 * clickScore + 0.35 * positionScore + 0.15 * ctrScore);
}

/** Index GSC rows by page URL (first key is the page when dimension is `page`). */
function indexGscByPage(report: GscReport): Map<string, GscRow> {
  const map = new Map<string, GscRow>();
  for (const row of report.rows) {
    const page = row.keys[0];
    if (page !== undefined) map.set(normalizePath(page), row);
  }
  return map;
}

/** Index GA4 pageview rows by path. */
function indexGa4ByPath(report: Ga4Report): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of report.rows) {
    const path = row.dimensions['pagePath'];
    const views = row.metrics['screenPageViews'];
    if (path !== undefined)
      map.set(normalizePath(path), (map.get(normalizePath(path)) ?? 0) + (views ?? 0));
  }
  return map;
}

/** Reduce a URL or path to a comparable path (strip origin, trailing slash, query/hash). */
export function normalizePath(urlOrPath: string): string {
  let path = urlOrPath;
  const schemeIdx = path.indexOf('://');
  if (schemeIdx >= 0) {
    const afterScheme = path.slice(schemeIdx + 3);
    const slash = afterScheme.indexOf('/');
    path = slash >= 0 ? afterScheme.slice(slash) : '/';
  }
  path = path.split('#')[0] ?? path;
  path = path.split('?')[0] ?? path;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path.length === 0 ? '/' : path;
}

/** The path a published post lives at, derived from its slug. */
export function postPath(post: Post): string {
  return `/blog/${post.slug}`;
}

/**
 * Run the monitor: fetch GSC (by page) + GA4 (pageviews by path), join to each published post, and
 * return posts annotated with a fresh `health` snapshot. Non-published posts pass through unchanged.
 */
export async function runMonitor(
  input: MonitorInput,
  gscQuery: GscQueryFn,
  ga4Report: Ga4ReportFn,
  now: () => Date = () => new Date(),
): Promise<Post[]> {
  const gscReq: GscQueryRequest = {
    siteUrl: input.gscSiteUrl,
    startDate: input.startDate,
    endDate: input.endDate,
    dimensions: ['page'],
    rowLimit: 1000,
  };
  const ga4Req: Ga4ReportRequest = {
    propertyId: input.ga4PropertyId,
    dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
    dimensions: ['pagePath'],
    metrics: ['screenPageViews'],
    limit: 1000,
  };

  const [gsc, ga4] = await Promise.all([gscQuery(gscReq), ga4Report(ga4Req)]);
  const gscByPage = indexGscByPage(gsc);
  const ga4ByPath = indexGa4ByPath(ga4);
  const measuredAt = now().toISOString();

  return input.posts.map((post) => {
    if (post.status !== 'published') return post;
    const path = postPath(post);
    const g = gscByPage.get(path);
    const pageViews = ga4ByPath.get(path) ?? 0;
    const metrics = {
      clicks: g?.clicks ?? 0,
      impressions: g?.impressions ?? 0,
      ctr: g?.ctr ?? 0,
      position: g?.position ?? 0,
      pageViews,
    };
    const health: PostHealth = {
      ...metrics,
      score: healthScore(metrics),
      measuredAt,
    };
    return { ...post, health, updatedAt: measuredAt };
  });
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
