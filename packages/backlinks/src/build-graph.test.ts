import { describe, it, expect, beforeEach } from 'vitest';
import { buildBacklinkGraph, canonicalUrl, normalizeDomain } from './build-graph.js';
import { resetLatestIndexCache } from './commoncrawl.js';
import type { HttpClient, TextResponse } from './http.js';

/** DuckDuckGo HTML for third-party pages that mention the root domain. */
const DDG_HTML = `
<div class="result">
  <a class="result__a" href="https://review.blog/acme-review">Acme Review</a>
  <div class="result__snippet">A third-party review.</div>
</div>
<div class="result">
  <a class="result__a" href="https://news.example/story">News Coverage</a>
  <div class="result__snippet">Coverage of acme.</div>
</div>
<div class="result">
  <a class="result__a" href="https://review.blog/second-post">Second post same domain</a>
  <div class="result__snippet">Same referring domain, second page.</div>
</div>
`;

/** CommonCrawl NDJSON: captured pages on the root domain. */
const CC_NDJSON = [
  JSON.stringify({ url: 'https://acme.com/pricing', status: '200', timestamp: '20241201120000' }),
  JSON.stringify({ url: 'https://acme.com/blog/post', status: '200' }),
].join('\n');

/** Route requests to DDG vs CommonCrawl by inspecting the url. */
function routedHttp(): HttpClient {
  return {
    getText: async (url: string): Promise<TextResponse> => {
      const body = url.includes('index.commoncrawl.org') ? CC_NDJSON : DDG_HTML;
      return { ok: true, status: 200, body, url };
    },
    getResource: async () => {
      throw new Error('not used');
    },
  };
}

describe('normalizeDomain', () => {
  it('strips scheme, path, port, and leading www.', () => {
    expect(normalizeDomain('https://www.acme.com:443/path?x=1')).toBe('acme.com');
    expect(normalizeDomain('ACME.com')).toBe('acme.com');
  });
});

describe('canonicalUrl', () => {
  it('drops the hash, lowercases the host, and trims a trailing slash', () => {
    expect(canonicalUrl('https://Acme.com/Page/#frag')).toBe('https://acme.com/Page');
    // Root slash is preserved.
    expect(canonicalUrl('https://acme.com/')).toBe('https://acme.com/');
  });

  it('returns the trimmed input when the url is unparseable (no throw)', () => {
    expect(canonicalUrl('  not a url  ')).toBe('not a url');
  });
});

describe('buildBacklinkGraph', () => {
  beforeEach(() => resetLatestIndexCache());

  it('aggregates page signals into a layered domain graph with stats', async () => {
    const graph = await buildBacklinkGraph('https://acme.com', {
      http: routedHttp(),
      limit: 10,
      // Scope to the two sources this fixture models; Wayback (a default source) is
      // covered by its own case below.
      sources: ['duckduckgo', 'commoncrawl'],
    });

    // Root node.
    expect(graph.root.type).toBe('root');
    expect(graph.root.domain).toBe('acme.com');

    // Two off-domain referring domains from DDG (review.blog, news.example) — the
    // root's own captures from CommonCrawl aggregate under the root domain too.
    const domainNodes = graph.nodes.filter((n) => n.type === 'referring-domain');
    const domains = domainNodes.map((n) => n.domain).sort();
    expect(domains).toContain('review.blog');
    expect(domains).toContain('news.example');
    expect(domains).toContain('acme.com');

    // review.blog contributed two distinct pages → aggregated under one domain node.
    const reviewDomainNodes = domainNodes.filter((n) => n.domain === 'review.blog');
    expect(reviewDomainNodes).toHaveLength(1);

    // Page nodes (backlink-page or mention) for every distinct url.
    const pageNodes = graph.nodes.filter((n) => n.type === 'backlink-page' || n.type === 'mention');
    // 3 DDG pages + 2 CommonCrawl pages = 5 distinct urls.
    expect(pageNodes).toHaveLength(5);

    // Edges: root→domain (one per domain) + domain→page (one per page).
    const rootEdges = graph.edges.filter((e) => e.source === graph.root.id);
    expect(rootEdges).toHaveLength(domainNodes.length);
    const pageEdges = graph.edges.filter((e) => e.target.startsWith('https://'));
    expect(pageEdges).toHaveLength(5);

    // Stats.
    expect(graph.stats.sampled).toBe(true);
    expect(graph.stats.referringDomains).toBe(domainNodes.length);
    expect(graph.stats.backlinks).toBe(5);
    // CommonCrawl pages are dofollow (2), DDG mentions are not (3) → ratio 2/5.
    expect(graph.stats.dofollowRatio).toBeCloseTo(2 / 5);
    // Top sources are ordered by count desc (ties broken alphabetically). Both
    // review.blog and acme.com contributed 2 pages each.
    const reviewSource = graph.stats.topSources.find((s) => s.domain === 'review.blog');
    expect(reviewSource?.count).toBe(2);
    expect(graph.stats.topSources[0]?.count).toBe(2);

    // CommonCrawl supplied a firstSeen on /pricing.
    const pricing = pageNodes.find((n) => n.url === 'https://acme.com/pricing');
    expect(pricing?.firstSeen).toBe('2024-12-01T12:00:00Z');

    // Clean run → no warnings.
    expect(graph.warnings).toBeUndefined();
  });

  it('de-duplicates the same url surfaced by two providers (canonical key)', async () => {
    // DDG returns an off-domain page; CommonCrawl returns the same page url with a
    // trailing slash + hash. They must collapse to one page node.
    const dupHtml = `
      <div class="result">
        <a class="result__a" href="https://partner.io/article">Partner Article</a>
        <div class="result__snippet">A mention.</div>
      </div>`;
    const dupCc = JSON.stringify({ url: 'https://partner.io/article/', status: '200' });

    const http: HttpClient = {
      getText: async (url: string): Promise<TextResponse> => {
        const body = url.includes('index.commoncrawl.org') ? dupCc : dupHtml;
        return { ok: true, status: 200, body, url };
      },
      getResource: async () => {
        throw new Error('not used');
      },
    };

    // partner.io is off the root domain so it survives both fan-outs.
    const graph = await buildBacklinkGraph('https://acme.com', { http, limit: 10 });
    const partnerPages = graph.nodes.filter((n) => n.domain === 'partner.io' && n.url);
    expect(partnerPages).toHaveLength(1);
    // The CommonCrawl signal (backlink, dofollow) upgrades the DDG mention.
    expect(partnerPages[0]?.type).toBe('backlink-page');
    expect(partnerPages[0]?.dofollow).toBe(true);
  });

  it('degrades gracefully: a dead provider becomes a warning, not a throw', async () => {
    // DuckDuckGo fails (transport error); CommonCrawl succeeds.
    const http: HttpClient = {
      getText: async (url: string): Promise<TextResponse> => {
        if (url.includes('index.commoncrawl.org')) {
          return { ok: true, status: 200, body: CC_NDJSON, url };
        }
        return { ok: false, status: 0, body: '', url };
      },
      getResource: async () => {
        throw new Error('not used');
      },
    };

    const graph = await buildBacklinkGraph('https://acme.com', { http, limit: 10 });
    // CommonCrawl still produced its two pages.
    expect(graph.stats.backlinks).toBe(2);
    // The DDG failure surfaced as a warning rather than crashing the build.
    expect(graph.warnings).toBeDefined();
    expect((graph.warnings ?? []).some((w) => w.includes('[duckduckgo]'))).toBe(true);
  });

  it('honors the sources option to scope the fan-out', async () => {
    let ddgCalled = false;
    const http: HttpClient = {
      getText: async (url: string): Promise<TextResponse> => {
        if (url.includes('index.commoncrawl.org')) {
          return { ok: true, status: 200, body: CC_NDJSON, url };
        }
        ddgCalled = true;
        return { ok: true, status: 200, body: DDG_HTML, url };
      },
      getResource: async () => {
        throw new Error('not used');
      },
    };

    const graph = await buildBacklinkGraph('https://acme.com', {
      http,
      sources: ['commoncrawl'],
    });
    expect(ddgCalled).toBe(false);
    // Only the two CommonCrawl pages, aggregated under the acme.com domain.
    expect(graph.stats.backlinks).toBe(2);
  });

  it('includes Wayback captures as backlink nodes (reliable fallback source)', async () => {
    // Valid CDX JSON for the domain: a header row + two archived pages under acme.com.
    const cdx = JSON.stringify([
      ['timestamp', 'original'],
      ['20230115120000', 'https://acme.com/features'],
      ['20240620090000', 'https://acme.com/changelog'],
    ]);
    const http: HttpClient = {
      getText: async (url: string): Promise<TextResponse> => {
        const body = url.includes('web.archive.org') ? cdx : '';
        // Only Wayback is active here; other hosts return an empty (non-ok) body.
        return { ok: body !== '', status: body !== '' ? 200 : 0, body, url };
      },
      getResource: async () => {
        throw new Error('not used');
      },
    };

    const graph = await buildBacklinkGraph('https://acme.com', {
      http,
      limit: 10,
      sources: ['wayback'],
    });

    // Both archived pages become backlink-page nodes under the acme.com domain node.
    const pageNodes = graph.nodes.filter((n) => n.type === 'backlink-page');
    expect(pageNodes).toHaveLength(2);
    expect(pageNodes.every((n) => n.dofollow)).toBe(true);
    expect(graph.stats.backlinks).toBe(2);
    const features = pageNodes.find((n) => n.url === 'https://acme.com/features');
    expect(features?.firstSeen).toBe('2023-01-15T12:00:00Z');
  });

  it('warns and returns an empty-ish graph when the root domain is underivable', async () => {
    const graph = await buildBacklinkGraph('   ', { http: routedHttp() });
    expect(graph.stats.backlinks).toBe(0);
    expect(graph.stats.referringDomains).toBe(0);
    expect(graph.warnings).toBeDefined();
  });
});
