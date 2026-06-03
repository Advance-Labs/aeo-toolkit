import { describe, expect, it } from 'vitest';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { extractJsonLd } from './json-ld.js';

function load(html: string): CheerioAPI {
  return cheerio.load(html);
}

describe('extractJsonLd', () => {
  it('flattens @graph members into separate items', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", "name": "Advance Labs" },
          { "@type": "WebSite", "url": "https://example.com" }
        ]
      }
      </script>`;
    const items = extractJsonLd(load(html));
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.type)).toEqual(['Organization', 'WebSite']);
    expect(items[0]?.valid).toBe(true);
  });

  it('handles a top-level array of objects', () => {
    const html = `
      <script type="application/ld+json">
      [
        { "@context": "https://schema.org", "@type": "Person", "name": "A" },
        { "@context": "https://schema.org", "@type": "Person", "name": "B" }
      ]
      </script>`;
    const items = extractJsonLd(load(html));
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.type === 'Person' && i.valid)).toBe(true);
  });

  it('normalizes a full-URL @type to its short name', () => {
    const html = `
      <script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "https://schema.org/Organization", "name": "X" }
      </script>`;
    const items = extractJsonLd(load(html));
    expect(items[0]?.type).toBe('Organization');
  });

  it('flags a missing required property as invalid', () => {
    const html = `
      <script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "BlogPosting" }
      </script>`;
    const items = extractJsonLd(load(html));
    expect(items[0]?.valid).toBe(false);
    expect(items[0]?.missingRequired).toContain('headline');
  });

  it('records a warning and stays invalid on malformed JSON', () => {
    const html = `<script type="application/ld+json">{ not json }</script>`;
    const items = extractJsonLd(load(html));
    expect(items).toHaveLength(1);
    expect(items[0]?.valid).toBe(false);
    expect(items[0]?.warnings[0]).toMatch(/invalid JSON/i);
  });

  it('supports an array @type, validating the union of rules', () => {
    const html = `
      <script type="application/ld+json">
      { "@context":"https://schema.org", "@type":["Product","Review"], "name":"X" }
      </script>`;
    const items = extractJsonLd(load(html));
    // Product satisfied (name) but Review requires reviewRating → invalid.
    expect(items[0]?.type).toBe('Product,Review');
    expect(items[0]?.valid).toBe(false);
    expect(items[0]?.missingRequired).toContain('reviewRating');
  });
});
