import { describe, expect, it } from 'vitest';
import type { Citation, VisibilityCheck } from '@advance-labs/types';

import {
  buildCompetitorVisibility,
  buildVisibilityCheck,
  matchCitation,
  normalizeUrlKey,
  parsePromptList,
  summarizeAeo,
} from './shared.js';
import { fakeScore } from './test-fixtures.js';

describe('normalizeUrlKey', () => {
  it('strips scheme, www, query, and trailing slash', () => {
    expect(normalizeUrlKey('https://www.Example.com/Blog/?q=1')).toBe('example.com/Blog');
    expect(normalizeUrlKey('http://example.com/')).toBe('example.com');
  });

  it('handles bare hosts and non-URLs gracefully', () => {
    expect(normalizeUrlKey('example.com/path/')).toBe('example.com/path');
    expect(normalizeUrlKey('not a url')).toBe('not a url');
  });
});

describe('matchCitation', () => {
  const cite = (url: string): Citation => ({ url });

  it('matches on same host and returns 1-based rank', () => {
    const citations = [cite('https://other.com'), cite('https://example.com/blog/post')];
    const result = matchCitation('https://www.example.com/', citations);
    expect(result.cited).toBe(true);
    expect(result.rank).toBe(2);
  });

  it('reports not cited when no host matches', () => {
    const citations = [cite('https://a.com'), cite('https://b.com')];
    expect(matchCitation('https://example.com', citations)).toEqual({ cited: false });
  });

  it('matches deep-link citation for a homepage target', () => {
    const citations = [cite('https://example.com/very/deep/page')];
    const result = matchCitation('https://example.com', citations);
    expect(result.cited).toBe(true);
    expect(result.rank).toBe(1);
  });
});

describe('buildVisibilityCheck', () => {
  it('omits citationRank when not cited', () => {
    const check = buildVisibilityCheck('q', 'https://example.com', 'sonar', [
      { url: 'https://other.com' },
    ]);
    expect(check.cited).toBe(false);
    expect(check.citationRank).toBeUndefined();
    expect(check.model).toBe('sonar');
  });

  it('sets citationRank when cited', () => {
    const check = buildVisibilityCheck('q', 'https://example.com', 'sonar', [
      { url: 'https://example.com/x' },
    ]);
    expect(check.cited).toBe(true);
    expect(check.citationRank).toBe(1);
  });
});

describe('buildCompetitorVisibility', () => {
  it('ranks cited URLs ahead of uncited, lowest rank first', () => {
    const checks: VisibilityCheck[] = [
      { prompt: 'q', url: 'https://c.com', cited: false, citations: [], model: 'sonar' },
      {
        prompt: 'q',
        url: 'https://a.com',
        cited: true,
        citationRank: 3,
        citations: [],
        model: 'sonar',
      },
      {
        prompt: 'q',
        url: 'https://b.com',
        cited: true,
        citationRank: 1,
        citations: [],
        model: 'sonar',
      },
    ];
    const ranked = buildCompetitorVisibility('q', checks);
    expect(ranked.results.map((r) => r.url)).toEqual([
      'https://b.com',
      'https://a.com',
      'https://c.com',
    ]);
    expect(ranked.results[0]?.rank).toBe(1);
    expect(ranked.results[2]?.cited).toBe(false);
  });
});

describe('summarizeAeo', () => {
  it('pulls AEO + structured-data category scores and prioritizes critical fixes', () => {
    const summary = summarizeAeo('https://example.com', fakeScore());
    expect(summary.overall).toBe(72);
    expect(summary.grade).toBe('C');
    expect(summary.aeoCategoryScore).toBe(65);
    expect(summary.structuredDataCategoryScore).toBe(80);
    // The critical llms.txt fix must rank above the high-severity FAQ fix.
    expect(summary.topFixes[0]?.id).toBe('aeo-llms-txt');
    expect(summary.topFixes[0]?.severity).toBe('critical');
  });
});

describe('parsePromptList', () => {
  it('strips numbering/markers/quotes, dedupes, and caps length', () => {
    const text = [
      '1. What is the best CRM?',
      '2) "What is the best CRM?"', // duplicate after normalization
      '- How do I migrate to a new CRM?',
      '• Compare HubSpot vs Salesforce',
      '',
    ].join('\n');
    const prompts = parsePromptList(text, 10);
    expect(prompts).toEqual([
      'What is the best CRM?',
      'How do I migrate to a new CRM?',
      'Compare HubSpot vs Salesforce',
    ]);
  });

  it('respects the max cap', () => {
    const text = 'a\nb\nc\nd';
    expect(parsePromptList(text, 2)).toEqual(['a', 'b']);
  });
});
