import { describe, expect, it } from 'vitest';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { extractRdfa } from './rdfa.js';

function load(html: string): CheerioAPI {
  return cheerio.load(html);
}

describe('extractRdfa', () => {
  it('extracts a flat Person resource', () => {
    const html = `
      <div vocab="https://schema.org/" typeof="Person">
        <span property="name">Jane Doe</span>
      </div>`;
    const items = extractRdfa(load(html));
    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe('Person');
    expect(items[0]?.properties['name']).toBe('Jane Doe');
    expect(items[0]?.valid).toBe(true);
  });

  it('prefers content/href/datetime over text for values', () => {
    const html = `
      <div vocab="https://schema.org/" typeof="Article">
        <span property="headline">My Post</span>
        <a property="url" href="https://example.com/p">link text</a>
        <time property="datePublished" datetime="2026-02-02">Feb 2</time>
        <meta property="wordCount" content="500" />
      </div>`;
    const items = extractRdfa(load(html));
    const item = items[0];
    expect(item?.properties['url']).toBe('https://example.com/p');
    expect(item?.properties['datePublished']).toBe('2026-02-02');
    expect(item?.properties['wordCount']).toBe('500');
    expect(item?.valid).toBe(true);
  });

  it('captures a nested typed resource as a child object', () => {
    const html = `
      <div vocab="https://schema.org/" typeof="Product">
        <span property="name">Gadget</span>
        <div property="review" typeof="Review">
          <span property="reviewRating">5</span>
        </div>
      </div>`;
    const items = extractRdfa(load(html));
    expect(items).toHaveLength(1); // nested Review is not top-level
    const product = items[0];
    expect(product?.properties['review']).toMatchObject({
      '@type': 'Review',
      reviewRating: '5',
    });
  });

  it('flags a Review missing reviewRating', () => {
    const html = `
      <div vocab="https://schema.org/" typeof="Review">
        <span property="author">Anon</span>
      </div>`;
    const items = extractRdfa(load(html));
    expect(items[0]?.valid).toBe(false);
    expect(items[0]?.missingRequired).toContain('reviewRating');
  });

  it('normalizes a prefixed typeof to its short name', () => {
    const html = `<div typeof="schema:Organization"><span property="name">X</span></div>`;
    const items = extractRdfa(load(html));
    expect(items[0]?.type).toBe('Organization');
  });
});
