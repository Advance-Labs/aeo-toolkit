import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditReport, ParsedHtml, ScoringContext, StructuredDataReport } from '@advance-labs/types';
import type { SiteFiles } from './site-files.js';

// --- Mock the @advance-labs/* packages so the test exercises THIS app's wiring only. ---
const parseHtmlMock = vi.fn<(html: string, url: string) => ParsedHtml>();
const analyzeMock = vi.fn<(html: string, url: string) => StructuredDataReport>();
const buildAuditReportMock =
  vi.fn<
    (ctx: ScoringContext, opts: { durationMs: number; version: string }) => Promise<AuditReport>
  >();

vi.mock('@advance-labs/html-parser', () => ({ parseHtml: (h: string, u: string) => parseHtmlMock(h, u) }));
vi.mock('@advance-labs/schema-validator', () => ({
  analyzeStructuredData: (h: string, u: string) => analyzeMock(h, u),
}));
vi.mock('@advance-labs/scoring', () => ({
  buildAuditReport: (ctx: ScoringContext, opts: { durationMs: number; version: string }) =>
    buildAuditReportMock(ctx, opts),
}));

const { buildSinglePageContext, runAudit, originOf, toCheckRows } = await import('./audit.js');

function fakeParsed(url: string): ParsedHtml {
  return {
    url,
    meta: { titleLength: 0, descriptionLength: 0 },
    openGraph: { complete: false },
    twitter: {},
    headings: [],
    headingHierarchyValid: true,
    images: [],
    imageAltCoverage: 1,
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
}

function fakeStructured(): StructuredDataReport {
  return {
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
}

function siteFiles(overrides: Partial<SiteFiles> = {}): SiteFiles {
  const absent = { body: null, exists: false };
  return {
    robotsTxt: absent,
    sitemapXml: absent,
    llmsTxt: absent,
    llmsFullTxt: absent,
    favicon: absent,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  parseHtmlMock.mockImplementation((_h, u) => fakeParsed(u));
  analyzeMock.mockImplementation(() => fakeStructured());
});

describe('originOf', () => {
  it('extracts scheme + host', () => {
    expect(originOf('https://example.com/a/b?x=1')).toBe('https://example.com');
  });
  it('returns the raw input when unparseable', () => {
    expect(originOf('not a url')).toBe('not a url');
  });
});

describe('buildSinglePageContext', () => {
  it('assembles a single-page ScoringContext with one page and parsed robots/sitemap', () => {
    const { ctx } = buildSinglePageContext({
      pageUrl: 'https://example.com/page',
      html: '<html></html>',
      startedAtMs: Date.now(),
      siteFiles: siteFiles({
        robotsTxt: { body: 'User-agent: *\nDisallow:', exists: true },
        sitemapXml: {
          body: '<urlset><url><loc>https://example.com/</loc></url></urlset>',
          exists: true,
        },
        llmsTxt: { body: '# llms', exists: true },
      }),
    });

    expect(ctx.mode).toBe('single-page');
    expect(ctx.pages).toHaveLength(1);
    expect(ctx.structuredData).toHaveLength(1);
    expect(ctx.crawl.pageCount).toBe(1);
    expect(ctx.crawl.https).toBe(true);
    expect(ctx.crawl.robots.exists).toBe(true);
    expect(ctx.crawl.sitemap).toHaveLength(1);
    expect(ctx.crawl.filePresence.llmsTxt).toBe(true);
    expect(ctx.crawl.filePresence.favicon).toBe(false);
    expect(ctx.crawl.pages[0]?.url).toBe('https://example.com/page');
  });
});

describe('runAudit', () => {
  it('runs buildAuditReport and returns a payload mirroring the fetched files', async () => {
    const report: AuditReport = {
      url: 'https://example.com/page',
      generatedAt: new Date().toISOString(),
      score: {
        overall: 72,
        grade: 'C',
        categories: [
          {
            key: 'metadata',
            label: 'Metadata',
            score: 50,
            weight: 1,
            passedCount: 1,
            failedCount: 1,
            findings: [
              {
                id: 'meta-title',
                category: 'metadata',
                severity: 'high',
                title: 'Title present',
                description: '',
                recommendation: 'Add a title',
                passed: true,
                weight: 2,
              },
              {
                id: 'meta-desc',
                category: 'metadata',
                severity: 'medium',
                title: 'Description present',
                description: '',
                recommendation: 'Add a meta description',
                passed: false,
                weight: 1,
              },
            ],
          },
        ],
        passedCount: 1,
        failedCount: 1,
        criticalCount: 0,
      },
      pagesCrawled: 1,
      topFixes: [],
      templates: [],
      meta: { durationMs: 0, crawler: 'aeo-chrome-extension', version: '0.1.0' },
    };
    buildAuditReportMock.mockResolvedValue(report);

    const payload = await runAudit({
      pageUrl: 'https://example.com/page',
      html: '<html></html>',
      startedAtMs: Date.now() - 10,
      siteFiles: siteFiles({ robotsTxt: { body: 'User-agent: *', exists: true } }),
    });

    expect(buildAuditReportMock).toHaveBeenCalledOnce();
    const [, opts] = buildAuditReportMock.mock.calls[0] ?? [];
    expect(opts?.version).toBe('0.1.0');
    expect(opts?.durationMs).toBeGreaterThanOrEqual(0);

    expect(payload.origin).toBe('https://example.com');
    expect(payload.report).toBe(report);
    expect(payload.siteFiles.robotsTxt).toBe('User-agent: *');
    expect(payload.siteFiles.llmsTxt).toBeNull();

    const rows = toCheckRows(payload);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === 'meta-desc')?.passed).toBe(false);
  });
});
