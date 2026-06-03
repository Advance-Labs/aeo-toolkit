import { describe, expect, it } from 'vitest';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { extractMicrodata } from './microdata.js';

function load(html: string): CheerioAPI {
  return cheerio.load(html);
}

describe('extractMicrodata', () => {
  it('extracts a flat Organization item', () => {
    const html = `
      <div itemscope itemtype="https://schema.org/Organization">
        <span itemprop="name">Advance Labs</span>
        <a itemprop="url" href="https://example.com">site</a>
      </div>`;
    const items = extractMicrodata(load(html));
    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe('Organization');
    expect(items[0]?.properties['name']).toBe('Advance Labs');
    expect(items[0]?.properties['url']).toBe('https://example.com');
    expect(items[0]?.valid).toBe(true);
  });

  it('nests a child itemscope and keeps its props off the parent', () => {
    const html = `
      <div itemscope itemtype="https://schema.org/Product">
        <span itemprop="name">Widget</span>
        <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <meta itemprop="price" content="9.99" />
        </div>
      </div>`;
    const items = extractMicrodata(load(html));
    expect(items).toHaveLength(1); // nested Offer is not a top-level item
    const product = items[0];
    expect(product?.properties['name']).toBe('Widget');
    expect(product?.properties['price']).toBeUndefined(); // belongs to nested Offer
    expect(product?.properties['offers']).toMatchObject({ '@type': 'Offer', price: '9.99' });
  });

  it('flags a Product missing its name', () => {
    const html = `
      <div itemscope itemtype="https://schema.org/Product">
        <span itemprop="sku">ABC</span>
      </div>`;
    const items = extractMicrodata(load(html));
    expect(items[0]?.valid).toBe(false);
    expect(items[0]?.missingRequired).toContain('name');
  });

  it('reads typed value attributes (time/meta/img)', () => {
    const html = `
      <article itemscope itemtype="https://schema.org/Article">
        <h1 itemprop="headline">Title</h1>
        <time itemprop="datePublished" datetime="2026-01-01">Jan 1</time>
        <img itemprop="image" src="https://example.com/a.png" />
      </article>`;
    const items = extractMicrodata(load(html));
    const item = items[0];
    expect(item?.properties['datePublished']).toBe('2026-01-01');
    expect(item?.properties['image']).toBe('https://example.com/a.png');
    expect(item?.valid).toBe(true);
  });

  it('ignores itemscope elements without an itemtype', () => {
    const html = `<div itemscope><span itemprop="x">y</span></div>`;
    const items = extractMicrodata(load(html));
    expect(items).toHaveLength(0);
  });
});
