import { describe, it, expect } from 'vitest';
import type { PageResource } from '@aeo/types';
import type { ToolResult } from '@aeo/mcp-core';
import type { HttpClient, TextResponse } from '@aeo/backlinks';
import { verifyPageLinksTool } from './verify-page-links.js';
import type { ToolDeps } from '../deps.js';
import type { OutreachClient } from '../lib/outreach.js';

/** Build a PageResource stub for a successful fetch with the given body. */
function pageOk(url: string, body: string): PageResource {
  return {
    url,
    finalUrl: url,
    status: 200,
    ok: true,
    headers: { 'content-type': 'text/html' },
    body,
    timingMs: 1,
    redirectChain: [],
  };
}

function pageFail(url: string): PageResource {
  return {
    url,
    finalUrl: url,
    status: 0,
    ok: false,
    headers: {},
    timingMs: 1,
    redirectChain: [],
    error: 'request timed out',
  };
}

/** A mocked HttpClient that serves a fixed resource and never touches the network. */
function mockHttp(resource: PageResource): HttpClient {
  return {
    getText: async (): Promise<TextResponse> => ({ ok: false, status: 0, body: '', url: '' }),
    getResource: async () => resource,
  };
}

const noopOutreach: OutreachClient = {
  complete: async () => ({ text: 'unused', model: 'test' }),
};

function deps(http: HttpClient): ToolDeps {
  return { http, outreach: noopOutreach, maxResults: 5 };
}

/** Parse the structuredContent off a successful tool result. */
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

describe('verify_page_links tool', () => {
  it('finds a dofollow link to the target domain', async () => {
    const html = `
      <html><body>
        <a href="https://other.com/x">unrelated</a>
        <a href="https://www.target.com/landing">Great resource</a>
      </body></html>
    `;
    const tool = verifyPageLinksTool(deps(mockHttp(pageOk('https://blog.example/post', html))));
    const result = await tool.handler({
      url: 'https://blog.example/post',
      targetDomain: 'target.com',
    });
    const data = structured(result);

    expect(data.linkFound).toBe(true);
    expect(data.dofollowFound).toBe(true);
    expect(data.totalLinksOnPage).toBe(2);
    const matches = data.matches as Array<Record<string, unknown>>;
    expect(matches).toHaveLength(1);
    expect(matches[0]?.anchorText).toBe('Great resource');
    expect(matches[0]?.dofollow).toBe(true);
  });

  it('detects nofollow/sponsored rel attributes and marks the link not-dofollow', async () => {
    const html = `<a href="https://target.com/" rel="nofollow sponsored">paid</a>`;
    const tool = verifyPageLinksTool(deps(mockHttp(pageOk('https://blog.example/p', html))));
    const result = await tool.handler({
      url: 'https://blog.example/p',
      targetDomain: 'target.com',
    });
    const data = structured(result);

    expect(data.linkFound).toBe(true);
    expect(data.dofollowFound).toBe(false);
    const matches = data.matches as Array<Record<string, unknown>>;
    expect(matches[0]?.nofollow).toBe(true);
    expect(matches[0]?.sponsored).toBe(true);
  });

  it('matches subdomains of the target domain', async () => {
    const html = `<a href="https://docs.target.com/guide">docs</a>`;
    const tool = verifyPageLinksTool(deps(mockHttp(pageOk('https://x.example/p', html))));
    const result = await tool.handler({ url: 'https://x.example/p', targetDomain: 'target.com' });
    expect(structured(result).linkFound).toBe(true);
  });

  it('reports no link when the target domain is absent', async () => {
    const html = `<a href="https://elsewhere.com/">nope</a>`;
    const tool = verifyPageLinksTool(deps(mockHttp(pageOk('https://x.example/p', html))));
    const result = await tool.handler({ url: 'https://x.example/p', targetDomain: 'target.com' });
    const data = structured(result);
    expect(data.linkFound).toBe(false);
    expect(data.totalLinksOnPage).toBe(1);
  });

  it('degrades gracefully (no throw) when the fetch fails', async () => {
    const tool = verifyPageLinksTool(deps(mockHttp(pageFail('https://down.example/p'))));
    const result = await tool.handler({
      url: 'https://down.example/p',
      targetDomain: 'target.com',
    });
    const data = structured(result);
    expect(data.linkFound).toBe(false);
    expect(Array.isArray(data.warnings)).toBe(true);
    expect((data.warnings as string[]).join(' ')).toContain('Could not fetch');
  });
});
