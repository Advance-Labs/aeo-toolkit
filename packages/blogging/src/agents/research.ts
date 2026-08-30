/**
 * Research agent — finds query gaps in Search Console and turns them into topic briefs.
 *
 * A "gap" is a query with meaningful impressions but a weak position (we are ranking, but not
 * winning) or a low CTR (we surface but get few clicks). Those are the cheapest wins. The agent
 * scores each gap, drops ones that collide with existing posts (via the dedup fingerprint), and
 * emits ranked `TopicBrief`s. Pure-ish: GSC access is injected as `GscQueryFn`.
 */
import type { GscQueryRequest, GscReport, GscRow } from '@advance-labs/types';
import type { GscQueryFn } from '../google/gsc.js';
import { checkDuplicate, fingerprint } from './dedup.js';
import type { DedupCandidate } from './dedup.js';
import { slugify } from '../util/slug.js';
import type { Strategy, TopicBrief } from '../types.js';

export interface ResearchInput {
  strategy: Strategy;
  gscSiteUrl: string;
  startDate: string;
  endDate: string;
  /** Existing posts' dedup fingerprints, to skip near-duplicate gaps. */
  corpus: DedupCandidate[];
  /** Jaccard threshold above which a brief is treated as a duplicate. */
  dedupThreshold: number;
  /** Max briefs to return. */
  limit: number;
}

/** Tunable thresholds for what counts as an opportunity. */
export interface GapThresholds {
  /** Ignore queries below this many impressions — too little signal. */
  minImpressions: number;
  /** A position worse than this (numerically larger) is "page 2+" headroom. */
  weakPosition: number;
  /** A CTR below this for a decently-ranked query is a content/title gap. */
  lowCtr: number;
}

export const DEFAULT_GAP_THRESHOLDS: GapThresholds = {
  minImpressions: 50,
  weakPosition: 8,
  lowCtr: 0.02,
};

/** A scored Search Console query gap. */
export interface QueryGap {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  /** Opportunity score in [0,1]. */
  score: number;
}

/**
 * Score a single GSC row as an opportunity. The score rewards high impressions and penalizes
 * good positions / high CTR (nothing to gain there). Normalized into [0,1].
 */
export function scoreGap(row: GscRow, thresholds: GapThresholds): number {
  // Impression weight: log-scaled so a 10k-impression query doesn't dwarf everything.
  const impressionWeight = Math.min(1, Math.log10(row.impressions + 1) / 4); // ~1.0 at 10k

  // Position headroom: 0 when already #1, growing as position worsens, capped at page-2 depth.
  const positionHeadroom = Math.min(1, Math.max(0, row.position - 1) / thresholds.weakPosition);

  // CTR gap: how far below the low-CTR bar we are (only counts when ranking is not terrible).
  const ctrGap =
    row.position <= thresholds.weakPosition * 2 && row.ctr < thresholds.lowCtr
      ? (thresholds.lowCtr - row.ctr) / thresholds.lowCtr
      : 0;

  // Blend, then weight by how much signal there is.
  const raw = 0.5 * positionHeadroom + 0.5 * ctrGap;
  return round(impressionWeight * raw);
}

/** Project a GSC report into ranked, filtered query gaps. */
export function findQueryGaps(
  report: GscReport,
  thresholds: GapThresholds = DEFAULT_GAP_THRESHOLDS,
): QueryGap[] {
  const gaps: QueryGap[] = [];
  for (const row of report.rows) {
    const query = row.keys[0];
    if (query === undefined || query.length === 0) continue;
    if (row.impressions < thresholds.minImpressions) continue;

    const isWeakPosition = row.position > thresholds.weakPosition;
    const isLowCtr = row.ctr < thresholds.lowCtr;
    if (!isWeakPosition && !isLowCtr) continue;

    const score = scoreGap(row, thresholds);
    if (score <= 0) continue;
    gaps.push({
      query,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: round(row.ctr),
      position: round(row.position),
      score,
    });
  }
  return gaps.sort((a, b) => b.score - a.score);
}

/** Turn a scored gap into a topic brief, attaching pillar context and internal-link hints. */
export function gapToBrief(
  gap: QueryGap,
  strategy: Strategy,
  corpus: DedupCandidate[],
): TopicBrief {
  const title = toTitleCase(gap.query);
  const slug = slugify(gap.query);

  // Pick the closest pillar by token overlap to anchor secondary keywords + internal links.
  const pillar = closestPillar(gap.query, strategy.pillars);
  const secondary = pillar ? [pillar] : [];

  // Internal links: existing posts whose slug shares a token with this query.
  const queryTokens = new Set(slugify(gap.query).split('-').filter(Boolean));
  const internalLinks = corpus
    .filter((c) => c.slug !== slug)
    .filter((c) => c.slug.split('-').some((t) => queryTokens.has(t)))
    .slice(0, 3)
    .map((c) => c.slug);

  return {
    slug,
    title,
    primaryKeyword: gap.query,
    secondaryKeywords: secondary,
    intent: `Capture organic demand for "${gap.query}" by closing a Search Console gap (impr ${gap.impressions}, pos ${gap.position}, ctr ${gap.ctr}).`,
    internalLinks,
    opportunityScore: gap.score,
  };
}

/**
 * Run the research agent end-to-end: query GSC, score gaps, dedup against the corpus, and emit
 * ranked briefs. `query` is the injected GSC seam.
 */
export async function runResearch(
  input: ResearchInput,
  query: GscQueryFn,
  thresholds: GapThresholds = DEFAULT_GAP_THRESHOLDS,
): Promise<TopicBrief[]> {
  const req: GscQueryRequest = {
    siteUrl: input.gscSiteUrl,
    startDate: input.startDate,
    endDate: input.endDate,
    dimensions: ['query'],
    rowLimit: 500,
  };
  const report = await query(req);
  const gaps = findQueryGaps(report, thresholds);

  const briefs: TopicBrief[] = [];
  for (const gap of gaps) {
    if (briefs.length >= input.limit) break;
    const brief = gapToBrief(gap, input.strategy, input.corpus);
    const fp = fingerprint(`${brief.title} ${brief.primaryKeyword} ${brief.intent}`);
    const dup = checkDuplicate(fp, input.corpus, input.dedupThreshold);
    if (dup.isDuplicate) continue;
    briefs.push(brief);
  }
  return briefs;
}

function closestPillar(query: string, pillars: string[]): string | undefined {
  const qTokens = new Set(slugify(query).split('-').filter(Boolean));
  let best: { pillar: string; overlap: number } | undefined;
  for (const pillar of pillars) {
    const pTokens = slugify(pillar).split('-').filter(Boolean);
    const overlap = pTokens.reduce((n, t) => (qTokens.has(t) ? n + 1 : n), 0);
    if (best === undefined || overlap > best.overlap) best = { pillar, overlap };
  }
  return best && best.overlap > 0 ? best.pillar : pillars[0];
}

function toTitleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length === 0 ? w : (w[0] ?? '').toUpperCase() + w.slice(1)))
    .join(' ');
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
