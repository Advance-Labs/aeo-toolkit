/**
 * Tests for the discovery/consistency rules added 2026-08-01.
 *
 * Each of these exists because it caught (or would have caught) a real defect on
 * advancelabs.dev that the pre-existing rule set scored as a pass. The negative cases matter
 * as much as the positive ones: several of these rules operate near legitimate patterns
 * (cross-domain canonicals, page-capped crawls, noindex pages) and must not penalize them.
 */
import { describe, expect, it } from 'vitest';
import type { CrawledPage, ScoringContext, StructuredDataItem } from '@advance-labs/types';
import { runRules } from './engine.js';
import { technicalSeoRules } from './technical-seo-rules.js';
import { aeoRules } from './aeo-rules.js';
import { goodContext, singlePageContext } from './fixtures.js';

/** Run every rule set and pull one finding out by id. */
async function finding(ctx: ScoringContext, id: string) {
  const rules = id.startsWith('aeo.') ? aeoRules : technicalSeoRules;
  const { categories } = await runRules(ctx, rules);
  return categories.flatMap((c) => c.findings).find((f) => f.id === id);
}

/** goodContext with targeted mutations, without rebuilding the whole fixture. */
function ctxWith(mutate: (ctx: ScoringContext) => ScoringContext): ScoringContext {
  return mutate(goodContext());
}

function page(url: string, overrides: Partial<CrawledPage> = {}): CrawledPage {
  return {
    url,
    finalUrl: url,
    status: 200,
    ok: true,
    headers: {},
    timingMs: 10,
    redirectChain: [],
    depth: 1,
    ...overrides,
  };
}

function orgItem(props: Record<string, unknown>): StructuredDataItem {
  return {
    format: 'json-ld',
    type: 'Organization',
    properties: props,
    valid: true,
    missingRequired: [],
    warnings: [],
  };
}

describe('tech.no-redirect-loops', () => {
  it('passes a clean site', async () => {
    expect((await finding(goodContext(), 'tech.no-redirect-loops'))?.passed).toBe(true);
  });

  it('catches a URL that redirects to itself', async () => {
    // The exact shape shipped to production on 2026-08-01: /api/connection 308 -> itself.
    const ctx = ctxWith((c) => ({
      ...c,
      crawl: {
        ...c.crawl,
        pages: [
          ...c.crawl.pages,
          page('https://good.example.com/api/connection', {
            redirectChain: [{ url: 'https://good.example.com/api/connection', status: 308 }],
          }),
        ],
      },
    }));
    const f = await finding(ctx, 'tech.no-redirect-loops');
    expect(f?.passed).toBe(false);
    expect(f?.affectedUrls).toContain('https://good.example.com/api/connection');
  });

  it('catches a multi-hop cycle', async () => {
    const ctx = ctxWith((c) => ({
      ...c,
      crawl: {
        ...c.crawl,
        pages: [
          ...c.crawl.pages,
          page('https://good.example.com/a', {
            redirectChain: [
              { url: 'https://good.example.com/b', status: 301 },
              { url: 'https://good.example.com/a', status: 301 },
            ],
          }),
        ],
      },
    }));
    expect((await finding(ctx, 'tech.no-redirect-loops'))?.passed).toBe(false);
  });

  it('does not flag an ordinary terminating redirect chain', async () => {
    const ctx = ctxWith((c) => ({
      ...c,
      crawl: {
        ...c.crawl,
        pages: [
          ...c.crawl.pages,
          page('https://good.example.com/old', {
            redirectChain: [
              { url: 'https://good.example.com/mid', status: 301 },
              { url: 'https://good.example.com/new', status: 301 },
            ],
          }),
        ],
      },
    }));
    expect((await finding(ctx, 'tech.no-redirect-loops'))?.passed).toBe(true);
  });
});

describe('tech.sitemap-covers-pages', () => {
  it('passes when the sitemap lists every crawled page', async () => {
    expect((await finding(goodContext(), 'tech.sitemap-covers-pages'))?.passed).toBe(true);
  });

  it('fails when a crawled page is missing from the sitemap', async () => {
    const ctx = ctxWith((c) => ({
      ...c,
      crawl: { ...c.crawl, sitemap: c.crawl.sitemap.slice(0, 1) },
    }));
    const f = await finding(ctx, 'tech.sitemap-covers-pages');
    expect(f?.passed).toBe(false);
    expect(f?.affectedUrls?.length).toBeGreaterThan(0);
  });

  it('does NOT fail when the sitemap lists pages the crawl did not reach', async () => {
    // The crawl is page-capped (default 50), so extra sitemap URLs are expected, not a defect.
    const ctx = ctxWith((c) => ({
      ...c,
      crawl: {
        ...c.crawl,
        sitemap: [
          ...c.crawl.sitemap,
          { loc: 'https://good.example.com/never-crawled-1' },
          { loc: 'https://good.example.com/never-crawled-2' },
        ],
      },
    }));
    expect((await finding(ctx, 'tech.sitemap-covers-pages'))?.passed).toBe(true);
  });

  it('ignores trailing-slash differences between sitemap and crawl', async () => {
    const ctx = ctxWith((c) => ({
      ...c,
      crawl: {
        ...c.crawl,
        sitemap: c.crawl.sitemap.map((e) => ({ loc: `${e.loc.replace(/\/$/, '')}/` })),
      },
    }));
    expect((await finding(ctx, 'tech.sitemap-covers-pages'))?.passed).toBe(true);
  });

  it('ignores static assets held in the crawl record', async () => {
    // Regression: the first version compared against crawl.pages, which also holds fonts,
    // images, CSS and JS chunks. Against advancelabs.dev it duly reported .woff2 and .png
    // files as "pages missing from the sitemap".
    const ctx = ctxWith((c) => ({
      ...c,
      crawl: {
        ...c.crawl,
        pages: [
          ...c.crawl.pages,
          page('https://good.example.com/_next/static/media/x.woff2'),
          page('https://good.example.com/logo.png'),
          page('https://good.example.com/_next/static/chunks/main.js'),
        ],
      },
    }));
    expect((await finding(ctx, 'tech.sitemap-covers-pages'))?.passed).toBe(true);
  });

  it('treats a tracking-parameter variant as covered by its canonical', async () => {
    // Regression: /services/aeo-audit?src=home is the same page as /services/aeo-audit and
    // canonicalizes to it. Counting it missing would flag a correct internal-linking pattern.
    const canonical = 'https://good.example.com/about';
    const ctx = ctxWith((c) => ({
      ...c,
      pages: [
        ...c.pages,
        { ...c.pages[0]!, url: `${canonical}?src=home`, meta: { ...c.pages[0]!.meta, canonical } },
      ],
    }));
    expect((await finding(ctx, 'tech.sitemap-covers-pages'))?.passed).toBe(true);
  });

  it('is not applicable in single-page mode', async () => {
    expect((await finding(singlePageContext(), 'tech.sitemap-covers-pages'))?.passed).toBe(true);
  });
});

describe('tech.sitemap-lastmod-trustworthy', () => {
  it('does not penalize a sitemap with no lastmod at all', async () => {
    expect((await finding(goodContext(), 'tech.sitemap-lastmod-trustworthy'))?.passed).toBe(true);
  });

  it('fails on future-dated lastmod', async () => {
    const future = new Date(Date.now() + 7 * 864e5).toISOString();
    const ctx = ctxWith((c) => ({
      ...c,
      crawl: { ...c.crawl, sitemap: c.crawl.sitemap.map((e) => ({ ...e, lastmod: future })) },
    }));
    expect((await finding(ctx, 'tech.sitemap-lastmod-trustworthy'))?.passed).toBe(false);
  });

  it('fails when every entry shares a build-time timestamp', async () => {
    const now = new Date().toISOString();
    const ctx = ctxWith((c) => ({
      ...c,
      crawl: { ...c.crawl, sitemap: c.crawl.sitemap.map((e) => ({ ...e, lastmod: now })) },
    }));
    const f = await finding(ctx, 'tech.sitemap-lastmod-trustworthy');
    expect(f?.passed).toBe(false);
    expect(f?.description).toMatch(/build time/i);
  });

  it('passes genuine per-page content dates', async () => {
    const dates = ['2026-01-04', '2026-03-19', '2026-05-02', '2026-06-27', '2026-07-30'];
    const ctx = ctxWith((c) => ({
      ...c,
      crawl: {
        ...c.crawl,
        sitemap: c.crawl.sitemap.map((e, i) => ({ ...e, lastmod: dates[i] ?? '2026-02-01' })),
      },
    }));
    expect((await finding(ctx, 'tech.sitemap-lastmod-trustworthy'))?.passed).toBe(true);
  });
});

describe('tech.canonical-resolves', () => {
  it('passes when canonicals point at live pages', async () => {
    expect((await finding(goodContext(), 'tech.canonical-resolves'))?.passed).toBe(true);
  });

  it('fails when a canonical points at a URL we crawled and found broken', async () => {
    const dead = 'https://good.example.com/gone';
    const ctx = ctxWith((c) => ({
      ...c,
      crawl: {
        ...c.crawl,
        pages: [...c.crawl.pages, page(dead, { status: 404, ok: false })],
      },
      pages: c.pages.map((p, i) =>
        i === 0 ? { ...p, meta: { ...p.meta, canonical: dead } } : p,
      ),
    }));
    const f = await finding(ctx, 'tech.canonical-resolves');
    expect(f?.passed).toBe(false);
    expect(f?.description).toMatch(/404/);
  });

  it('does NOT flag a cross-domain canonical', async () => {
    // Legitimate consolidation — advancelabs.dev/tools does exactly this. Failing it would
    // penalize a correct setup, which is the whole reason this rule stays narrow.
    const ctx = ctxWith((c) => ({
      ...c,
      pages: c.pages.map((p) => ({
        ...p,
        meta: { ...p.meta, canonical: 'https://elsewhere.example.org/canonical-home' },
      })),
    }));
    expect((await finding(ctx, 'tech.canonical-resolves'))?.passed).toBe(true);
  });

  it('fails on a relative canonical, which Google asks to be absolute', async () => {
    const ctx = ctxWith((c) => ({
      ...c,
      pages: c.pages.map((p, i) =>
        i === 0 ? { ...p, meta: { ...p.meta, canonical: '/about' } } : p,
      ),
    }));
    const f = await finding(ctx, 'tech.canonical-resolves');
    expect(f?.passed).toBe(false);
    expect(f?.description).toMatch(/absolute/i);
  });

  it('stays silent when a page has no canonical (that is another rule\'s job)', async () => {
    const ctx = ctxWith((c) => ({
      ...c,
      pages: c.pages.map((p) => ({ ...p, meta: { ...p.meta, canonical: undefined } })),
    }));
    expect((await finding(ctx, 'tech.canonical-resolves'))?.passed).toBe(true);
  });
});

describe('aeo.entity-identity-consistent', () => {
  const withOrgs = (items: StructuredDataItem[]) =>
    ctxWith((c) => ({
      ...c,
      structuredData: [{ ...c.structuredData[0]!, items }],
    }));

  it('passes when there is nothing to contradict', async () => {
    expect((await finding(goodContext(), 'aeo.entity-identity-consistent'))?.passed).toBe(true);
  });

  // NB: hosts here must match goodContext's rootUrl (good.example.com). Nodes on any other
  // host are treated as third-party by design and skipped.
  it('fails when Organization nodes disagree on @id', async () => {
    const ctx = withOrgs([
      orgItem({ '@id': 'https://good.example.com/#organization', url: 'https://good.example.com' }),
      orgItem({ '@id': 'https://good.example.com/#org', url: 'https://good.example.com' }),
    ]);
    const f = await finding(ctx, 'aeo.entity-identity-consistent');
    expect(f?.passed).toBe(false);
    expect(f?.description).toMatch(/@id/);
  });

  it('fails when Organization nodes disagree on url', async () => {
    const ctx = withOrgs([
      orgItem({ '@id': 'https://good.example.com/#organization', url: 'https://good.example.com' }),
      orgItem({
        '@id': 'https://good.example.com/#organization',
        url: 'https://good.example.com/home',
      }),
    ]);
    expect((await finding(ctx, 'aeo.entity-identity-consistent'))?.passed).toBe(false);
  });

  it('passes when every Organization node agrees, ignoring a trailing slash', async () => {
    const ctx = withOrgs([
      orgItem({ '@id': 'https://good.example.com/#organization', url: 'https://good.example.com' }),
      orgItem({ '@id': 'https://good.example.com/#organization', url: 'https://good.example.com/' }),
    ]);
    expect((await finding(ctx, 'aeo.entity-identity-consistent'))?.passed).toBe(true);
  });

  it('does not fire on a single Organization node', async () => {
    const ctx = withOrgs([orgItem({ '@id': 'https://good.example.com/#organization' })]);
    expect((await finding(ctx, 'aeo.entity-identity-consistent'))?.passed).toBe(true);
  });

  it('ignores third-party Organization nodes on case-study pages', async () => {
    // Regression: the first version of this rule failed advancelabs.dev because its /work/*
    // case studies correctly mark up the CLIENT as an Organization. Any agency that shows its
    // work would have hit the same false positive.
    const ctx = withOrgs([
      orgItem({ '@id': 'https://good.example.com/#organization', url: 'https://good.example.com' }),
      orgItem({ '@id': 'https://a-client.com#organization', url: 'https://a-client.com' }),
      orgItem({ '@id': 'https://another-client.co#organization', url: 'https://another-client.co' }),
    ]);
    expect((await finding(ctx, 'aeo.entity-identity-consistent'))?.passed).toBe(true);
  });

  it('still catches a first-party split across a subdomain', async () => {
    // The advancelabs.dev / aeo.advancelabs.dev case: same site, contradictory identities.
    const ctx = withOrgs([
      orgItem({ '@id': 'https://good.example.com/#organization', url: 'https://good.example.com' }),
      orgItem({ '@id': 'https://aeo.good.example.com/#organization', url: 'https://good.example.com' }),
    ]);
    expect((await finding(ctx, 'aeo.entity-identity-consistent'))?.passed).toBe(false);
  });
});
