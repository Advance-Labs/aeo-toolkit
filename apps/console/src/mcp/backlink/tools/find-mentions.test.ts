import { describe, it, expect } from 'vitest';
import type { ToolResult } from '@advance-labs/mcp-core';
import type { HttpClient, TextResponse } from '@advance-labs/backlinks';
import { findMentionsTool } from './find-mentions.js';
import type { ToolDeps } from '../deps.js';
import type { OutreachClient } from '../lib/outreach.js';

const RESULTS_HTML = `
<div class="result">
  <a class="result__a" href="https://brandsite.com/about">Brand — About</a>
  <div class="result__snippet">Official page.</div>
</div>
<div class="result">
  <a class="result__a" href="https://review.blog/brand-review">Brand Review</a>
  <div class="result__snippet">A third party review.</div>
</div>
`;

function mockHttp(body: string): HttpClient {
  return {
    getText: async (): Promise<TextResponse> => ({ ok: true, status: 200, body, url: 'x' }),
    getResource: async () => {
      throw new Error('not used');
    },
  };
}

const noopOutreach: OutreachClient = { complete: async () => ({ text: '', model: 't' }) };

function deps(http: HttpClient): ToolDeps {
  return { http, outreach: noopOutreach, maxResults: 10 };
}

/** Narrow a `ToolResult` to its success arm and return its `structuredContent`. */
function structured(result: ToolResult): Record<string, unknown> {
  // `isError` is the discriminant: the error arm has it set to `true` and carries
  // no `structuredContent`. Assert the success arm before reading structured data.
  expect(result.isError).toBeFalsy();
  if (result.isError === true) {
    throw new Error('expected a success ToolResult');
  }
  expect(result.structuredContent).toBeDefined();
  return result.structuredContent as Record<string, unknown>;
}

describe('find_mentions tool', () => {
  it('classifies linked vs unlinked mentions when a domain is supplied', async () => {
    const tool = findMentionsTool(deps(mockHttp(RESULTS_HTML)));
    const result = await tool.handler({ brand: 'Brand', domain: 'brandsite.com' });
    const data = structured(result);

    expect(data.totalResults).toBe(2);
    const linked = data.linkedMentions as Array<Record<string, unknown>>;
    const unlinked = data.unlinkedMentions as Array<Record<string, unknown>>;
    expect(linked).toHaveLength(1);
    expect(linked[0]?.url).toBe('https://brandsite.com/about');
    expect(unlinked).toHaveLength(1);
    expect(unlinked[0]?.url).toBe('https://review.blog/brand-review');
  });

  it('returns all results as unlinked when no domain is supplied', async () => {
    const tool = findMentionsTool(deps(mockHttp(RESULTS_HTML)));
    const result = await tool.handler({ brand: 'Brand' });
    const data = structured(result);
    expect(data.linkedMentions).toBeNull();
    expect((data.unlinkedMentions as unknown[]).length).toBe(2);
  });

  it('degrades to empty results with a warning when the search is blocked', async () => {
    const blocked = mockHttp('please let us know: anomaly detected');
    const tool = findMentionsTool(deps(blocked));
    const result = await tool.handler({ brand: 'Brand', domain: 'brandsite.com' });
    const data = structured(result);
    expect(data.totalResults).toBe(0);
    expect((data.warnings as string[]).length).toBeGreaterThan(0);
  });

  it('adds CommonCrawl-indexed pages as supplementary linked coverage when a domain is given', async () => {
    const ccBody = [
      JSON.stringify({ url: 'https://brandsite.com/blog/post', status: '200' }),
      // Already surfaced by DDG → must be de-duped, not double-counted.
      JSON.stringify({ url: 'https://brandsite.com/about', status: '200' }),
      // Off-domain capture → excluded from this domain-scoped supplementary list.
      JSON.stringify({ url: 'https://other.example/x', status: '200' }),
    ].join('\n');

    // Route DDG vs CommonCrawl by inspecting the requested URL.
    const routed: HttpClient = {
      getText: async (url: string): Promise<TextResponse> => {
        const body = url.includes('index.commoncrawl.org') ? ccBody : RESULTS_HTML;
        return { ok: true, status: 200, body, url };
      },
      getResource: async () => {
        throw new Error('not used');
      },
    };

    const tool = findMentionsTool(deps(routed));
    const result = await tool.handler({ brand: 'Brand', domain: 'brandsite.com' });
    const data = structured(result);

    const supplementary = data.commonCrawlMentions as Array<Record<string, unknown>>;
    expect(supplementary).toHaveLength(1);
    expect(supplementary[0]?.url).toBe('https://brandsite.com/blog/post');
    expect(supplementary[0]?.source).toBe('commoncrawl');
  });

  it('omits CommonCrawl supplementary section when no domain is supplied', async () => {
    const tool = findMentionsTool(deps(mockHttp(RESULTS_HTML)));
    const result = await tool.handler({ brand: 'Brand' });
    const data = structured(result);
    expect(data.commonCrawlMentions).toBeNull();
  });
});
