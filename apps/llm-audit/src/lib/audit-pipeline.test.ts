import { describe, expect, it, vi } from 'vitest';
import type { CrawledPage, CrawlResult, RobotsTxt, SiteFilePresence } from '@aeo/types';
import { AuditError } from './errors.js';
import { analyzeCrawledPages, runAudit, type CrawlFn } from './audit-pipeline.js';

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>Sample Page — A Reasonably Long Descriptive Title</title>
    <meta name="description" content="A sample page used to exercise the audit pipeline end to end with real parsing and scoring." />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="canonical" href="https://example.com/" />
    <meta property="og:title" content="Sample Page" />
    <meta property="og:description" content="Sample description" />
    <meta property="og:image" content="https://example.com/og.png" />
    <meta property="og:url" content="https://example.com/" />
    <script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "Organization", "name": "Example Inc" }
    </script>
  </head>
  <body>
    <h1>Welcome to Example</h1>
    <h2>What is this?</h2>
    <p>This is a paragraph of meaningful content used to give the content scorer something to chew on. ${'word '.repeat(120)}</p>
    <img src="/logo.png" alt="The Example company logo" />
    <a href="https://example.com/about">About</a>
    <a href="https://external.example.org/">External</a>
  </body>
</html>`;

function makePage(overrides: Partial<CrawledPage> = {}): CrawledPage {
  return {
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    status: 200,
    ok: true,
    contentType: 'text/html; charset=utf-8',
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: SAMPLE_HTML,
    timingMs: 12,
    redirectChain: [],
    depth: 0,
    ...overrides,
  };
}

function makeCrawlResult(pages: CrawledPage[]): CrawlResult {
  const robots: RobotsTxt = {
    exists: true,
    url: 'https://example.com/robots.txt',
    sitemaps: ['https://example.com/sitemap.xml'],
    groups: [{ userAgents: ['*'], allow: [], disallow: [] }],
    aiBotDirectives: [],
  };
  const filePresence: SiteFilePresence = {
    robotsTxt: true,
    sitemapXml: true,
    llmsTxt: false,
    llmsFullTxt: false,
    favicon: true,
  };
  return {
    rootUrl: 'https://example.com/',
    https: true,
    pages,
    sitemap: [{ loc: 'https://example.com/' }],
    robots,
    filePresence,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    pageCount: pages.length,
  };
}

describe('analyzeCrawledPages', () => {
  it('parses only HTML pages with a body and skips the rest', () => {
    const crawl = makeCrawlResult([
      makePage(),
      makePage({
        url: 'https://example.com/img.png',
        ok: true,
        contentType: 'image/png',
        body: 'binary',
      }),
      makePage({ url: 'https://example.com/missing', ok: false, status: 404, body: undefined }),
    ]);

    const { pages, structuredData } = analyzeCrawledPages(crawl);

    expect(pages).toHaveLength(1);
    expect(structuredData).toHaveLength(1);
    expect(pages[0]?.url).toBe('https://example.com/');
    expect(pages[0]?.meta.title).toContain('Sample Page');
    expect(structuredData[0]?.hasOrganization).toBe(true);
  });

  it('keys parsed pages to the final (post-redirect) URL', () => {
    const crawl = makeCrawlResult([
      makePage({ url: 'https://example.com/old', finalUrl: 'https://example.com/new' }),
    ]);

    const { pages } = analyzeCrawledPages(crawl);

    expect(pages[0]?.url).toBe('https://example.com/new');
  });
});

describe('runAudit', () => {
  it('assembles a full-site ScoringContext and builds an AuditReport', async () => {
    const crawlResult = makeCrawlResult([makePage()]);
    const crawl = vi.fn<CrawlFn>().mockResolvedValue(crawlResult);

    const ticks = [1_000, 5_200];
    let i = 0;
    const now = () => ticks[Math.min(i++, ticks.length - 1)] ?? 0;

    const report = await runAudit({ url: 'https://example.com/', maxPages: 50 }, { crawl, now });

    expect(crawl).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOpts] = crawl.mock.calls[0] ?? [];
    expect(calledUrl).toBe('https://example.com/');
    expect(calledOpts).toMatchObject({ maxPages: 50, respectRobotsTxt: true, followSitemap: true });

    expect(report.url).toBe('https://example.com/');
    expect(report.pagesCrawled).toBe(1);
    expect(report.score.overall).toBeGreaterThanOrEqual(0);
    expect(report.score.overall).toBeLessThanOrEqual(100);
    expect(report.score.categories.length).toBeGreaterThan(0);
    expect(Array.isArray(report.topFixes)).toBe(true);
    expect(report.meta.durationMs).toBe(4_200);
    expect(report.meta.version).toBe('0.1.0');
    // An Organization-only page is missing llms.txt → a template should be generated.
    expect(report.templates.some((t) => t.filename === 'llms.txt')).toBe(true);
  });

  it('throws a typed crawl_failed AuditError when the crawler rejects', async () => {
    const crawl = vi.fn<CrawlFn>().mockRejectedValue(new Error('connection refused'));

    await expect(
      runAudit({ url: 'https://nope.example/', maxPages: 50 }, { crawl }),
    ).rejects.toMatchObject({ code: 'crawl_failed', status: 502 });
    await expect(
      runAudit({ url: 'https://nope.example/', maxPages: 50 }, { crawl }),
    ).rejects.toBeInstanceOf(AuditError);
  });

  it('throws a no_pages AuditError when the crawl returns zero pages', async () => {
    const crawl = vi.fn<CrawlFn>().mockResolvedValue(makeCrawlResult([]));

    await expect(
      runAudit({ url: 'https://example.com/', maxPages: 50 }, { crawl }),
    ).rejects.toMatchObject({ code: 'no_pages', status: 422 });
  });
});
