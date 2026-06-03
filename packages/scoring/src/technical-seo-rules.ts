/**
 * `technicalSeoRules` — the core technical-SEO + on-page rule set.
 *
 * Rules span crawlability, indexing, metadata, structured-data, content,
 * mobile, security, and social. Every `evaluate` reads the context defensively:
 * arrays may be empty and indexes may be `undefined`. Rules whose signal needs
 * multi-page crawl data degrade gracefully in `single-page` mode (they pass
 * rather than penalize a context that physically cannot supply the data).
 */
import type { Rule, ScoringContext } from '@aeo/types';
import {
  brokenPages,
  everyPage,
  firstPage,
  firstStructured,
  isNoindex,
  longRedirectChains,
  meanOverPages,
  pagesFailing,
} from './context-utils.js';

const META_TITLE_MIN = 30;
const META_TITLE_MAX = 60;
const META_DESC_MIN = 70;
const META_DESC_MAX = 160;
const ALT_COVERAGE_MIN = 0.8;
const MAX_REDIRECT_HOPS = 2;

/** Is this a multi-page context (vs the single-page extension mode)? */
function isMultiPage(ctx: ScoringContext): boolean {
  return ctx.mode !== 'single-page' && ctx.crawl.pages.length > 1;
}

export const technicalSeoRules: Rule[] = [
  // ── Crawlability ──────────────────────────────────────────────────────────
  {
    id: 'tech.robots-present',
    category: 'crawlability',
    severity: 'high',
    weight: 8,
    title: 'robots.txt is present',
    description: 'A robots.txt tells crawlers which paths they may fetch.',
    recommendation: 'Add a robots.txt at the site root referencing your sitemap.',
    docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
    evaluate: (ctx) => ({ passed: ctx.crawl.filePresence.robotsTxt }),
  },
  {
    id: 'tech.sitemap-present',
    category: 'crawlability',
    severity: 'high',
    weight: 8,
    title: 'XML sitemap is present',
    description: 'A sitemap helps engines discover all indexable URLs.',
    recommendation: 'Publish a sitemap.xml and reference it from robots.txt.',
    docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview',
    evaluate: (ctx) => ({
      passed: ctx.crawl.filePresence.sitemapXml || ctx.crawl.sitemap.length > 0,
    }),
  },
  {
    id: 'tech.llms-txt-present',
    category: 'crawlability',
    severity: 'medium',
    weight: 5,
    title: 'llms.txt is present',
    description: 'llms.txt curates the content you want answer engines to read.',
    recommendation: 'Generate an llms.txt manifest of your key pages.',
    docsUrl: 'https://llmstxt.org/',
    evaluate: (ctx) => ({ passed: ctx.crawl.filePresence.llmsTxt }),
  },
  {
    id: 'tech.no-broken-pages',
    category: 'crawlability',
    severity: 'high',
    weight: 7,
    title: 'No broken (4xx/5xx) pages',
    description: 'Broken pages waste crawl budget and frustrate users.',
    recommendation: 'Fix or redirect URLs returning 4xx/5xx status codes.',
    evaluate: (ctx) => {
      const broken = brokenPages(ctx);
      return broken.length === 0
        ? { passed: true }
        : {
            passed: false,
            affectedUrls: broken.map((p) => p.url),
            detail: `${broken.length} broken page(s).`,
          };
    },
  },
  {
    id: 'tech.short-redirect-chains',
    category: 'crawlability',
    severity: 'medium',
    weight: 4,
    title: 'Redirect chains are short',
    description: `Redirect chains longer than ${MAX_REDIRECT_HOPS} hops slow crawlers and dilute signals.`,
    recommendation: 'Collapse multi-hop redirects to a single 301.',
    evaluate: (ctx) => {
      const long = longRedirectChains(ctx, MAX_REDIRECT_HOPS);
      return long.length === 0 ? { passed: true } : { passed: false, affectedUrls: long };
    },
  },

  // ── Indexing ──────────────────────────────────────────────────────────────
  {
    id: 'tech.indexable',
    category: 'indexing',
    severity: 'critical',
    weight: 9,
    title: 'Pages are indexable (no accidental noindex)',
    description: 'A noindex directive removes a page from search and answer engines.',
    recommendation: 'Remove noindex from pages you want discovered.',
    evaluate: (ctx) => {
      const noindexed = pagesFailing(ctx, (p) => !isNoindex(p));
      return noindexed.length === 0
        ? { passed: true }
        : {
            passed: false,
            affectedUrls: noindexed,
            detail: `${noindexed.length} page(s) marked noindex.`,
          };
    },
  },
  {
    id: 'tech.canonical-present',
    category: 'indexing',
    severity: 'medium',
    weight: 5,
    title: 'Canonical URL is declared',
    description: 'A canonical tag consolidates duplicate URLs to one preferred address.',
    recommendation: 'Add <link rel="canonical"> to every indexable page.',
    evaluate: (ctx) => {
      const missing = pagesFailing(ctx, (p) => Boolean(p.meta.canonical));
      return missing.length === 0 ? { passed: true } : { passed: false, affectedUrls: missing };
    },
  },

  // ── Metadata ──────────────────────────────────────────────────────────────
  {
    id: 'tech.meta-title-present',
    category: 'metadata',
    severity: 'high',
    weight: 7,
    title: 'Pages have a title tag',
    description: 'The <title> is the strongest on-page relevance signal.',
    recommendation: 'Give every page a unique, descriptive <title>.',
    evaluate: (ctx) => {
      const missing = pagesFailing(ctx, (p) => Boolean(p.meta.title));
      return missing.length === 0 ? { passed: true } : { passed: false, affectedUrls: missing };
    },
  },
  {
    id: 'tech.meta-title-length',
    category: 'metadata',
    severity: 'medium',
    weight: 4,
    title: `Title length is ${META_TITLE_MIN}–${META_TITLE_MAX} characters`,
    description: 'Titles outside this range get truncated or look thin in results.',
    recommendation: `Aim for ${META_TITLE_MIN}–${META_TITLE_MAX} characters in each <title>.`,
    evaluate: (ctx) => {
      const bad = pagesFailing(
        ctx,
        (p) => p.meta.titleLength >= META_TITLE_MIN && p.meta.titleLength <= META_TITLE_MAX,
      );
      return bad.length === 0 ? { passed: true } : { passed: false, affectedUrls: bad };
    },
  },
  {
    id: 'tech.meta-description-present',
    category: 'metadata',
    severity: 'medium',
    weight: 4,
    title: 'Pages have a meta description',
    description: 'The meta description drives click-through from result snippets.',
    recommendation: 'Write a unique meta description for every page.',
    evaluate: (ctx) => {
      const missing = pagesFailing(ctx, (p) => Boolean(p.meta.description));
      return missing.length === 0 ? { passed: true } : { passed: false, affectedUrls: missing };
    },
  },
  {
    id: 'tech.meta-description-length',
    category: 'metadata',
    severity: 'low',
    weight: 3,
    title: `Description length is ${META_DESC_MIN}–${META_DESC_MAX} characters`,
    description: 'Descriptions outside this range get truncated or look incomplete.',
    recommendation: `Aim for ${META_DESC_MIN}–${META_DESC_MAX} characters per description.`,
    evaluate: (ctx) => {
      const bad = pagesFailing(
        ctx,
        (p) =>
          p.meta.descriptionLength >= META_DESC_MIN && p.meta.descriptionLength <= META_DESC_MAX,
      );
      return bad.length === 0 ? { passed: true } : { passed: false, affectedUrls: bad };
    },
  },
  {
    id: 'tech.single-h1',
    category: 'metadata',
    severity: 'medium',
    weight: 4,
    title: 'Each page has exactly one H1',
    description: 'A single H1 communicates the primary topic unambiguously.',
    recommendation: 'Use one H1 per page; demote extras to H2/H3.',
    evaluate: (ctx) => {
      const bad = pagesFailing(ctx, (p) => p.headings.filter((h) => h.level === 1).length === 1);
      return bad.length === 0 ? { passed: true } : { passed: false, affectedUrls: bad };
    },
  },
  {
    id: 'tech.heading-hierarchy',
    category: 'metadata',
    severity: 'low',
    weight: 3,
    title: 'Heading hierarchy is valid',
    description: 'Headings should descend without skipping levels (h1→h2→h3).',
    recommendation: 'Avoid jumping heading levels; keep a logical outline.',
    evaluate: (ctx) => {
      const bad = pagesFailing(ctx, (p) => p.headingHierarchyValid);
      return bad.length === 0 ? { passed: true } : { passed: false, affectedUrls: bad };
    },
  },

  // ── Content ───────────────────────────────────────────────────────────────
  {
    id: 'tech.image-alt-coverage',
    category: 'content',
    severity: 'medium',
    weight: 4,
    title: `Image alt-text coverage is above ${Math.round(ALT_COVERAGE_MIN * 100)}%`,
    description: 'Alt text makes images accessible and indexable.',
    recommendation: 'Add descriptive alt text to images that lack it.',
    evaluate: (ctx) => {
      // Pages with zero images have coverage of 1 by convention upstream; guard anyway.
      const bad = pagesFailing(
        ctx,
        (p) => p.images.length === 0 || p.imageAltCoverage >= ALT_COVERAGE_MIN,
      );
      return bad.length === 0 ? { passed: true } : { passed: false, affectedUrls: bad };
    },
  },
  {
    id: 'tech.internal-linking',
    category: 'content',
    severity: 'low',
    weight: 3,
    title: 'Pages link internally',
    description: 'Internal links spread authority and help discovery.',
    recommendation: 'Add contextual internal links between related pages.',
    evaluate: (ctx) => {
      const meanInternal = meanOverPages(ctx, (p) => p.internalLinkCount, 0);
      return meanInternal >= 1
        ? { passed: true }
        : { passed: false, detail: 'Pages average fewer than one internal link.' };
    },
  },

  // ── Structured data ───────────────────────────────────────────────────────
  {
    id: 'tech.structured-data-present',
    category: 'structured-data',
    severity: 'high',
    weight: 6,
    title: 'Structured data is present',
    description: 'Schema.org markup unlocks rich results and answer-engine extraction.',
    recommendation: 'Add JSON-LD structured data describing the page.',
    docsUrl: 'https://schema.org/',
    evaluate: (ctx) => {
      const sd = firstStructured(ctx);
      const total = ctx.structuredData.reduce((acc, r) => acc + r.totalItems, 0);
      return total > 0 || (sd?.totalItems ?? 0) > 0
        ? { passed: true }
        : { passed: false, detail: 'No structured-data items detected.' };
    },
  },
  {
    id: 'tech.structured-data-valid',
    category: 'structured-data',
    severity: 'medium',
    weight: 4,
    title: 'Structured data has no invalid items',
    description: 'Invalid schema (missing required props) is ignored by engines.',
    recommendation: 'Fix items flagged with missing required properties.',
    evaluate: (ctx) => {
      const invalid = ctx.structuredData.reduce((acc, r) => acc + r.invalidCount, 0);
      const total = ctx.structuredData.reduce((acc, r) => acc + r.totalItems, 0);
      if (total === 0) return { passed: true, detail: 'No structured data to validate.' };
      return invalid === 0
        ? { passed: true }
        : { passed: false, detail: `${invalid} invalid structured-data item(s).` };
    },
  },

  // ── Social ────────────────────────────────────────────────────────────────
  {
    id: 'tech.open-graph-complete',
    category: 'social',
    severity: 'medium',
    weight: 4,
    title: 'OpenGraph tags are complete',
    description: 'Complete OG tags control how links render when shared.',
    recommendation: 'Add og:title, og:description, og:image, and og:url.',
    docsUrl: 'https://ogp.me/',
    evaluate: (ctx) => {
      const bad = pagesFailing(ctx, (p) => p.openGraph.complete);
      return bad.length === 0 ? { passed: true } : { passed: false, affectedUrls: bad };
    },
  },
  {
    id: 'tech.twitter-card',
    category: 'social',
    severity: 'low',
    weight: 2,
    title: 'Twitter Card is declared',
    description: 'A twitter:card tag controls the X/Twitter preview.',
    recommendation: 'Add a twitter:card meta tag (e.g. summary_large_image).',
    evaluate: (ctx) => {
      const bad = pagesFailing(ctx, (p) => Boolean(p.twitter.card));
      return bad.length === 0 ? { passed: true } : { passed: false, affectedUrls: bad };
    },
  },

  // ── Mobile ────────────────────────────────────────────────────────────────
  {
    id: 'tech.viewport-mobile',
    category: 'mobile',
    severity: 'high',
    weight: 6,
    title: 'Pages declare a mobile viewport',
    description: 'A viewport meta tag is required for mobile-friendly rendering.',
    recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    evaluate: (ctx) => {
      const missing = pagesFailing(ctx, (p) => Boolean(p.meta.viewport));
      return missing.length === 0 ? { passed: true } : { passed: false, affectedUrls: missing };
    },
  },

  // ── Security ──────────────────────────────────────────────────────────────
  {
    id: 'tech.https',
    category: 'security',
    severity: 'critical',
    weight: 9,
    title: 'Site is served over HTTPS',
    description: 'HTTPS is a baseline ranking and trust requirement.',
    recommendation: 'Serve all pages over HTTPS and redirect HTTP to HTTPS.',
    evaluate: (ctx) => ({ passed: ctx.crawl.https }),
  },
  {
    id: 'tech.lang-declared',
    category: 'metadata',
    severity: 'low',
    weight: 2,
    title: 'Page language is declared',
    description: 'A lang attribute helps engines and assistive tech.',
    recommendation: 'Set <html lang="…"> on every page.',
    evaluate: (ctx) => {
      const missing = pagesFailing(ctx, (p) => Boolean(p.meta.lang));
      return missing.length === 0 ? { passed: true } : { passed: false, affectedUrls: missing };
    },
  },
  {
    id: 'tech.unique-titles',
    category: 'indexing',
    severity: 'medium',
    weight: 3,
    title: 'Titles are unique across pages',
    description: 'Duplicate titles dilute relevance and confuse engines.',
    recommendation: 'Give each page a distinct <title>.',
    evaluate: (ctx) => {
      // Multi-page-only signal: in single-page mode there is nothing to compare.
      if (!isMultiPage(ctx))
        return { passed: true, detail: 'Single page — uniqueness not applicable.' };
      const titles = ctx.pages
        .map((p) => (p.meta.title ?? '').trim().toLowerCase())
        .filter(Boolean);
      const seen = new Set<string>();
      const dupes = new Set<string>();
      for (const t of titles) {
        if (seen.has(t)) dupes.add(t);
        seen.add(t);
      }
      return dupes.size === 0
        ? { passed: true }
        : { passed: false, detail: `${dupes.size} duplicated title(s).` };
    },
  },
  {
    id: 'tech.content-not-thin',
    category: 'content',
    severity: 'medium',
    weight: 4,
    title: 'Pages are not thin on content',
    description: 'Very low word counts read as thin content to engines.',
    recommendation: 'Expand pages under ~200 words with substantive content.',
    evaluate: (ctx) => {
      const thin = pagesFailing(ctx, (p) => p.content.wordCount >= 200);
      return thin.length === 0
        ? { passed: true }
        : { passed: false, affectedUrls: thin, detail: `${thin.length} thin page(s).` };
    },
  },
  {
    id: 'tech.headings-present',
    category: 'content',
    severity: 'low',
    weight: 2,
    title: 'Pages use headings to structure content',
    description: 'Headings give content a skimmable, extractable structure.',
    recommendation: 'Break long content into sections with H2/H3 headings.',
    evaluate: (ctx) => {
      const ok = everyPage(ctx, (p) => p.headings.length > 0);
      return ok || firstPage(ctx) === undefined
        ? { passed: true }
        : { passed: false, detail: 'Some pages have no headings.' };
    },
  },
];
