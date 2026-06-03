import { describe, expect, it } from 'vitest';
import { TYPES_VERSION } from './index.js';
import type { AuditReport, EeatReport, Score, ScoringContext } from './index.js';

describe('@aeo/types', () => {
  it('exports a version marker', () => {
    expect(TYPES_VERSION).toBe('0.1.0');
  });

  it('type surface compiles for the keystone shapes', () => {
    // Compile-time assertions: if these shapes drift, the build breaks here.
    const score: Score = {
      overall: 92,
      grade: 'A',
      categories: [],
      passedCount: 10,
      failedCount: 1,
      criticalCount: 0,
    };
    const report: AuditReport = {
      url: 'https://example.com',
      generatedAt: new Date(0).toISOString(),
      score,
      pagesCrawled: 1,
      topFixes: [],
      templates: [],
      meta: { durationMs: 12, crawler: '@aeo/crawler', version: TYPES_VERSION },
    };
    expect(report.score.grade).toBe('A');

    const mode: ScoringContext['mode'] = 'single-page';
    expect(mode).toBe('single-page');

    const eeat: EeatReport['pillars'] = [];
    expect(eeat).toHaveLength(0);
  });
});
