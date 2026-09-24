import { describe, expect, it } from 'vitest';
import { describeAuthority } from './authority-bands';

describe('describeAuthority', () => {
  /**
   * The rule the whole feature is built on, restated at the presentation layer:
   * absent from the index is not a score of zero, and must not fall through to
   * the bottom band.
   */
  it('reports an absent domain as absent, never as the bottom band', () => {
    const verdict = describeAuthority(null);
    expect(verdict.band).toBe('Not in the index');
    expect(verdict.meaning).toMatch(/not a score of zero/i);
  });

  it('places real reference points in the bands they were calibrated against', () => {
    // Live figures from the index on 2026-09-24.
    expect(describeAuthority(8.9).band).toBe('Widely cited');
    expect(describeAuthority(1.35).band).toBe('Early');
  });

  it('is inclusive at each cut point', () => {
    expect(describeAuthority(7).band).toBe('Widely cited');
    expect(describeAuthority(5).band).toBe('Established');
    expect(describeAuthority(3).band).toBe('Building');
    expect(describeAuthority(1).band).toBe('Early');
    expect(describeAuthority(0).band).toBe('Barely linked');
  });

  it('separates a zero score from an absent one', () => {
    expect(describeAuthority(0).band).not.toBe(describeAuthority(null).band);
  });

  /**
   * The positioning, enforced. A low score describes a young site; it is not a
   * problem the reader caused. If this test fails, someone has made the tool
   * scarier, which is a product decision and not a refactor.
   */
  it('never returns a warning tone at any score', () => {
    for (let score = 0; score <= 10; score += 0.1) {
      expect(describeAuthority(Number(score.toFixed(1))).tone).not.toBe('warn');
    }
    expect(describeAuthority(null).tone).not.toBe('warn');
  });

  it('always gives a band and a full sentence', () => {
    for (const score of [null, 0, 0.5, 2, 4, 6, 8, 10]) {
      const verdict = describeAuthority(score);
      expect(verdict.band.length).toBeGreaterThan(0);
      expect(verdict.meaning).toMatch(/\.$/);
    }
  });

  it('refuses to interpret a score outside the published range', () => {
    expect(describeAuthority(-1).band).toBe('Unreadable');
  });
});
