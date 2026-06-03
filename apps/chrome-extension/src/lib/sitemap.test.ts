import { describe, expect, it } from 'vitest';
import { parseSitemap } from './sitemap.js';

describe('parseSitemap', () => {
  it('returns no entries for null input', () => {
    expect(parseSitemap(null)).toEqual([]);
  });

  it('extracts <url><loc> entries with lastmod', () => {
    const xml = `<?xml version="1.0"?>
      <urlset>
        <url><loc>https://example.com/</loc><lastmod>2024-01-01</lastmod></url>
        <url><loc>https://example.com/about</loc></url>
      </urlset>`;
    const entries = parseSitemap(xml);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ loc: 'https://example.com/', lastmod: '2024-01-01' });
    expect(entries[1]).toEqual({ loc: 'https://example.com/about' });
  });

  it('handles a sitemap index (loc without url wrappers)', () => {
    const xml = `<sitemapindex>
      <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
      <sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap>
    </sitemapindex>`;
    const entries = parseSitemap(xml);
    expect(entries.map((e) => e.loc)).toEqual([
      'https://example.com/sitemap-1.xml',
      'https://example.com/sitemap-2.xml',
    ]);
  });
});
