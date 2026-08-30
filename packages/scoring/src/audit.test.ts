import { describe, expect, it } from 'vitest';
import type { Finding } from '@advance-labs/types';
import { auditScore, buildAuditReport, prioritizeFixes } from './audit.js';
import { goodContext, poorContext, singlePageContext } from './fixtures.js';

describe('auditScore', () => {
  it('scores a well-optimized site high and a neglected site low', async () => {
    const good = await auditScore(goodContext());
    const poor = await auditScore(poorContext());

    expect(good.overall).toBeGreaterThan(85);
    expect(['A', 'B']).toContain(good.grade);

    expect(poor.overall).toBeLessThan(40);
    expect(poor.grade).toBe('F');
    expect(poor.overall).toBeLessThan(good.overall);
  });

  it('flags critical failures on the poor site (HTTPS, indexable, AI bots)', async () => {
    const poor = await auditScore(poorContext());
    expect(poor.criticalCount).toBeGreaterThanOrEqual(2);
  });
});

describe('prioritizeFixes', () => {
  it('orders failed findings by severity then descending weight', () => {
    const findings: Finding[] = [
      {
        id: 'a',
        category: 'content',
        severity: 'low',
        title: '',
        description: '',
        recommendation: '',
        passed: false,
        weight: 9,
      },
      {
        id: 'b',
        category: 'security',
        severity: 'critical',
        title: '',
        description: '',
        recommendation: '',
        passed: false,
        weight: 3,
      },
      {
        id: 'c',
        category: 'security',
        severity: 'critical',
        title: '',
        description: '',
        recommendation: '',
        passed: false,
        weight: 8,
      },
      {
        id: 'd',
        category: 'metadata',
        severity: 'medium',
        title: '',
        description: '',
        recommendation: '',
        passed: true,
        weight: 10,
      },
    ];
    const ordered = prioritizeFixes(findings);
    expect(ordered.map((f) => f.id)).toEqual(['c', 'b', 'a']);
    // passed findings are excluded
    expect(ordered.find((f) => f.id === 'd')).toBeUndefined();
  });
});

describe('buildAuditReport', () => {
  it('assembles score, pagesCrawled, topFixes, templates, and meta', async () => {
    const report = await buildAuditReport(poorContext(), { durationMs: 4200, version: '9.9.9' });

    expect(report.url).toBe('http://poor.example.com/');
    expect(report.pagesCrawled).toBe(3);
    expect(report.meta.durationMs).toBe(4200);
    expect(report.meta.version).toBe('9.9.9');
    expect(report.meta.crawler).toBe('@advance-labs/crawler');

    // poor site is missing robots/llms/sitemap -> templates generated
    const filenames = report.templates.map((t) => t.filename).sort();
    expect(filenames).toEqual(['llms.txt', 'robots.txt', 'sitemap.xml']);

    // topFixes are all failures, most-urgent first
    expect(report.topFixes.length).toBeGreaterThan(0);
    expect(report.topFixes.every((f) => !f.passed)).toBe(true);
    expect(report.topFixes[0]?.severity).toBe('critical');
  });

  it('generates no templates for a fully-equipped good site', async () => {
    const report = await buildAuditReport(goodContext(), { durationMs: 100, version: '1.0.0' });
    expect(report.templates).toHaveLength(0);
  });

  it('does not throw and degrades gracefully in single-page mode', async () => {
    const report = await buildAuditReport(singlePageContext(), {
      durationMs: 50,
      version: '1.0.0',
    });
    expect(report.pagesCrawled).toBe(1);
    expect(report.score.overall).toBeGreaterThan(0);
  });
});
