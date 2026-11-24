import type { AuditReport, Finding } from '@advance-labs/types';

const finding = (id: string, severity: Finding['severity'], recommendation: string): Finding => ({
  id,
  category: 'aeo',
  severity,
  title: `Rule ${id}`,
  description: 'd',
  recommendation,
  passed: false,
  weight: 1,
});

export function fakeReport(overall = 72): AuditReport {
  return {
    url: 'https://example.com/',
    generatedAt: '2026-01-01T00:00:00.000Z',
    score: {
      overall,
      grade: 'C',
      categories: [
        { key: 'aeo', label: 'AEO', score: 40, weight: 1, findings: [], passedCount: 2, failedCount: 3 },
        { key: 'metadata', label: 'Metadata', score: 100, weight: 1, findings: [], passedCount: 5, failedCount: 0 },
      ],
      passedCount: 7,
      failedCount: 7,
      criticalCount: 1,
    },
    pagesCrawled: 3,
    topFixes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) =>
      finding(id, i === 0 ? 'critical' : 'medium', `Do thing ${id}. Then more detail follows here.`),
    ),
    templates: [],
    meta: { durationMs: 1, crawler: 'test', version: '0' },
  };
}
