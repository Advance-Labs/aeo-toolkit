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

  it('treats an empty alt="" as not having descriptive alt text', () => {
    const images = extractImages(SPARSE_PAGE_HTML, FIXTURE_URL);
    expect(images).toHaveLength(1);
    expect(images[0]?.hasAlt).toBe(false);
    expect(images[0]?.alt).toBe('');
    expect(images[0]?.src).toBe('https://shop.example.com/guides/logo.png');
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
});
