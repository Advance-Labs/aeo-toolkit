/**
 * Test fixtures — a minimal, fully-typed `AuditReport` used by the unit tests. Kept out of the
 * test file so it can be reused and so the test stays focused on assertions.
 */
import type { AuditReport, Finding, ScoreCategory } from '@advance-labs/types';

const sampleCategory: ScoreCategory = {
  key: 'crawlability',
  label: 'Crawlability',
  score: 72,
  weight: 0.2,
  passedCount: 3,
  failedCount: 1,
  findings: [],
};

const sampleFix: Finding = {
  id: 'robots-missing-ai-bots',
  category: 'aeo',
  severity: 'high',
  title: 'robots.txt blocks AI crawlers',
  description: 'GPTBot and ClaudeBot are disallowed, so answer engines cannot read this site.',
  recommendation: 'Allow GPTBot, ClaudeBot, and PerplexityBot in robots.txt.',
  passed: false,
  weight: 8,
  affectedUrls: ['https://example.com/robots.txt'],
  docsUrl: 'https://example.com/docs/robots',
};

/** A tiny but valid report — exercises every branch the document renders. */
export function makeTinyReport(): AuditReport {
  return {
    url: 'https://example.com',
    generatedAt: new Date(0).toISOString(),
    pagesCrawled: 5,
    score: {
      overall: 72,
      grade: 'C',
      categories: [sampleCategory],
      passedCount: 3,
      failedCount: 1,
      criticalCount: 0,
    },
    topFixes: [sampleFix],
    templates: [],
    meta: { durationMs: 1234, crawler: '@advance-labs/crawler', version: '0.1.0' },
  };
}

/** An edge-case report: no categories, no fixes, out-of-range score. */
export function makeEmptyReport(): AuditReport {
  return {
    url: 'https://empty.example',
    generatedAt: 'not-a-real-date',
    pagesCrawled: 0,
    score: {
      overall: 100,
      grade: 'A',
      categories: [],
      passedCount: 0,
      failedCount: 0,
      criticalCount: 0,
    },
    topFixes: [],
    templates: [],
    meta: { durationMs: 0, crawler: '@advance-labs/crawler', version: '0.1.0' },
  };
}
