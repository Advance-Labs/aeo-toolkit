import { describe, expect, it } from 'vitest';

import { extractImages, imageAltCoverage } from './index.js';
import { FIXTURE_URL, RICH_PAGE_HTML, SPARSE_PAGE_HTML } from './fixtures.js';

describe('extractImages', () => {
  it('resolves src, captures alt + dimensions, and sets hasAlt', () => {
    const images = extractImages(RICH_PAGE_HTML, FIXTURE_URL);
    expect(images).toHaveLength(2);
    const first = images[0];
    expect(first?.src).toBe('https://shop.example.com/images/machine-1.jpg');
    expect(first?.hasAlt).toBe(true);
    expect(first?.width).toBe(640);
    expect(first?.height).toBe(480);
    const second = images[1];
    expect(second?.hasAlt).toBe(false);
  });

  it('marks an empty alt="" as decorative, not as missing alt text', () => {
    const images = extractImages(SPARSE_PAGE_HTML, FIXTURE_URL);
    expect(images).toHaveLength(1);
    expect(images[0]?.hasAlt).toBe(false);
    expect(images[0]?.isDecorative).toBe(true);
    expect(images[0]?.alt).toBe('');
    expect(images[0]?.src).toBe('https://shop.example.com/guides/logo.png');
  });

  it('a missing alt attribute is an omission, NOT decorative', () => {
    const images = extractImages('<img src="a.png">', FIXTURE_URL);
    expect(images[0]?.hasAlt).toBe(false);
    expect(images[0]?.isDecorative).toBe(false);
  });

  it('drops images without a src', () => {
    const images = extractImages('<img alt="no source"><img src="ok.png" alt="ok">', FIXTURE_URL);
    expect(images).toHaveLength(1);
  });
});

describe('imageAltCoverage', () => {
  it('computes the fraction of images with alt text', () => {
    const images = extractImages(RICH_PAGE_HTML, FIXTURE_URL);
    expect(imageAltCoverage(images)).toBe(0.5);
  });

  it('returns 1 for an empty image set', () => {
    expect(imageAltCoverage([])).toBe(1);
  });

  // ADV-174. This is the assertion the bug failed: advancelabs.dev had 19 images, 11 described
  // and 8 correctly marked decorative, and scored 58% instead of 100%.
  it('excludes decorative alt="" images from the ratio entirely', () => {
    const html = '<img src="a.png" alt="A described thing">' + '<img src="b.png" alt="">'.repeat(8);
    expect(imageAltCoverage(extractImages(html, FIXTURE_URL))).toBe(1);
  });

  it('scores 1 for a page of only decorative images', () => {
    expect(imageAltCoverage(extractImages('<img src="a.png" alt=""><img src="b.png" alt="">', FIXTURE_URL))).toBe(1);
  });

  it('still fails a genuinely missing alt, and decorative images do not rescue it', () => {
    const html = '<img src="a.png" alt=""><img src="b.png"><img src="c.png" alt="described">';
    // scorable = b (missing) + c (described) => 1/2
    expect(imageAltCoverage(extractImages(html, FIXTURE_URL))).toBe(0.5);
  });
});
