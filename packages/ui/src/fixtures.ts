/**
 * Sample `@advance-labs/types` data used by the component tests. Kept out of the public
 * surface (not re-exported from index.ts) so it never ships to consumers.
 */
import type { Finding, GeneratedTemplate, Score, ScoreCategory } from '@advance-labs/types';

export const sampleCategories: ScoreCategory[] = [
  {
    key: 'crawlability',
    label: 'Crawlability',
    score: 92,
    weight: 0.2,
    findings: [],
    passedCount: 5,
    failedCount: 1,
  },
  {
    key: 'aeo',
    label: 'AI Readiness',
    score: 48,
    weight: 0.3,
    findings: [],
    passedCount: 2,
    failedCount: 4,
  },
];

export const sampleFindings: Finding[] = [
  {
    id: 'no-llms-txt',
    category: 'aeo',
    severity: 'high',
    title: 'Missing llms.txt',
    description: 'No llms.txt manifest was found at the site root.',
    recommendation: 'Add an llms.txt file describing key pages for AI crawlers.',
    passed: false,
    weight: 8,
    affectedUrls: ['https://example.com/'],
    docsUrl: 'https://llmstxt.org/',
  },
  {
    id: 'missing-meta-description',
    category: 'metadata',
    severity: 'critical',
    title: 'Missing meta description',
    description: 'The home page has no meta description tag.',
    recommendation: 'Add a concise 150–160 character meta description.',
    passed: false,
    weight: 10,
  },
  {
    id: 'https-enabled',
    category: 'security',
    severity: 'info',
    title: 'HTTPS enabled',
    description: 'The site is served over HTTPS.',
    recommendation: 'No action needed.',
    passed: true,
    weight: 5,
  },
];

export const sampleScore: Score = {
  overall: 71,
  grade: 'C',
  categories: sampleCategories,
  passedCount: 7,
  failedCount: 5,
  criticalCount: 1,
};

export const sampleTemplate: GeneratedTemplate = {
  filename: 'llms.txt',
  contentType: 'text/plain',
  content:
    '# Example Site\n\n> A sample llms.txt manifest.\n\n## Docs\n- [Home](https://example.com/)',
  reason: 'Your site is missing an llms.txt manifest.',
};
