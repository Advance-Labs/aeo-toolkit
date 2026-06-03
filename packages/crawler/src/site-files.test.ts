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
