/**
 * Test-only fixtures and fakes. Imported solely by `*.test.ts` files; never by
 * production code.
 */
import type {
  Citation,
  CrawlResult,
  LlmCompletionResponse,
  ParsedHtml,
  Score,
  StructuredDataReport,
} from '@aeo/types';

import type { ToolDeps } from './deps.js';

/** A minimal but type-complete `CrawlResult` with `n` fetched HTML pages. */
export function fakeCrawl(rootUrl: string, n = 1): CrawlResult {
  const pages = Array.from({ length: n }, (_, i) => ({
    url: `${rootUrl}/p${i}`,
    finalUrl: `${rootUrl}/p${i}`,
    status: 200,
    ok: true,
    contentType: 'text/html',
    headers: {},
    body: `<html><body><h1>Page ${i}</h1></body></html>`,
    timingMs: 1,
    redirectChain: [],
    depth: 0,
  }));

  return {
    rootUrl,
    https: rootUrl.startsWith('https:'),
    pages,
    sitemap: [],
    robots: {
      exists: true,
      url: `${rootUrl}/robots.txt`,
      sitemaps: [],
      groups: [],
      aiBotDirectives: [
        { bot: 'GPTBot', allowed: true },
        { bot: 'PerplexityBot', allowed: false },
      ],
    },
    filePresence: {
      robotsTxt: true,
      sitemapXml: true,
      llmsTxt: false,
      llmsFullTxt: false,
      favicon: true,
    },
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    pageCount: n,
  };
}

/** A trivial `ParsedHtml` — enough to satisfy the type; content is unused by these tests. */
export function fakeParsed(url: string): ParsedHtml {
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

export function fakeSchema(): StructuredDataReport {
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

/** A `Score` with the AEO + structured-data categories populated. */
export function fakeScore(): Score {
  return {
    overall: 72,
    grade: 'C',
    passedCount: 10,
    failedCount: 4,
    criticalCount: 1,
    categories: [
      {
        key: 'aeo',
        label: 'AEO',
        score: 65,
        weight: 1,
        passedCount: 3,
        failedCount: 2,
        findings: [
          {
            id: 'aeo-faq',
            category: 'aeo',
            severity: 'high',
            title: 'Add FAQ schema',
            description: 'No FAQPage schema found.',
            recommendation: 'Add FAQPage structured data.',
            passed: false,
            weight: 8,
          },
          {
            id: 'aeo-llms-txt',
            category: 'aeo',
            severity: 'critical',
            title: 'Add llms.txt',
            description: 'No llms.txt present.',
            recommendation: 'Publish an llms.txt file.',
            passed: false,
            weight: 10,
          },
        ],
      },
      {
        key: 'structured-data',
        label: 'Structured Data',
        score: 80,
        weight: 1,
        passedCount: 4,
        failedCount: 1,
        findings: [],
      },
    ],
  };
}

export interface DepsCalls {
  crawl: Array<{ url: string }>;
  complete: Array<{ provider: string; model: string; prompt: string }>;
}

export interface FakeDepsOptions {
  crawl?: CrawlResult | (() => CrawlResult | Promise<CrawlResult>);
  /** Citations the fake `complete` returns for visibility calls. */
  citations?: Citation[];
  /** Text the fake `complete` returns (used by prompt discovery). */
  text?: string;
}

/** Build a `ToolDeps` whose network functions are deterministic fakes. */
export function fakeDeps(opts: FakeDepsOptions = {}): { deps: ToolDeps; calls: DepsCalls } {
  const calls: DepsCalls = { crawl: [], complete: [] };

  const deps: ToolDeps = {
    crawl: async (url) => {
      calls.crawl.push({ url });
      if (typeof opts.crawl === 'function') return opts.crawl();
      return opts.crawl ?? fakeCrawl(url, 1);
    },
    parseHtml: (_html, url) => fakeParsed(url),
    analyzeStructuredData: () => fakeSchema(),
    complete: async (req) => {
      const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
      calls.complete.push({
        provider: req.provider,
        model: req.model,
        prompt: lastUser?.content ?? '',
      });
      const res: LlmCompletionResponse = {
        text: opts.text ?? '',
        model: req.model,
        citations: opts.citations ?? [],
      };
      return res;
    },
  };

  return { deps, calls };
}
