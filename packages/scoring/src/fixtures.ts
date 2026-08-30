/**
 * Test fixtures: a fully-optimized "good" site and a neglected "poor" site,
 * plus builders so individual tests can tweak one field without rebuilding the
 * whole context. Not part of the public API (not re-exported from index.ts) —
 * imported only by the co-located *.test.ts files.
 */
import type {
  AiBotDirective,
  CrawledPage,
  ParsedHtml,
  ScoringContext,
  ScoringMode,
  SiteFilePresence,
  StructuredDataReport,
} from '@advance-labs/types';
import { KEY_AI_BOTS } from './context-utils.js';

function crawledPage(url: string, overrides: Partial<CrawledPage> = {}): CrawledPage {
  return {
    url,
    finalUrl: url,
    status: 200,
    ok: true,
    headers: {},
    timingMs: 120,
    redirectChain: [],
    depth: 0,
    ...overrides,
  };
}

function goodParsedPage(url: string, overrides: Partial<ParsedHtml> = {}): ParsedHtml {
  return {
    url,
    meta: {
      title: 'A Thoroughly Optimized Page Title For Search',
      titleLength: 45,
      description:
        'This is a well-crafted meta description that sits comfortably within the recommended length window for snippets in search results.',
      descriptionLength: 130,
      canonical: url,
      robots: 'index, follow',
      viewport: 'width=device-width, initial-scale=1',
      charset: 'utf-8',
      lang: 'en',
    },
    openGraph: {
      title: 'A Thoroughly Optimized Page Title',
      description: 'OG description',
      type: 'website',
      url,
      image: 'https://good.example.com/og.png',
      complete: true,
    },
    twitter: { card: 'summary_large_image', title: 'T', description: 'D' },
    headings: [
      { level: 1, text: 'Main Topic' },
      { level: 2, text: 'How does it work?' },
      { level: 3, text: 'Details' },
    ],
    headingHierarchyValid: true,
    images: [
      { src: 'https://good.example.com/a.png', alt: 'descriptive', hasAlt: true },
      { src: 'https://good.example.com/b.png', alt: 'also descriptive', hasAlt: true },
    ],
    imageAltCoverage: 1,
    links: [],
    internalLinkCount: 8,
    externalLinkCount: 4,
    content: {
      wordCount: 1200,
      hasFaq: true,
      hasHowTo: true,
      questionHeadingCount: 3,
      paragraphCount: 12,
      listCount: 4,
      tableCount: 1,
      scriptCount: 3,
      hasEmptyAppShell: false,
    },
    rawStructuredData: [],
    ...overrides,
  };
}

function poorParsedPage(url: string, overrides: Partial<ParsedHtml> = {}): ParsedHtml {
  return {
    url,
    meta: {
      title: 'Home',
      titleLength: 4,
      descriptionLength: 0,
      robots: 'noindex',
      // no canonical, no viewport, no lang
    },
    openGraph: { complete: false },
    twitter: {},
    headings: [
      { level: 1, text: 'Welcome' },
      { level: 1, text: 'Also a heading' },
      { level: 4, text: 'Skipped levels' },
    ],
    headingHierarchyValid: false,
    images: [
      { src: 'https://poor.example.com/a.png', hasAlt: false },
      { src: 'https://poor.example.com/b.png', hasAlt: false },
    ],
    imageAltCoverage: 0,
    links: [],
    internalLinkCount: 0,
    externalLinkCount: 0,
    content: {
      wordCount: 40,
      hasFaq: false,
      hasHowTo: false,
      questionHeadingCount: 0,
      paragraphCount: 1,
      listCount: 0,
      tableCount: 0,
      // Thin, but genuinely server-rendered: the fix here is "write more", which is a
      // DIFFERENT fix from the client-rendered case below. Keeping them separate is the
      // point of the new rule.
      scriptCount: 2,
      hasEmptyAppShell: false,
    },
    rawStructuredData: [],
    ...overrides,
  };
}

function richStructured(overrides: Partial<StructuredDataReport> = {}): StructuredDataReport {
  return {
    items: [],
    typesPresent: ['Organization', 'Article', 'Person', 'FAQPage', 'BreadcrumbList'],
    aeoTypesPresent: ['Organization', 'Article', 'Person', 'FAQPage', 'BreadcrumbList', 'HowTo'],
    hasOrganization: true,
    hasPerson: true,
    hasArticle: true,
    hasBreadcrumb: true,
    hasFaqOrQa: true,
    totalItems: 5,
    invalidCount: 0,
    ...overrides,
  };
}

function emptyStructured(overrides: Partial<StructuredDataReport> = {}): StructuredDataReport {
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
    ...overrides,
  };
}

const allBotsAllowed: AiBotDirective[] = KEY_AI_BOTS.map((bot) => ({ bot, allowed: true }));
const keyBotsBlocked: AiBotDirective[] = KEY_AI_BOTS.map((bot) => ({ bot, allowed: false }));

const goodPresence: SiteFilePresence = {
  robotsTxt: true,
  sitemapXml: true,
  llmsTxt: true,
  llmsFullTxt: true,
  favicon: true,
};

const poorPresence: SiteFilePresence = {
  robotsTxt: false,
  sitemapXml: false,
  llmsTxt: false,
  llmsFullTxt: false,
  favicon: false,
};

/** A fully-optimized multi-page site that should score high. */
export function goodContext(mode: ScoringMode = 'full-site'): ScoringContext {
  const root = 'https://good.example.com/';
  const urls = [
    root,
    'https://good.example.com/about',
    'https://good.example.com/contact',
    'https://good.example.com/privacy',
    'https://good.example.com/blog/post-1',
  ];
  return {
    mode,
    crawl: {
      rootUrl: root,
      https: true,
      pages: urls.map((u, i) => crawledPage(u, { depth: i === 0 ? 0 : 1 })),
      sitemap: urls.map((loc) => ({ loc })),
      robots: {
        exists: true,
        url: 'https://good.example.com/robots.txt',
        sitemaps: ['https://good.example.com/sitemap.xml'],
        groups: [{ userAgents: ['*'], allow: ['/'], disallow: [] }],
        aiBotDirectives: allBotsAllowed,
      },
      filePresence: goodPresence,
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:05.000Z',
      pageCount: urls.length,
    },
    pages: [
      goodParsedPage(root, {
        meta: { ...goodParsedPage(root).meta, title: 'Good Example — Home Page Title Here' },
      }),
      goodParsedPage('https://good.example.com/about', {
        meta: {
          ...goodParsedPage('https://good.example.com/about').meta,
          title: 'About Good Example — Our Team',
        },
      }),
      goodParsedPage('https://good.example.com/contact', {
        meta: {
          ...goodParsedPage('https://good.example.com/contact').meta,
          title: 'Contact Good Example Support',
        },
      }),
      goodParsedPage('https://good.example.com/privacy', {
        meta: {
          ...goodParsedPage('https://good.example.com/privacy').meta,
          title: 'Privacy Policy — Good Example',
        },
      }),
      goodParsedPage('https://good.example.com/blog/post-1', {
        meta: {
          ...goodParsedPage('https://good.example.com/blog/post-1').meta,
          title: 'How To Do The Thing — Good Example Blog',
        },
      }),
    ],
    structuredData: [richStructured()],
  };
}

/** A neglected single-domain site that should score low. */
export function poorContext(mode: ScoringMode = 'full-site'): ScoringContext {
  const root = 'http://poor.example.com/';
  return {
    mode,
    crawl: {
      rootUrl: root,
      https: false,
      pages: [
        crawledPage(root),
        crawledPage('http://poor.example.com/missing', { status: 404, ok: false }),
        crawledPage('http://poor.example.com/loop', {
          redirectChain: [
            { url: 'http://poor.example.com/a', status: 301 },
            { url: 'http://poor.example.com/b', status: 301 },
            { url: 'http://poor.example.com/c', status: 301 },
          ],
        }),
      ],
      sitemap: [],
      robots: {
        exists: false,
        url: 'http://poor.example.com/robots.txt',
        sitemaps: [],
        groups: [],
        aiBotDirectives: keyBotsBlocked,
      },
      filePresence: poorPresence,
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:05.000Z',
      pageCount: 3,
    },
    pages: [poorParsedPage(root)],
    structuredData: [emptyStructured()],
  };
}

/** A single-page context (Chrome-extension mode) — one parsed page, mode flag set. */
export function singlePageContext(): ScoringContext {
  const ctx = goodContext('single-page');
  return {
    ...ctx,
    crawl: { ...ctx.crawl, pages: ctx.crawl.pages.slice(0, 1), pageCount: 1 },
    pages: ctx.pages.slice(0, 1),
  };
}

/**
 * A site that is excellent in a browser and empty to a crawler: an app shell with no
 * visible text, plus the script tags that would fill it.
 *
 * Deliberately distinct from `poorContext`, which is thin AND server-rendered. The two
 * produce the same low word count and need opposite fixes, which is exactly the confusion
 * `aeo.content-server-rendered` exists to resolve.
 */
export function clientRenderedContext(): ScoringContext {
  const ctx = goodContext('single-page');
  const page = ctx.pages[0];
  if (page === undefined) throw new Error('goodContext must have at least one page');
  const shellPage = {
    ...page,
    content: {
      ...page.content,
      wordCount: 12,
      paragraphCount: 0,
      listCount: 0,
      tableCount: 0,
      questionHeadingCount: 0,
      scriptCount: 9,
      hasEmptyAppShell: true,
    },
  };
  return {
    ...ctx,
    crawl: { ...ctx.crawl, pages: ctx.crawl.pages.slice(0, 1), pageCount: 1 },
    pages: [shellPage],
  };
}

/** A context with empty arrays everywhere — should never throw. */
export function emptyContext(): ScoringContext {
  return {
    mode: 'single-page',
    crawl: {
      rootUrl: 'https://empty.example.com/',
      https: true,
      pages: [],
      sitemap: [],
      robots: {
        exists: false,
        url: 'https://empty.example.com/robots.txt',
        sitemaps: [],
        groups: [],
        aiBotDirectives: [],
      },
      filePresence: poorPresence,
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:00.000Z',
      pageCount: 0,
    },
    pages: [],
    structuredData: [],
  };
}
