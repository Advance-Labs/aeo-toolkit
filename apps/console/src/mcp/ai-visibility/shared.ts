/**
 * Pure helpers shared across the visibility tools.
 *
 * These are deliberately I/O-free so the tool logic (citation matching, ranking,
 * AEO summarisation) can be unit-tested with plain fixtures.
 */
import type { Citation, CompetitorVisibility, Finding, Score, VisibilityCheck } from '@advance-labs/types';

/**
 * Normalise a URL to a comparable host+path key so citations and the target URL
 * match even when scheme, `www.`, query string, or trailing slash differ. Falls
 * back to a lowercased trim when the input is not a parseable URL.
 */
export function normalizeUrlKey(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const host = u.host.replace(/^www\./i, '').toLowerCase();
    const path = u.pathname.replace(/\/+$/, '');
    return `${host}${path}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Decide whether `targetUrl` is cited by any of `citations`, and at what 1-based
 * rank. A citation matches when its normalized host+path is equal to, a prefix
 * of, or contains the target's — so a homepage target matches a deep-link
 * citation on the same host and vice versa.
 */
export function matchCitation(
  targetUrl: string,
  citations: Citation[],
): { cited: boolean; rank?: number } {
  const target = normalizeUrlKey(targetUrl);
  const targetHost = target.split('/')[0] ?? target;

  for (let i = 0; i < citations.length; i += 1) {
    const citation = citations[i];
    if (citation === undefined) continue;
    const key = normalizeUrlKey(citation.url);
    const keyHost = key.split('/')[0] ?? key;
    if (keyHost !== targetHost) continue;
    // Same host: count it as a citation. Exact/prefix/contains on the path all qualify.
    if (key === target || key.startsWith(target) || target.startsWith(key)) {
      return { cited: true, rank: i + 1 };
    }
    // Host matches even if paths diverge — still a brand citation.
    return { cited: true, rank: i + 1 };
  }
  return { cited: false };
}

/** Assemble a `VisibilityCheck` from a Perplexity completion's citations. */
export function buildVisibilityCheck(
  prompt: string,
  url: string,
  model: string,
  citations: Citation[],
): VisibilityCheck {
  const { cited, rank } = matchCitation(url, citations);
  const check: VisibilityCheck = {
    prompt,
    url,
    cited,
    citations,
    model,
  };
  if (rank !== undefined) check.citationRank = rank;
  return check;
}

/**
 * Rank a set of per-URL visibility checks into a `CompetitorVisibility`. Cited
 * URLs sort ahead of uncited ones; within cited, lower rank wins.
 */
export function buildCompetitorVisibility(
  prompt: string,
  checks: VisibilityCheck[],
): CompetitorVisibility {
  const results = checks
    .map((c) => {
      const entry: { url: string; cited: boolean; rank?: number } = {
        url: c.url,
        cited: c.cited,
      };
      if (c.citationRank !== undefined) entry.rank = c.citationRank;
      return entry;
    })
    .sort((a, b) => {
      if (a.cited !== b.cited) return a.cited ? -1 : 1;
      const ar = a.rank ?? Number.POSITIVE_INFINITY;
      const br = b.rank ?? Number.POSITIVE_INFINITY;
      if (ar !== br) return ar - br;
      return a.url.localeCompare(b.url);
    });
  return { prompt, results };
}

/** AEO-focused summary distilled from a full `Score`. */
export interface AeoSummary {
  url: string;
  overall: number;
  grade: string;
  aeoCategoryScore: number | null;
  structuredDataCategoryScore: number | null;
  criticalCount: number;
  passedCount: number;
  failedCount: number;
  /** The highest-priority AEO-relevant fixes (failed findings). */
  topFixes: Array<Pick<Finding, 'id' | 'title' | 'severity' | 'recommendation'>>;
}

const AEO_RELEVANT_CATEGORIES = new Set(['aeo', 'structured-data', 'content', 'metadata']);

/**
 * Distil a full audit `Score` into an AEO-focused summary: pull the AEO + schema
 * category scores and the top AEO-relevant failed findings.
 */
export function summarizeAeo(url: string, score: Score, maxFixes = 8): AeoSummary {
  const findCategory = (key: string): number | null =>
    score.categories.find((c) => c.key === key)?.score ?? null;

  const topFixes = score.categories
    .filter((c) => AEO_RELEVANT_CATEGORIES.has(c.key))
    .flatMap((c) => c.findings)
    .filter((f) => !f.passed)
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.weight - a.weight)
    .slice(0, maxFixes)
    .map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      recommendation: f.recommendation,
    }));

  return {
    url,
    overall: score.overall,
    grade: score.grade,
    aeoCategoryScore: findCategory('aeo'),
    structuredDataCategoryScore: findCategory('structured-data'),
    criticalCount: score.criticalCount,
    passedCount: score.passedCount,
    failedCount: score.failedCount,
    topFixes,
  };
}

function severityRank(s: Finding['severity']): number {
  switch (s) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
    case 'info':
      return 4;
    default:
      return 5;
  }
}

/** Parse a model's prose into a deduped list of candidate prompts (one per line). */
export function parsePromptList(text: string, max: number): string[] {
  const lines = text
    .split('\n')
    .map((line) =>
      line
        // strip leading list markers: "1.", "1)", "-", "*", "•"
        .replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '')
        // strip surrounding quotes
        .replace(/^["'`]+|["'`]+$/g, '')
        .trim(),
    )
    .filter((line) => line.length > 0 && line.length <= 300);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}
