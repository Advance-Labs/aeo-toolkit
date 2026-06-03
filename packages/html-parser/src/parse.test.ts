import { describe, expect, it } from 'vitest';

import { parseHtml } from './index.js';
import { FIXTURE_URL, RICH_PAGE_HTML, SPARSE_PAGE_HTML } from './fixtures.js';

describe('parseHtml', () => {
  it('assembles a complete ParsedHtml from a rich page', () => {
    const result = parseHtml(RICH_PAGE_HTML, FIXTURE_URL);

    expect(result.url).toBe(FIXTURE_URL);
    expect(result.meta.title).toBe("Best Espresso Machines — Buyer's Guide");
    expect(result.openGraph.complete).toBe(true);
    expect(result.twitter.card).toBe('summary_large_image');

    expect(result.headings.map((h) => h.level)).toEqual([1, 2, 3, 2]);
    expect(result.headingHierarchyValid).toBe(true);

    expect(result.images).toHaveLength(2);
    expect(result.imageAltCoverage).toBe(0.5);

    expect(result.internalLinkCount).toBe(1);
    expect(result.externalLinkCount).toBe(1);

    expect(result.content.hasFaq).toBe(true);
    expect(result.content.questionHeadingCount).toBe(1);

    expect(result.rawStructuredData.map((b) => b.format)).toEqual(
      expect.arrayContaining(['json-ld', 'microdata', 'rdfa']),
    );
  });

  it('handles a sparse page without throwing and flags invalid hierarchy', () => {
    const result = parseHtml(SPARSE_PAGE_HTML, FIXTURE_URL);

    expect(result.meta.description).toBeUndefined();
    expect(result.openGraph.complete).toBe(false);
    expect(result.headingHierarchyValid).toBe(false);
    expect(result.rawStructuredData).toEqual([]);
    expect(result.content.hasFaq).toBe(false);
    // The `javascript:` link is the only anchor; it is non-internal.
    expect(result.internalLinkCount).toBe(0);
  });

  it('does not throw on empty input', () => {
    const result = parseHtml('', FIXTURE_URL);
    expect(result.headings).toEqual([]);
    expect(result.images).toEqual([]);
    expect(result.links).toEqual([]);
    expect(result.content.wordCount).toBe(0);
    expect(result.imageAltCoverage).toBe(1);
  });
});
