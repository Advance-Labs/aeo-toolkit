import { describe, it, expect } from 'vitest';
import { detectSiteFiles } from './site-files.js';
import { makeFetcher, makeResponse } from './test-helpers.js';
import type { Fetcher } from './fetcher.js';

describe('detectSiteFiles', () => {
  it('reports presence per file based on HEAD 2xx responses', async () => {
    const { fetcher } = makeFetcher({
      'https://example.com/robots.txt': { status: 200 },
      'https://example.com/sitemap.xml': { status: 200 },
      'https://example.com/llms.txt': { status: 200 },
      // llms-full.txt and favicon intentionally absent → 404.
    });

    const presence = await detectSiteFiles('https://example.com/', { fetcher });

    expect(presence).toEqual({
      robotsTxt: true,
      sitemapXml: true,
      llmsTxt: true,
      llmsFullTxt: false,
      favicon: false,
    });
  });

  it('falls back to GET when the server rejects HEAD (edge case)', async () => {
    const fetcher: Fetcher = (url, init) => {
      const method = init?.method ?? 'GET';
      if (url === 'https://example.com/robots.txt') {
        // HEAD not allowed, GET ok.
        if (method === 'HEAD') return Promise.resolve(makeResponse({ status: 405 }));
        return Promise.resolve(makeResponse({ status: 200 }));
      }
      return Promise.resolve(makeResponse({ status: 404 }));
    };

    const presence = await detectSiteFiles('https://example.com/', { fetcher });
    expect(presence.robotsTxt).toBe(true);
  });

  it('reports all-absent when every probe 404s (edge case)', async () => {
    const { fetcher } = makeFetcher({});
    const presence = await detectSiteFiles('https://example.com/', { fetcher });
    expect(presence).toEqual({
      robotsTxt: false,
      sitemapXml: false,
      llmsTxt: false,
      llmsFullTxt: false,
      favicon: false,
    });
  });
});

describe('detectSiteFiles — SPA catch-all routes', () => {
  it('does NOT report a file as present when the server returns an HTML page', async () => {
    // The single-page-app failure mode: every unmatched path returns 200 with the app
    // shell. Found in the wild on a site that had no llms.txt at all, yet audited as
    // having one — a silent false pass on the exact rule the audit exists to check.
    const { fetcher } = makeFetcher({
      'https://spa.example/robots.txt': {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      },
      'https://spa.example/llms.txt': {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      },
      'https://spa.example/sitemap.xml': {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      },
    });

    const presence = await detectSiteFiles('https://spa.example/', { fetcher });

    expect(presence.robotsTxt).toBe(true); // genuinely there
    expect(presence.llmsTxt).toBe(false); // the app shell, not a file
    expect(presence.sitemapXml).toBe(false);
  });

  it('treats a missing content-type as present rather than absent', async () => {
    // Some static hosts omit content-type on HEAD. Refusing those would swap this bug
    // for the opposite one, so absence of the header is not evidence of absence.
    const { fetcher } = makeFetcher({
      'https://example.com/llms.txt': { status: 200 },
    });

    const presence = await detectSiteFiles('https://example.com/', { fetcher });
    expect(presence.llmsTxt).toBe(true);
  });

  it('applies the HTML check to the GET fallback too', async () => {
    // A server that rejects HEAD and serves a catch-all on GET must not slip through.
    const fetcher: Fetcher = (url, init) => {
      const method = init?.method ?? 'GET';
      if (url === 'https://spa.example/llms.txt') {
        if (method === 'HEAD') return Promise.resolve(makeResponse({ status: 405 }));
        return Promise.resolve(
          makeResponse({ status: 200, headers: { 'content-type': 'text/html' } }),
        );
      }
      return Promise.resolve(makeResponse({ status: 404 }));
    };

    const presence = await detectSiteFiles('https://spa.example/', { fetcher });
    expect(presence.llmsTxt).toBe(false);
  });

  it('accepts the correct content-types for each file', async () => {
    const { fetcher } = makeFetcher({
      'https://example.com/robots.txt': { status: 200, headers: { 'content-type': 'text/plain' } },
      'https://example.com/sitemap.xml': {
        status: 200,
        headers: { 'content-type': 'application/xml' },
      },
      'https://example.com/llms.txt': { status: 200, headers: { 'content-type': 'text/markdown' } },
      'https://example.com/favicon.ico': {
        status: 200,
        headers: { 'content-type': 'image/x-icon' },
      },
    });

    const presence = await detectSiteFiles('https://example.com/', { fetcher });
    expect(presence).toMatchObject({
      robotsTxt: true,
      sitemapXml: true,
      llmsTxt: true,
      favicon: true,
    });
  });
});
