import { describe, expect, it, vi } from 'vitest';
import type { CrawledPage, CrawlResult } from '@aeo/types';
import { generateLlmsTxt } from './generate';

// Mock @aeo/html-parser so the test exercises the pipeline without cheerio/HTML parsing.
vi.mock('@aeo/html-parser', () => ({
  parseHtml: (html: string, url: string) => {
    // Title encoded in the fake body as `TITLE:<text>`; description as `DESC:<text>`.
    const title = /TITLE:([^\n]+)/.exec(html)?.[1]?.trim();
    const description = /DESC:([^\n]+)/.exec(html)?.[1]?.trim();
    return {
      url,
      meta: {
        title,
        titleLength: title?.length ?? 0,
        description,
        descriptionLength: description?.length ?? 0,
      },
      openGraph: { complete: false },
      twitter: {},
      headings: [],
      headingHierarchyValid: true,
      images: [],
      imageAltCoverage: 0,
      links: [],
      internalLinkCount: 0,
      externalLinkCount: 0,
      content: {
        wordCount: 0,
        hasFaq: false,
        hasHowTo: false,
        questionHeadingCount: 0,
        paragraphCount: 0,
        listCount: 0,
        tableCount: 0,
      },
      rawStructuredData: [],
    };
  },
}));

function page(url: string, body: string, overrides: Partial<CrawledPage> = {}): CrawledPage {
  return {
    url,
    finalUrl: url,
    status: 200,
    ok: true,
    contentType: 'text/html',
    headers: {},
    body,
    timingMs: 1,
    redirectChain: [],
    depth: 0,
    ...overrides,
  };
}

function fakeCrawlResult(pages: CrawledPage[]): CrawlResult {
  return {
    rootUrl: 'https://example.com/',
    https: true,
    pages,
    sitemap: [],
    robots: {
      exists: false,
      url: 'https://example.com/robots.txt',
      sitemaps: [],
      groups: [],
      aiBotDirectives: [],
    },
    filePresence: {
      robotsTxt: false,
      sitemapXml: false,
      llmsTxt: false,
      llmsFullTxt: false,
      favicon: false,
    },
    startedAt: '2024-01-01T00:00:00.000Z',
    finishedAt: '2024-01-01T00:00:01.000Z',
    pageCount: pages.length,
  };
}

describe('generateLlmsTxt', () => {
  it('runs the pipeline with an injected crawler and renders llms.txt', async () => {
    const crawl = vi.fn(async () =>
      fakeCrawlResult([
        page('https://example.com/', 'TITLE:Example Home\nDESC:The example homepage.'),
        page('https://example.com/docs/start', 'TITLE:Getting Started\nDESC:Begin here.'),
        page('https://example.com/blog/post', 'TITLE:First Post'),
      ]),
    );

    const result = await generateLlmsTxt('https://example.com/', { crawl });

    expect(crawl).toHaveBeenCalledOnce();
    expect(result.pageCount).toBe(3);
    expect(result.manifest.siteName).toBe('Example');
    expect(result.manifest.summary).toBe('The example homepage.');
    expect(result.llmsTxt).toContain('# Example');
    expect(result.llmsTxt).toContain('## Docs');
    expect(result.llmsTxt).toContain(
      '- [Getting Started](https://example.com/docs/start): Begin here.',
    );
    expect(result.llmsTxt).toContain('## Blog');
    expect(result.llmsFullTxt).toBeUndefined();
  });

  it('includes llms-full.txt when full is requested', async () => {
    const crawl = vi.fn(async () =>
      fakeCrawlResult([page('https://example.com/docs/x', 'TITLE:X Page\nDESC:All about X.')]),
    );

    const result = await generateLlmsTxt('https://example.com/', { crawl, full: true });

    expect(result.llmsFullTxt).toBeDefined();
    expect(result.llmsFullTxt).toContain('## X Page');
    expect(result.llmsFullTxt).toContain('Source: https://example.com/docs/x');
    expect(result.llmsFullTxt).toContain('All about X.');
  });

  it('skips non-ok and non-html pages', async () => {
    const crawl = vi.fn(async () =>
      fakeCrawlResult([
        page('https://example.com/ok', 'TITLE:OK'),
        page('https://example.com/missing', '', { ok: false, status: 404 }),
        page('https://example.com/data.json', '{}', { contentType: 'application/json' }),
      ]),
    );

    const result = await generateLlmsTxt('https://example.com/', { crawl });
    expect(result.pageCount).toBe(1);
  });
});
