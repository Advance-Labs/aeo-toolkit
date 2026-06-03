import { describe, expect, it } from 'vitest';

import { extractMeta, extractOpenGraph, extractTwitter } from './index.js';
import { FIXTURE_URL, RICH_PAGE_HTML, SPARSE_PAGE_HTML } from './fixtures.js';

describe('extractMeta', () => {
  it('extracts title/description with lengths, canonical, robots, viewport, charset, lang, themeColor on a rich page', () => {
    const meta = extractMeta(RICH_PAGE_HTML, FIXTURE_URL);
    expect(meta.title).toBe("Best Espresso Machines — Buyer's Guide");
    expect(meta.titleLength).toBe(meta.title?.length);
    expect(meta.description).toContain('independent guide');
    expect(meta.descriptionLength).toBeGreaterThan(0);
    expect(meta.canonical).toBe('https://shop.example.com/guides/espresso');
    expect(meta.robots).toBe('index, follow');
    expect(meta.viewport).toContain('width=device-width');
    expect(meta.charset).toBe('utf-8');
    expect(meta.lang).toBe('en');
    expect(meta.themeColor).toBe('#6f4e37');
  });

  it('returns zero lengths and undefined optionals for a sparse page', () => {
    const meta = extractMeta(SPARSE_PAGE_HTML, FIXTURE_URL);
    expect(meta.title).toBe('Untitled');
    expect(meta.description).toBeUndefined();
    expect(meta.descriptionLength).toBe(0);
    expect(meta.canonical).toBeUndefined();
    expect(meta.robots).toBeUndefined();
    expect(meta.lang).toBeUndefined();
    expect(meta.themeColor).toBeUndefined();
  });

  it('resolves a relative canonical href against the page URL', () => {
    const meta = extractMeta(
      '<html><head><link rel="canonical" href="/x/y"></head></html>',
      'https://site.test/a/b',
    );
    expect(meta.canonical).toBe('https://site.test/x/y');
  });
});

describe('extractOpenGraph', () => {
  it('marks complete when the og quartet is present and resolves relative og:image', () => {
    const og = extractOpenGraph(RICH_PAGE_HTML, FIXTURE_URL);
    expect(og.title).toBe('Best Espresso Machines');
    expect(og.complete).toBe(true);
    expect(og.image).toBe('https://shop.example.com/images/og-espresso.jpg');
    expect(og.type).toBe('article');
    expect(og.siteName).toBe('Example Shop');
  });

  it('is incomplete when any of the core quartet is missing', () => {
    const og = extractOpenGraph(
      '<html><head><meta property="og:title" content="Only a title"></head></html>',
      FIXTURE_URL,
    );
    expect(og.title).toBe('Only a title');
    expect(og.complete).toBe(false);
    expect(og.image).toBeUndefined();
  });
});

describe('extractTwitter', () => {
  it('extracts twitter card tags from name= attributes', () => {
    const tw = extractTwitter(RICH_PAGE_HTML, FIXTURE_URL);
    expect(tw.card).toBe('summary_large_image');
    expect(tw.title).toBe('Best Espresso Machines');
    expect(tw.site).toBe('@exampleshop');
    expect(tw.image).toBe('https://shop.example.com/images/tw-espresso.jpg');
  });

  it('also reads twitter tags expressed via property= attributes', () => {
    const tw = extractTwitter(
      '<html><head><meta property="twitter:card" content="summary"></head></html>',
      FIXTURE_URL,
    );
    expect(tw.card).toBe('summary');
  });
});
