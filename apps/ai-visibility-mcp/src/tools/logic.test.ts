import { describe, expect, it, vi } from 'vitest';
import type { Citation } from '@aeo/types';

// Mock the scoring package so `analyze_website_aeo` does not run the real rule
// engine — we only assert that the crawl → parse → score → summarize wiring
// passes our fake crawl through and surfaces the score. The fake `Score` lives
// in test-fixtures.
vi.mock('@aeo/scoring', () => ({
  auditScore: vi.fn(async () => {
    const { fakeScore } = await import('./test-fixtures.js');
    return fakeScore();
  }),
}));

import {
  analyzeWebsiteAeo,
  checkAiVisibility,
  compareCompetitorVisibility,
  discoverRankingPrompts,
  getVisibilityReport,
} from './logic.js';
import { fakeCrawl, fakeDeps } from './test-fixtures.js';

const cite = (url: string): Citation => ({ url });

describe('analyzeWebsiteAeo', () => {
  it('crawls, scores, and returns an AEO summary with AI-bot + file signals', async () => {
    const { deps, calls } = fakeDeps({ crawl: fakeCrawl('https://example.com', 3) });
    const result = await analyzeWebsiteAeo(deps, { url: 'https://example.com' });

    expect(calls.crawl).toEqual([{ url: 'https://example.com' }]);
    expect(result.pagesCrawled).toBe(3);
    expect(result.summary.overall).toBe(72);
    expect(result.summary.aeoCategoryScore).toBe(65);
    expect(result.aiBotsAllowed).toContainEqual({ bot: 'PerplexityBot', allowed: false });
    expect(result.filePresence.llmsTxt).toBe(false);
  });

  it('throws a structured error when the crawl returns no pages', async () => {
    const { deps } = fakeDeps({ crawl: fakeCrawl('https://example.com', 0) });
    await expect(analyzeWebsiteAeo(deps, { url: 'https://example.com' })).rejects.toThrow(
      /No pages could be fetched/,
    );
  });
});

describe('checkAiVisibility', () => {
  it('reports cited + rank when the URL appears in Perplexity citations', async () => {
    const { deps, calls } = fakeDeps({
      citations: [cite('https://other.com'), cite('https://example.com/post')],
    });
    const check = await checkAiVisibility(deps, {
      prompt: 'best widget?',
      url: 'https://example.com',
      perplexityApiKey: 'pplx-test',
    });

    expect(calls.complete[0]?.provider).toBe('perplexity');
    expect(calls.complete[0]?.model).toBe('sonar');
    expect(check.cited).toBe(true);
    expect(check.citationRank).toBe(2);
    expect(check.citations).toHaveLength(2);
  });

  it('reports not cited when the URL is absent', async () => {
    const { deps } = fakeDeps({ citations: [cite('https://rival.com')] });
    const check = await checkAiVisibility(deps, {
      prompt: 'q',
      url: 'https://example.com',
      perplexityApiKey: 'pplx-test',
    });
    expect(check.cited).toBe(false);
    expect(check.citationRank).toBeUndefined();
  });
});

describe('discoverRankingPrompts', () => {
  it('generates candidates and live-tests the first N when a key is supplied', async () => {
    const { deps, calls } = fakeDeps({
      text: '1. What is X?\n2. How to do Y?\n3. Best Z?',
      citations: [cite('https://example.com')],
    });
    const result = await discoverRankingPrompts(deps, {
      url: 'https://example.com',
      topic: 'widgets',
      perplexityApiKey: 'pplx-test',
      testCount: 2,
    });

    expect(result.candidates).toEqual(['What is X?', 'How to do Y?', 'Best Z?']);
    expect(result.tested).toHaveLength(2);
    expect(result.tested.every((t) => t.cited)).toBe(true);
    // 1 generation call + 2 visibility checks.
    expect(calls.complete).toHaveLength(3);
  });

  it('throws when no API key is provided (generation requires BYOK)', async () => {
    const { deps } = fakeDeps({ text: 'a\nb' });
    await expect(
      discoverRankingPrompts(deps, { url: 'https://example.com', topic: 'widgets' }),
    ).rejects.toThrow(/requires `perplexityApiKey`/);
  });
});

describe('getVisibilityReport', () => {
  it('combines AEO audit with per-prompt checks and computes a citation rate', async () => {
    const { deps } = fakeDeps({
      crawl: fakeCrawl('https://example.com', 1),
      citations: [cite('https://example.com')],
    });
    const report = await getVisibilityReport(deps, {
      url: 'https://example.com',
      prompts: ['q1', 'q2'],
      perplexityApiKey: 'pplx-test',
    });

    expect(report.aeo.summary.overall).toBe(72);
    expect(report.visibility.totalPrompts).toBe(2);
    expect(report.visibility.citedCount).toBe(2);
    expect(report.visibility.citationRate).toBe(1);
  });

  it('rejects an empty prompt list', async () => {
    const { deps } = fakeDeps();
    await expect(
      getVisibilityReport(deps, {
        url: 'https://example.com',
        prompts: [],
        perplexityApiKey: 'pplx-test',
      }),
    ).rejects.toThrow(/at least one prompt/);
  });
});

describe('compareCompetitorVisibility', () => {
  it('runs one Sonar call and ranks competitors by citation', async () => {
    const { deps, calls } = fakeDeps({
      citations: [cite('https://b.com'), cite('https://a.com/page')],
    });
    const result = await compareCompetitorVisibility(deps, {
      prompt: 'best provider?',
      urls: ['https://a.com', 'https://b.com', 'https://c.com'],
      perplexityApiKey: 'pplx-test',
    });

    // Exactly one upstream call is reused across all three URLs.
    expect(calls.complete).toHaveLength(1);
    // b.com is cited at rank 1, a.com at rank 2, c.com not cited.
    expect(result.results.map((r) => r.url)).toEqual([
      'https://b.com',
      'https://a.com',
      'https://c.com',
    ]);
    expect(result.results[2]?.cited).toBe(false);
  });

  it('requires at least two URLs', async () => {
    const { deps } = fakeDeps();
    await expect(
      compareCompetitorVisibility(deps, {
        prompt: 'q',
        urls: ['https://only.com'],
        perplexityApiKey: 'pplx-test',
      }),
    ).rejects.toThrow(/at least two URLs/);
  });
});
