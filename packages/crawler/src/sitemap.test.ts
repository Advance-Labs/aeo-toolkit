import { describe, it, expect } from 'vitest';
import { parseSitemap } from './sitemap.js';

describe('parseSitemap', () => {
  it('parses a urlset with multiple entries and optional fields', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/</loc>
          <lastmod>2024-01-01</lastmod>
          <changefreq>daily</changefreq>
          <priority>1.0</priority>
        </url>
        <url>
          <loc>https://example.com/about</loc>
        </url>
      </urlset>`;

    const entries = parseSitemap(xml);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      loc: 'https://example.com/',
      lastmod: '2024-01-01',
      changefreq: 'daily',
      priority: 1.0,
    });
    expect(entries[1]).toEqual({ loc: 'https://example.com/about' });
  });

  it('parses a urlset with a single <url> (parser collapses to object, isArray fixes it)', () => {
    const xml = `<urlset><url><loc>https://example.com/only</loc></url></urlset>`;
    const entries = parseSitemap(xml);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.loc).toBe('https://example.com/only');
  });

  it('parses a sitemap index into entries pointing at child sitemaps', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
          <loc>https://example.com/sitemap-1.xml</loc>
          <lastmod>2024-02-02</lastmod>
        </sitemap>
        <sitemap>
          <loc>https://example.com/sitemap-2.xml</loc>
        </sitemap>
      </sitemapindex>`;

    const entries = parseSitemap(xml);
    expect(entries.map((e) => e.loc)).toEqual([
      'https://example.com/sitemap-1.xml',
      'https://example.com/sitemap-2.xml',
    ]);
    expect(entries[0]?.lastmod).toBe('2024-02-02');
  });

  it('returns an empty array for empty input (edge case)', () => {
    expect(parseSitemap('')).toEqual([]);
    expect(parseSitemap('   ')).toEqual([]);
  });

  it('returns an empty array for malformed / non-sitemap XML (edge case)', () => {
    expect(parseSitemap('<html><body>not a sitemap</body></html>')).toEqual([]);
    expect(parseSitemap('<<<not xml')).toEqual([]);
  });

  it('skips <url> nodes that lack a <loc> (edge case)', () => {
    const xml = `<urlset>
      <url><lastmod>2024-01-01</lastmod></url>
      <url><loc>https://example.com/good</loc></url>
    </urlset>`;
    const entries = parseSitemap(xml);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.loc).toBe('https://example.com/good');
  });

  it('keeps a numeric-looking loc as a string (parseTagValue off)', () => {
    const xml = `<urlset><url><loc>https://example.com/2024</loc></url></urlset>`;
    const entries = parseSitemap(xml);
    expect(entries[0]?.loc).toBe('https://example.com/2024');
    expect(typeof entries[0]?.loc).toBe('string');
  });
});
