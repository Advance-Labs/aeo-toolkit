import { describe, expect, it } from 'vitest';
import { checkDuplicate, fingerprint, jaccard, tokenize } from './dedup.js';

describe('tokenize', () => {
  it('lowercases, strips punctuation, and drops empties', () => {
    expect(tokenize('Hello, WORLD! 123 — test.')).toEqual(['hello', 'world', '123', 'test']);
  });

  it('returns an empty array for whitespace-only input', () => {
    expect(tokenize('   \n\t  ')).toEqual([]);
  });
});

describe('fingerprint', () => {
  it('produces sorted, de-duplicated word shingles', () => {
    // tokens: the cat sat on the mat -> 2-grams sorted, "the" shingle appears once.
    const fp = fingerprint('the cat sat on the mat');
    expect(fp).toEqual(['cat sat', 'on the', 'sat on', 'the cat', 'the mat']);
  });

  it('collapses short input below the shingle size into one shingle', () => {
    expect(fingerprint('one')).toEqual(['one']);
    expect(fingerprint('')).toEqual([]);
  });

  it('is order-insensitive in set membership, not in content', () => {
    const a = fingerprint('alpha beta gamma');
    const b = fingerprint('gamma beta alpha');
    // Different shingles, so not equal — Jaccard measures the overlap instead.
    expect(a).not.toEqual(b);
    expect(jaccard(a, b)).toBeLessThan(1);
  });
});

describe('jaccard', () => {
  it('returns 1 for identical fingerprints', () => {
    const fp = fingerprint('answer engine optimization for blogs');
    expect(jaccard(fp, fp)).toBe(1);
  });

  it('returns 1 for two empty fingerprints and 0 when only one is empty', () => {
    expect(jaccard([], [])).toBe(1);
    expect(jaccard([], ['a b'])).toBe(0);
    expect(jaccard(['a b'], [])).toBe(0);
  });

  it('computes overlap correctly for partial matches', () => {
    // A = {x, y, z}, B = {y, z, w} -> intersection 2, union 4 -> 0.5
    expect(jaccard(['x', 'y', 'z'], ['y', 'z', 'w'])).toBe(0.5);
  });

  it('de-duplicates within each fingerprint before measuring', () => {
    // Repeated shingles must not inflate the union.
    expect(jaccard(['a', 'a', 'b'], ['a', 'b'])).toBe(1);
  });

  it('is high for near-duplicate prose and low for unrelated prose', () => {
    const original = fingerprint('how to optimize your blog for answer engines in 2026');
    const nearDup = fingerprint('how to optimize your blog for answer engines in 2025');
    const unrelated = fingerprint('the best espresso machines for home baristas');
    expect(jaccard(original, nearDup)).toBeGreaterThan(0.7);
    expect(jaccard(original, unrelated)).toBeLessThan(0.1);
  });
});

describe('checkDuplicate', () => {
  const corpus = [
    { slug: 'aeo-guide', fingerprint: fingerprint('how to optimize your blog for answer engines') },
    { slug: 'espresso', fingerprint: fingerprint('the best espresso machines for home baristas') },
  ];

  it('flags a near-duplicate above the threshold and reports the nearest match', () => {
    const candidate = fingerprint('how to optimize your blog for answer engines today');
    const result = checkDuplicate(candidate, corpus, 0.6);
    expect(result.isDuplicate).toBe(true);
    expect(result.nearest?.slug).toBe('aeo-guide');
    expect(result.nearest?.similarity).toBeGreaterThan(0.6);
  });

  it('passes a novel candidate and still reports its nearest (sub-threshold) match', () => {
    const candidate = fingerprint('a complete history of typewriter design');
    const result = checkDuplicate(candidate, corpus, 0.6);
    expect(result.isDuplicate).toBe(false);
    expect(result.nearest).toBeDefined();
    expect(result.nearest?.similarity).toBeLessThan(0.6);
  });

  it('handles an empty corpus', () => {
    const result = checkDuplicate(fingerprint('anything'), [], 0.6);
    expect(result.isDuplicate).toBe(false);
    expect(result.nearest).toBeUndefined();
  });
});
