import { describe, it, expect } from 'vitest';
import { crawl } from './crawl.js';
import { makeResponse, instantDelay } from './test-helpers.js';
import type { Fetcher, FetchOptions } from './fetcher.js';

const HTML = (links: string[]): string =>
  `<html><body>${links.map((l) => `<a href="${l}">x</a>`).join('')}</body></html>`;

const htmlResponse = (body: string): Response =>
  makeResponse({ status: 200, headers: { 'content-type': 'text/html' }, body });

/** Build a fetcher from a route map, defaulting unknown URLs to 404 and recording calls. */
function fakeSite(routes: Record<string, () => Response>): {
  fetcher: Fetcher;
  fetched: string[];
} {
  const fetched: string[] = [];
  const fetcher: Fetcher = (url: string, _init?: FetchOptions) => {
    fetched.push(url);
    const make = routes[url];
    if (make) return Promise.resolve(make());
    return Promise.resolve(makeResponse({ status: 404, body: 'nope' }));
  };
  return { fetcher, fetched };
}

describe('crawl', () => {
  it('follows links via BFS and respects the maxPages cap', async () => {
    const { fetcher, fetched } = fakeSite({
      'https://example.com/robots.txt': () => makeResponse({ status: 404 }),
      'https://example.com/sitemap.xml': () => makeResponse({ status: 404 }),
      'https://example.com/': () => htmlResponse(HTML(['/a', '/b', '/c', '/d', '/e'])),
      'https://example.com/a': () => htmlResponse(HTML(['/f', '/g'])),
      'https://example.com/b': () => htmlResponse(HTML([])),
      'https://example.com/c': () => htmlResponse(HTML([])),
      'https://example.com/d': () => htmlResponse(HTML([])),
      'https://example.com/e': () => htmlResponse(HTML([])),
    });

    const result = await crawl('https://example.com/', {
      maxPages: 3,
      followSitemap: false,
      respectRobotsTxt: false,
      delay: instantDelay,
      fetcher,
    });

    expect(result.pageCount).toBe(3);
    expect(result.pages).toHaveLength(3);
    // Root is fetched first; cap is enforced regardless of discovered links.
    expect(result.pages[0]?.url).toBe('https://example.com/');
    expect(result.https).toBe(true);
    // We never fetched more page URLs than the cap (robots/sitemap probes excluded).
    const pageFetches = fetched.filter(
      (u) =>
        !u.endsWith('/robots.txt') &&
        !u.endsWith('/sitemap.xml') &&
        !u.endsWith('.ico') &&
        !u.endsWith('/llms.txt') &&
        !u.endsWith('/llms-full.txt'),
    );
    expect(pageFetches.length).toBe(3);
  });

  it('seeds the frontier from the sitemap (sitemap-first discovery)', async () => {
    const sitemapXml = `<urlset>
        <url><loc>https://example.com/from-sitemap-1</loc></url>
        <url><loc>https://example.com/from-sitemap-2</loc></url>
      </urlset>`;

    const { fetcher } = fakeSite({
      'https://example.com/robots.txt': () =>
        makeResponse({ status: 200, body: 'Sitemap: https://example.com/sitemap.xml' }),
      'https://example.com/sitemap.xml': () =>
        makeResponse({
          status: 200,
          headers: { 'content-type': 'application/xml' },
          body: sitemapXml,
        }),
      'https://example.com/': () => htmlResponse(HTML([])),
      'https://example.com/from-sitemap-1': () => htmlResponse(HTML([])),
      'https://example.com/from-sitemap-2': () => htmlResponse(HTML([])),
    });

    const result = await crawl('https://example.com/', {
      maxPages: 10,
      delay: instantDelay,
      fetcher,
    });

    expect(result.sitemap.map((e) => e.loc)).toEqual([
      'https://example.com/from-sitemap-1',
      'https://example.com/from-sitemap-2',
    ]);
    const crawledUrls = result.pages.map((p) => p.url);
    expect(crawledUrls).toContain('https://example.com/from-sitemap-1');
    expect(crawledUrls).toContain('https://example.com/from-sitemap-2');
    expect(result.robots.sitemaps).toEqual(['https://example.com/sitemap.xml']);
  });

  it('respects robots.txt Disallow when respectRobotsTxt is on', async () => {
    const { fetcher, fetched } = fakeSite({
      'https://example.com/robots.txt': () =>
        makeResponse({
          status: 200,
          body: ['User-agent: *', 'Disallow: /private'].join('\n'),
        }),
      'https://example.com/sitemap.xml': () => makeResponse({ status: 404 }),
      'https://example.com/': () => htmlResponse(HTML(['/public', '/private/secret'])),
      'https://example.com/public': () => htmlResponse(HTML([])),
      'https://example.com/private/secret': () => htmlResponse(HTML([])),
    });

    const result = await crawl('https://example.com/', {
      maxPages: 10,
      respectRobotsTxt: true,
      followSitemap: false,
      delay: instantDelay,
      fetcher,
    });

    const crawledUrls = result.pages.map((p) => p.url);
    expect(crawledUrls).toContain('https://example.com/public');
    expect(crawledUrls).not.toContain('https://example.com/private/secret');
    // The disallowed page was never even fetched.
    expect(fetched).not.toContain('https://example.com/private/secret');
  });

  it('crawls the disallowed page when respectRobotsTxt is off (edge case)', async () => {
    const { fetcher } = fakeSite({
      'https://example.com/robots.txt': () =>
        makeResponse({ status: 200, body: 'User-agent: *\nDisallow: /private' }),
      'https://example.com/sitemap.xml': () => makeResponse({ status: 404 }),
      'https://example.com/': () => htmlResponse(HTML(['/private/secret'])),
      'https://example.com/private/secret': () => htmlResponse(HTML([])),
    });

    const result = await crawl('https://example.com/', {
      maxPages: 10,
      respectRobotsTxt: false,
      followSitemap: false,
      delay: instantDelay,
      fetcher,
    });

    expect(result.pages.map((p) => p.url)).toContain('https://example.com/private/secret');
  });

  it('captures the redirect chain on a crawled page', async () => {
    const { fetcher } = fakeSite({
      'https://example.com/robots.txt': () => makeResponse({ status: 404 }),
      'https://example.com/sitemap.xml': () => makeResponse({ status: 404 }),
      'https://example.com/': () =>
        makeResponse({ status: 301, headers: { location: 'https://example.com/home' } }),
      'https://example.com/home': () => htmlResponse(HTML([])),
    });

    const result = await crawl('https://example.com/', {
      maxPages: 5,
      followSitemap: false,
      respectRobotsTxt: false,
      delay: instantDelay,
      fetcher,
    });

    const root = result.pages[0];
    expect(root?.finalUrl).toBe('https://example.com/home');
    expect(root?.redirectChain).toEqual([{ url: 'https://example.com/', status: 301 }]);
    expect(root?.depth).toBe(0);
  });

  it('stays on-origin and ignores external links by default', async () => {
    const { fetcher } = fakeSite({
      'https://example.com/robots.txt': () => makeResponse({ status: 404 }),
      'https://example.com/sitemap.xml': () => makeResponse({ status: 404 }),
      'https://example.com/': () => htmlResponse(HTML(['/internal', 'https://external.com/page'])),
      'https://example.com/internal': () => htmlResponse(HTML([])),
    });

    const result = await crawl('https://example.com/', {
      maxPages: 10,
      followSitemap: false,
      respectRobotsTxt: false,
      delay: instantDelay,
      fetcher,
    });

    const urls = result.pages.map((p) => p.url);
    expect(urls).toContain('https://example.com/internal');
    expect(urls).not.toContain('https://external.com/page');
  });

  it('records discoveredFrom and depth for link-discovered pages', async () => {
    const { fetcher } = fakeSite({
      'https://example.com/robots.txt': () => makeResponse({ status: 404 }),
      'https://example.com/sitemap.xml': () => makeResponse({ status: 404 }),
      'https://example.com/': () => htmlResponse(HTML(['/child'])),
      'https://example.com/child': () => htmlResponse(HTML([])),
    });

    const result = await crawl('https://example.com/', {
      maxPages: 5,
      followSitemap: false,
      respectRobotsTxt: false,
      delay: instantDelay,
      fetcher,
    });

    const child = result.pages.find((p) => p.url === 'https://example.com/child');
    expect(child?.depth).toBe(1);
    expect(child?.discoveredFrom).toBe('https://example.com/');
  });

  it('marks https=false for an http root (edge case)', async () => {
    const { fetcher } = fakeSite({
      'http://example.com/robots.txt': () => makeResponse({ status: 404 }),
      'http://example.com/sitemap.xml': () => makeResponse({ status: 404 }),
      'http://example.com/': () => htmlResponse(HTML([])),
    });

    const result = await crawl('http://example.com/', {
      maxPages: 1,
      followSitemap: false,
      respectRobotsTxt: false,
      delay: instantDelay,
      fetcher,
    });

    expect(result.https).toBe(false);
    expect(result.pageCount).toBe(1);
  });
});
