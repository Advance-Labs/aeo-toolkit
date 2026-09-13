/**
 * `technicalSeoRules` — the core technical-SEO + on-page rule set.
 *
 * Rules span crawlability, indexing, metadata, structured-data, content,
 * mobile, security, and social. Every `evaluate` reads the context defensively:
 * arrays may be empty and indexes may be `undefined`. Rules whose signal needs
 * multi-page crawl data degrade gracefully in `single-page` mode (they pass
 * rather than penalize a context that physically cannot supply the data).
 */
import type { Rule, ScoringContext, Url } from '@advance-labs/types';
import {
  brokenPages,
  everyPage,
  firstPage,
  firstStructured,
  isNoindex,
  longRedirectChains,
  meanOverPages,
  normalizeUrl,
  pagesFailing,
  redirectLoops,
} from './context-utils.js';

const META_TITLE_MIN = 30;
const META_TITLE_MAX = 60;
const META_DESC_MIN = 70;
const META_DESC_MAX = 160;
const ALT_COVERAGE_MIN = 0.8;
const MAX_REDIRECT_HOPS = 2;
/** Share of crawled, indexable pages that must appear in the sitemap. */
const SITEMAP_COVERAGE_MIN = 0.9;
/** Below this many sitemap entries, a "stale lastmod" verdict is not statistically interesting. */
const LASTMOD_MIN_SAMPLE = 3;
/** A lastmod this far in the future is a clock/config error, not a fresh edit. */
const LASTMOD_FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/** Is this a multi-page context (vs the single-page extension mode)? */
function isMultiPage(ctx: ScoringContext): boolean {
  return ctx.mode !== 'single-page' && ctx.crawl.pages.length > 1;
}

/**
 * BCP 47 subset accepted in hreflang: language[-script][-region], e.g. "en",
 * "en-GB", "zh-Hant", "es-419". Deliberately not the full grammar — variants and
 * extensions are legal BCP 47 but never appear in real hreflang, while the actual
 * failure modes ("english", "en_US", "uk" meaning United Kingdom is fine, "en-UK"
 * is not a region we can catch without a registry) are all shape errors this does catch.
 */
const HREFLANG_PATTERN = /^[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|[0-9]{3}))?$/i;

/** Valid hreflang value: a BCP 47 language tag (see pattern above) or `x-default`. */
function isValidHreflangValue(value: string): boolean {
  return value.toLowerCase() === 'x-default' || HREFLANG_PATTERN.test(value.trim());
}

/** Hostname of a URL, lowercased, or undefined when it will not parse. */
function hreflangHost(value: string): string | undefined {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return undefined;
  }
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
    // Added 2026-08-01 after advancelabs.dev passed `tech.sitemap-present` while 13 of its 24
    // URLs had never been crawled by Google. Presence was never the question — the sitemap
    // existed and was valid. Whether it actually lists the pages you publish is the question.
    id: 'tech.sitemap-covers-pages',
    category: 'crawlability',
    severity: 'high',
    weight: 6,
    title: 'Sitemap lists the pages we found',
    description:
      'Pages missing from the sitemap rely on being reached by internal links alone, which on a low-authority site often means never getting crawled.',
    recommendation:
      'Add every indexable page to sitemap.xml. If your sitemap is generated, check the generator sees pages added since it was written.',
    docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap',
    evaluate: (ctx) => {
      // Only meaningful when we have both a sitemap and a real crawl to compare it against.
      if (ctx.crawl.sitemap.length === 0)
        return { passed: true, detail: 'No sitemap to compare against.' };
      if (!isMultiPage(ctx)) return { passed: true, detail: 'Single page — coverage not applicable.' };

      const listed = new Set(ctx.crawl.sitemap.map((e) => normalizeUrl(e.loc)));

      // Compare PARSED HTML pages, not `crawl.pages`. The crawl record also holds fonts, images,
      // CSS and JS chunks, none of which belong in a sitemap — comparing against it reported
      // .woff2 and .png files as "missing pages" on the first run against a real site.
      const candidates = ctx.pages.filter((p) => !isNoindex(p));
      if (candidates.length === 0) return { passed: true, detail: 'No HTML pages to compare.' };

      // A page is covered if the sitemap lists it OR lists the canonical it points at. Tracking
      // variants like ?src=home are the same page and canonicalize to a listed URL; counting
      // them as missing would flag correct behavior.
      const missing = candidates
        .filter((p) => {
          if (listed.has(normalizeUrl(p.url))) return false;
          const canonical = p.meta.canonical?.trim();
          if (canonical && listed.has(normalizeUrl(canonical))) return false;
          return true;
        })
        .map((p) => p.url);

      const covered = (candidates.length - missing.length) / candidates.length;
      if (covered >= SITEMAP_COVERAGE_MIN) return { passed: true };
      return {
        passed: false,
        affectedUrls: missing.slice(0, 20),
        detail: `${missing.length} of ${candidates.length} crawled pages are absent from the sitemap.`,
      };
    },
  },
  {
    // The build-time-timestamp antipattern. Regenerating every <lastmod> on every deploy makes
    // the whole file look freshly changed each time, so crawlers learn the signal carries no
    // information and stop using it to prioritize re-crawls — the opposite of the intent.
    id: 'tech.sitemap-lastmod-trustworthy',
    category: 'crawlability',
    severity: 'medium',
    weight: 4,
    title: 'Sitemap lastmod dates are trustworthy',
    description:
      'lastmod should track real content changes. Future dates and whole-file timestamps regenerated on every deploy both train crawlers to ignore the signal.',
    recommendation:
      'Derive lastmod from content edit dates, not build time, and never emit a future date.',
    docsUrl: 'https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping',
    evaluate: (ctx) => {
      const entries = ctx.crawl.sitemap;
      if (entries.length < LASTMOD_MIN_SAMPLE)
        return { passed: true, detail: 'Too few sitemap entries to assess.' };

      const parsed = entries
        .map((e) => (e.lastmod ? Date.parse(e.lastmod) : Number.NaN))
        .filter((t) => !Number.isNaN(t));
      if (parsed.length === 0)
        return {
          passed: true,
          detail: 'No lastmod values present — optional, so not penalized here.',
        };

      const now = Date.now();
      const future = parsed.filter((t) => t > now + LASTMOD_FUTURE_TOLERANCE_MS);
      if (future.length > 0)
        return {
          passed: false,
          detail: `${future.length} sitemap entries carry a future lastmod date.`,
        };

      // Every entry sharing one timestamp, set to right about now, is the signature of
      // `new Date()` at build time rather than per-page content dates.
      const allSame = new Set(parsed).size === 1 && parsed.length === entries.length;
      const first = parsed[0];
      if (allSame && first !== undefined && now - first < LASTMOD_FUTURE_TOLERANCE_MS)
        return {
          passed: false,
          detail:
            'Every entry shares one lastmod set to build time, so the file looks wholly rewritten on each deploy.',
        };

      return { passed: true };
    },
  },
  {
    // Shipped one of these to production on 2026-08-01: /api/connection returned 308 with
    // `location: /api/connection`. `tech.short-redirect-chains` cannot catch it — a cycle never
    // terminates, so it has no length to exceed a hop threshold.
    id: 'tech.no-redirect-loops',
    category: 'crawlability',
    severity: 'critical',
    weight: 8,
    title: 'No redirect loops',
    description:
      'A URL that redirects back to somewhere it has already been never resolves. Browsers abort it and crawlers drop the page entirely.',
    recommendation:
      'Find the cycle and make one hop terminal. Ordering bugs in rewrite/redirect rules are the usual cause.',
    docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/301-redirects',
    evaluate: (ctx) => {
      const loops = redirectLoops(ctx);
      if (loops.length === 0) return { passed: true };
      return {
        passed: false,
        affectedUrls: loops.slice(0, 20),
        detail: `${loops.length} URL(s) redirect in a cycle and never resolve.`,
      };
    },
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
  {
    // `tech.canonical-present` only asks whether the tag exists. A canonical pointing at a URL
    // that 404s, or at a malformed value, actively suppresses the page: the engine is told the
    // real version lives somewhere that turns out not to exist.
    //
    // Deliberately does NOT flag cross-domain canonicals. Pointing at another host is a
    // legitimate consolidation strategy (advancelabs.dev/tools does exactly this), so failing it
    // would penalize a correct setup. Only unparseable targets and targets we crawled and found
    // broken are treated as defects.
    id: 'tech.canonical-resolves',
    category: 'indexing',
    severity: 'high',
    weight: 6,
    title: 'Canonical URLs point somewhere real',
    description:
      'A canonical naming a broken or malformed URL tells engines the authoritative copy is somewhere that does not load, which can drop the page from the index.',
    recommendation:
      'Point every canonical at an absolute URL that returns 200. Check it after any move or domain change.',
    docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
    evaluate: (ctx) => {
      const brokenByUrl = new Map<string, number>();
      for (const p of brokenPages(ctx)) brokenByUrl.set(normalizeUrl(p.url), p.status);

      const bad: Url[] = [];
      const relative: Url[] = [];
      const statuses = new Set<number>();

      for (const page of ctx.pages) {
        const canonical = page.meta.canonical?.trim();
        if (!canonical) continue; // absence is tech.canonical-present's job, not ours

        // Absolute-ness has to be tested WITHOUT a base. Resolved against the page URL almost
        // any string parses (as a relative path), so a base-relative parse can never tell us
        // whether the author wrote a valid absolute canonical.
        let absolute: string | undefined;
        try {
          absolute = new URL(canonical).toString();
        } catch {
          relative.push(page.url);
          continue;
        }

        const status = brokenByUrl.get(normalizeUrl(absolute));
        if (status !== undefined) {
          bad.push(page.url);
          statuses.add(status);
        }
      }

      if (bad.length === 0 && relative.length === 0) return { passed: true };
      const parts: string[] = [];
      if (bad.length > 0) {
        const codes = [...statuses].sort((a, b) => a - b).join('/');
        parts.push(`${bad.length} point at a URL returning ${codes}`);
      }
      if (relative.length > 0) {
        parts.push(`${relative.length} are relative or malformed rather than absolute URLs`);
      }
      return {
        passed: false,
        affectedUrls: [...bad, ...relative].slice(0, 20),
        detail: `${parts.join('; ')}.`,
      };
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
    // Added for #10. A page with no declared encoding can be mis-decoded by crawlers,
    // which garbles the exact text an answer engine would otherwise quote.
    id: 'tech.charset-declared',
    category: 'metadata',
    severity: 'low',
    weight: 2,
    title: 'Character encoding is declared',
    description: 'Pages without a declared encoding can be mis-decoded, garbling quoted text.',
    recommendation: 'Add <meta charset="utf-8"> (or an equivalent content-type meta) to every page.',
    evaluate: (ctx) => {
      const missing = pagesFailing(ctx, (p) => Boolean(p.meta.charset));
      return missing.length === 0
        ? { passed: true }
        : {
            passed: false,
            affectedUrls: missing,
            detail: `${missing.length} page(s) declare no character encoding.`,
          };
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
    // Added for #12. Scoped to what one crawl can see: value shape always; target
    // reachability only for same-host targets in a multi-page crawl. Cross-domain
    // alternates (example.de) and single-page audits cannot be verified from here,
    // and unverifiable is not invalid — see the issue's "do not flag correct markup".
    id: 'tech.hreflang-valid',
    category: 'indexing',
    severity: 'medium',
    weight: 4,
    title: 'hreflang annotations are valid',
    description: 'Broken hreflang surfaces the wrong language in search and AI answers.',
    recommendation:
      'Use valid language-region codes (or x-default) and point each hreflang at a live URL.',
    docsUrl:
      'https://developers.google.com/search/docs/specialty/international/localized-versions',
    evaluate: (ctx) => {
      const annotated = ctx.pages.filter((p) => (p.hreflangs?.length ?? 0) > 0);
      // A single-language site is not broken — skip cleanly when nothing is annotated.
      if (annotated.length === 0) {
        return { passed: true, detail: 'No hreflang annotations — nothing to validate.' };
      }

      for (const page of annotated) {
        for (const entry of page.hreflangs ?? []) {
          if (!isValidHreflangValue(entry.hreflang)) {
            return {
              passed: false,
              affectedUrls: [page.url],
              detail: `Invalid hreflang value "${entry.hreflang}" on ${page.url}.`,
            };
          }
        }
      }

      if (ctx.mode !== 'single-page') {
        const crawled = new Set<string>();
        for (const p of ctx.crawl.pages) {
          crawled.add(normalizeUrl(p.url));
          crawled.add(normalizeUrl(p.finalUrl));
        }
        for (const p of ctx.pages) crawled.add(normalizeUrl(p.url));

        const rootHost = hreflangHost(ctx.crawl.rootUrl);
        for (const page of annotated) {
          for (const entry of page.hreflangs ?? []) {
            const targetHost = hreflangHost(entry.href);
            if (rootHost === undefined || targetHost !== rootHost) continue;
            if (!crawled.has(normalizeUrl(entry.href))) {
              return {
                passed: false,
                affectedUrls: [page.url],
                detail: `hreflang target ${entry.href} (on ${page.url}) was not reached by the crawl.`,
              };
            }
          }
        }
      }

      return { passed: true };
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
