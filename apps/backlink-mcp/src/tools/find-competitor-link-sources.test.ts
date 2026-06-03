import { describe, it, expect } from 'vitest';
import type { ToolResult } from '@aeo/mcp-core';
import { findCompetitorLinkSourcesTool } from './find-competitor-link-sources.js';
import type { ToolDeps } from './deps.js';
import type { HttpClient, TextResponse } from '../lib/http.js';
import type { OutreachClient } from '../lib/outreach.js';

// Third-party pages that mention/link the competitor (returned for DDG queries).
const DDG_HTML = `
<div class="result">
  <a class="result__a" href="https://linker.blog/review">Competitor Review</a>
  <div class="result__snippet">A third-party page.</div>
</div>
<div class="result">
  <a class="result__a" href="https://news.example/story">News Story</a>
  <div class="result__snippet">Coverage.</div>
</div>
`;

// CommonCrawl-indexed pages on the competitor's own domain.
const CC_NDJSON = [
  JSON.stringify({ url: 'https://competitor.com/pricing', status: '200' }),
  JSON.stringify({ url: 'https://competitor.com/blog/seo', status: '200' }),
].join('\n');

const noopOutreach: OutreachClient = { complete: async () => ({ text: '', model: 't' }) };

function routedHttp(): HttpClient {
  return {
    getText: async (url: string): Promise<TextResponse> => {
      const body = url.includes('index.commoncrawl.org') ? CC_NDJSON : DDG_HTML;
      return { ok: true, status: 200, body, url };
    },
    getResource: async () => {
      throw new Error('not used');
    },
  };
}

function deps(http: HttpClient): ToolDeps {
  return { http, outreach: noopOutreach, maxResults: 10, commonCrawlIndex: 'CC-MAIN-2024-51' };
}

function structured(result: ToolResult): Record<string, unknown> {
  expect(result.isError).toBeFalsy();
  if (result.isError === true) throw new Error('expected success');
  return result.structuredContent as Record<string, unknown>;
}

describe('find_competitor_link_sources tool', () => {
  it('returns third-party link sources from DDG and competitor pages from CommonCrawl', async () => {
    const tool = findCompetitorLinkSourcesTool(deps(routedHttp()));
    const result = await tool.handler({ competitorUrl: 'https://competitor.com' });
    const data = structured(result);

    expect(data.competitorDomain).toBe('competitor.com');

    const sources = data.sources as Array<Record<string, unknown>>;
    // Third-party hosts only; the competitor's own domain is excluded.
    const hosts = sources.map((s) => s.host);
    expect(hosts).toContain('linker.blog');
    expect(hosts).toContain('news.example');
    expect(hosts).not.toContain('competitor.com');

    const ccPages = data.commonCrawlPages as Array<Record<string, unknown>>;
    expect(ccPages).toHaveLength(2);
    expect(ccPages.map((p) => p.url)).toEqual([
      'https://competitor.com/pricing',
      'https://competitor.com/blog/seo',
    ]);
    expect(ccPages[0]?.source).toBe('commoncrawl');
  });

  it('returns an empty structured result for an underivable domain', async () => {
    const tool = findCompetitorLinkSourcesTool(deps(routedHttp()));
    const result = await tool.handler({ competitorUrl: '   ' });
    const data = structured(result);
    expect(data.totalSources).toBe(0);
    expect((data.sources as unknown[]).length).toBe(0);
    expect((data.warnings as string[]).length).toBeGreaterThan(0);
  });

  it('degrades gracefully (empty CommonCrawl pages + warning) when the index errors', async () => {
    const http: HttpClient = {
      getText: async (url: string): Promise<TextResponse> => {
        if (url.includes('index.commoncrawl.org')) {
          return { ok: false, status: 503, body: '', url };
        }
        return { ok: true, status: 200, body: DDG_HTML, url };
      },
      getResource: async () => {
        throw new Error('not used');
      },
    };
    const tool = findCompetitorLinkSourcesTool(deps(http));
    const result = await tool.handler({ competitorUrl: 'competitor.com' });
    const data = structured(result);

    expect((data.commonCrawlPages as unknown[]).length).toBe(0);
    // DDG sources are unaffected.
    expect((data.sources as unknown[]).length).toBeGreaterThan(0);
    expect((data.warnings as string[]).some((w) => w.includes('[commoncrawl]'))).toBe(true);
  });
});
