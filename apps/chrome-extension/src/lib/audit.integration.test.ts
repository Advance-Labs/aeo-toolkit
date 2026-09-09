/**
 * Integration guard for the SHIPPED audit pipeline.
 *
 * `audit.test.ts` mocks the @advance-labs/* packages to test this app's wiring in
 * isolation. This file deliberately does NOT mock them: it runs the real
 * parser/validator/scoring chain the packaged extension bundles, so a stale
 * workspace `dist/` cannot ship scoring bugs the packages themselves have fixed.
 *
 * That is not hypothetical. v0.1.0 was uploaded to the Chrome Web Store one day
 * before the three accuracy fixes in 603ab7c (ADV-173/174/175) landed, and the
 * published build mis-scored correct markup for the extension's whole shelf life.
 * Each case below is one of those three bugs.
 */
import { describe, expect, it } from 'vitest';

import { buildSinglePageContext } from './audit.js';

function ctxFor(html: string) {
  return buildSinglePageContext({
    pageUrl: 'https://example.com/',
    html,
    startedAtMs: Date.now(),
    siteFiles: {
      robotsTxt: { body: null, exists: false },
      sitemapXml: { body: null, exists: false },
      llmsTxt: { body: null, exists: false },
      llmsFullTxt: { body: null, exists: false },
      favicon: { body: null, exists: false },
    },
  });
}

describe('shipped pipeline — ADV-173: nested @graph node types', () => {
  it('sees a Person nested inside an @graph node, not just at the top level', () => {
    const html = `<html><head><title>t</title>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Article',
            headline: 'Hello',
            author: { '@type': 'Person', name: 'Lucas Krawczak' },
          },
        ],
      })}</script></head><body><p>hi</p></body></html>`;

    const { structured: sd } = ctxFor(html);
    expect(sd.hasArticle).toBe(true);
    // The v0.1.0 bug: this read `false` because only top-level @graph node
    // types were collected, so `author: Person` was invisible.
    expect(sd.hasPerson).toBe(true);
  });
});

describe('shipped pipeline — ADV-174: decorative alt=""', () => {
  it('excludes alt="" images from alt coverage instead of counting them as missing', () => {
    const html = `<html><head><title>t</title></head><body>
      <img src="/a.png" alt="A real description">
      <img src="/spacer.png" alt="">
    </body></html>`;

    const { parsed } = ctxFor(html);
    // The v0.1.0 bug: the decorative image counted against the ratio, giving 0.5.
    expect(parsed.imageAltCoverage).toBe(1);
    expect(parsed.images.find((i) => i.src.includes('spacer'))?.isDecorative).toBe(true);
  });
});
