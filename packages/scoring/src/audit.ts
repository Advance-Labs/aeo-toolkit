/**
 * `auditScore` + `buildAuditReport` — the high-level entry points consumed by
 * the audit web app, the AI-visibility MCP, and the Chrome extension.
 *
 * `auditScore` runs the combined technical-SEO + AEO rule sets.
 * `buildAuditReport` wraps that score with crawl metadata, a prioritized
 * `topFixes` list (failed findings sorted by severity then weight), and any
 * generated templates for missing crawl-hint files.
 */
import type { AuditReport, Finding, FindingSeverity, Score, ScoringContext } from '@aeo/types';
import { runRules } from './engine.js';
import { technicalSeoRules } from './technical-seo-rules.js';
import { aeoRules } from './aeo-rules.js';
import { generateTemplates } from './templates.js';

/** The full audit rule set: technical SEO followed by AEO heuristics. */
export const auditRules = [...technicalSeoRules, ...aeoRules];

/** Severity ordering for fix prioritization (lower index = more urgent). */
const SEVERITY_RANK: Record<FindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/** Run the combined technical + AEO rule set and return the aggregate Score. */
export async function auditScore(ctx: ScoringContext): Promise<Score> {
  const { score } = await runRules(ctx, auditRules);
  return score;
}

/**
 * Sort failed findings into a prioritized fix list: most-severe first, then by
 * descending weight, then by id for a stable order.
 */
export function prioritizeFixes(findings: Finding[]): Finding[] {
  return findings
    .filter((f) => !f.passed)
    .slice()
    .sort((a, b) => {
      const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (sev !== 0) return sev;
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.id.localeCompare(b.id);
    });
}

export interface BuildAuditReportOptions {
  durationMs: number;
  version: string;
  /** Optional crawler identifier surfaced in the report meta. */
  crawler?: string;
}

/**
 * Build the full {@link AuditReport}: score, pages crawled, prioritized fixes,
 * and generated templates for any missing crawl-hint files.
 */
export async function buildAuditReport(
  ctx: ScoringContext,
  opts: BuildAuditReportOptions,
): Promise<AuditReport> {
  const { categories, score } = await runRules(ctx, auditRules);
  const allFindings = categories.flatMap((c) => c.findings);
  const topFixes = prioritizeFixes(allFindings);
  const templates = generateTemplates(ctx);

  return {
    url: ctx.crawl.rootUrl,
    generatedAt: new Date().toISOString(),
    score,
    pagesCrawled: ctx.crawl.pageCount,
    topFixes,
    templates,
    meta: {
      durationMs: opts.durationMs,
      crawler: opts.crawler ?? '@aeo/crawler',
      version: opts.version,
    },
  };
}
