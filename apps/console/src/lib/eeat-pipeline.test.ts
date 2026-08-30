import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CrawledPage,
  CrawlResult,
  EeatReport,
  ParsedHtml,
  ScoringContext,
  StructuredDataReport,
} from '@advance-labs/types';

// --- Mock every @advance-labs/* engine so the pipeline is tested in isolation. ---
// vi.mock factories are hoisted above module init, so the mock fns must be created inside
// vi.hoisted() (not as plain top-level consts) to avoid "Cannot access X before initialization".

const mocks = vi.hoisted(() => ({
  parseHtml: vi.fn<(html: string, url: string) => ParsedHtml>(),
  analyzeStructuredData: vi.fn<(html: string, url: string) => StructuredDataReport>(),
  eeatScore: vi.fn<(ctx: ScoringContext) => EeatReport>(),
  crawl: vi.fn(),
}));

vi.mock('@advance-labs/crawler', () => ({ crawl: mocks.crawl }));
vi.mock('@advance-labs/html-parser', () => ({ parseHtml: mocks.parseHtml }));
vi.mock('@advance-labs/schema-validator', () => ({ analyzeStructuredData: mocks.analyzeStructuredData }));
vi.mock('@advance-labs/scoring', () => ({ eeatScore: mocks.eeatScore }));

const { parseHtml, analyzeStructuredData, eeatScore } = mocks;

import { runEeatAudit, type Crawler } from './eeat-pipeline.js';

function makePage(overrides: Partial<CrawledPage>): CrawledPage {
  return {
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    status: 200,
    ok: true,
    contentType: 'text/html; charset=utf-8',
    headers: {},
    body: '<html><body>hi</body></html>',
    timingMs: 1,
    redirectChain: [],
    depth: 0,
    ...overrides,
  };
}

function makeCrawlResult(pages: CrawledPage[]): CrawlResult {
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
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    pageCount: pages.length,
  };
}

const REPORT: EeatReport = {
  url: 'https://example.com/',
  generatedAt: '2026-01-01T00:00:01.000Z',
  overall: 72,
  grade: 'C',
  pillars: [],
  pagesCrawled: 0,
  improvements: [],
};

const PARSED: ParsedHtml = {
  url: 'https://example.com/',
  meta: { titleLength: 0, descriptionLength: 0 },
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

const SD_REPORT: StructuredDataReport = {
  items: [],
  typesPresent: [],
  aeoTypesPresent: [],
  hasOrganization: false,
  hasPerson: false,
  hasArticle: false,
  hasBreadcrumb: false,
  hasFaqOrQa: false,
  totalItems: 0,
  invalidCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  parseHtml.mockReturnValue(PARSED);
  analyzeStructuredData.mockReturnValue(SD_REPORT);
  eeatScore.mockReturnValue(REPORT);
});

describe('runEeatAudit', () => {
  it('parses only OK HTML pages and feeds a full-site ScoringContext to eeatScore', async () => {
    const pages = [
      makePage({ url: 'https://example.com/', body: '<html>a</html>' }),
      makePage({ url: 'https://example.com/about', body: '<html>b</html>' }),
      // Non-OK page: skipped.
      makePage({ url: 'https://example.com/404', ok: false, status: 404 }),
      // Non-HTML asset: skipped.
      makePage({ url: 'https://example.com/x.pdf', contentType: 'application/pdf' }),
      // Empty body: skipped.
      makePage({ url: 'https://example.com/empty', body: '' }),
    ];
    const fakeCrawler: Crawler = vi.fn(async () => makeCrawlResult(pages));

    const report = await runEeatAudit('https://example.com/', { crawler: fakeCrawler });

    expect(report).toBe(REPORT);
    expect(parseHtml).toHaveBeenCalledTimes(2);
    expect(analyzeStructuredData).toHaveBeenCalledTimes(2);

    expect(eeatScore).toHaveBeenCalledTimes(1);
    const ctx = eeatScore.mock.calls[0]?.[0];
    expect(ctx?.pages).toHaveLength(2);
    expect(ctx?.structuredData).toHaveLength(2);
    expect(ctx?.mode).toBe('full-site');
  });

  it('uses single-page mode when at most one page parses', async () => {
    const pages = [makePage({ url: 'https://example.com/', body: '<html>only</html>' })];
    const fakeCrawler: Crawler = vi.fn(async () => makeCrawlResult(pages));

    await runEeatAudit('https://example.com/', { crawler: fakeCrawler });

    const ctx = eeatScore.mock.calls[0]?.[0];
    expect(ctx?.mode).toBe('single-page');
  });

  it('passes the page cap through to the crawler', async () => {
    const fakeCrawler = vi.fn(async () => makeCrawlResult([]));

    await runEeatAudit('https://example.com/', { crawler: fakeCrawler, maxPages: 12 });

    expect(fakeCrawler).toHaveBeenCalledWith('https://example.com/', { maxPages: 12 });
  });

  it('parses against the final (post-redirect) URL', async () => {
    const pages = [
      makePage({
        url: 'https://example.com/old',
        finalUrl: 'https://example.com/new',
        body: '<html>moved</html>',
      }),
    ];
    const fakeCrawler: Crawler = vi.fn(async () => makeCrawlResult(pages));

    await runEeatAudit('https://example.com/', { crawler: fakeCrawler });

    expect(parseHtml).toHaveBeenCalledWith('<html>moved</html>', 'https://example.com/new');
  });
});
