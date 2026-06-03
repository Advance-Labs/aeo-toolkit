import { describe, expect, it } from 'vitest';
import { isAeoSchemaType, normalizeTypes, toShortType } from './types-map.js';

describe('toShortType', () => {
  it('returns a bare short name unchanged', () => {
    expect(toShortType('FAQPage')).toBe('FAQPage');
  });

  it('strips https/http schema.org prefixes', () => {
    expect(toShortType('https://schema.org/Organization')).toBe('Organization');
    expect(toShortType('http://schema.org/Person')).toBe('Person');
  });

  it('handles a trailing slash and CURIE form', () => {
    expect(toShortType('https://schema.org/Product/')).toBe('Product');
    expect(toShortType('schema:Review')).toBe('Review');
  });

  it('handles a hash fragment', () => {
    expect(toShortType('http://schema.org/docs/full.html#Article')).toBe('Article');
  });
});

describe('normalizeTypes', () => {
  it('de-duplicates and preserves order across an array', () => {
    expect(normalizeTypes(['https://schema.org/Product', 'Product', 'Review'])).toEqual([
      'Product',
      'Review',
    ]);
  });

  it('returns an empty list for non-string input', () => {
    expect(normalizeTypes(undefined)).toEqual([]);
    expect(normalizeTypes(42)).toEqual([]);
  });
});

describe('isAeoSchemaType', () => {
  it('accepts AEO-relevant types and rejects others', () => {
    expect(isAeoSchemaType('FAQPage')).toBe(true);
    expect(isAeoSchemaType('LocalBusiness')).toBe(true);
    expect(isAeoSchemaType('SoftwareApplication')).toBe(false);
  });
});
