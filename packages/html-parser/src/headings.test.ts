import { describe, expect, it } from 'vitest';

import { extractHeadings, isHeadingHierarchyValid } from './index.js';
import { RICH_PAGE_HTML, SPARSE_PAGE_HTML } from './fixtures.js';

describe('extractHeadings', () => {
  it('extracts the heading tree in document order with correct levels', () => {
    const headings = extractHeadings(RICH_PAGE_HTML);
    expect(headings.map((h) => h.level)).toEqual([1, 2, 3, 2]);
    expect(headings[0]?.text).toBe('Best Espresso Machines');
    expect(headings[1]?.text).toBe('How do espresso machines work?');
  });

  it('skips empty/whitespace-only headings', () => {
    const headings = extractHeadings('<h1>  </h1><h2>Real</h2>');
    expect(headings).toHaveLength(1);
    expect(headings[0]?.text).toBe('Real');
  });
});

describe('isHeadingHierarchyValid', () => {
  it('is valid for the rich page (h1→h2→h3, then back up to h2)', () => {
    expect(isHeadingHierarchyValid(extractHeadings(RICH_PAGE_HTML))).toBe(true);
  });

  it('is invalid for the sparse page that skips h1→h3', () => {
    expect(isHeadingHierarchyValid(extractHeadings(SPARSE_PAGE_HTML))).toBe(false);
  });

  it('treats an empty heading list as trivially valid', () => {
    expect(isHeadingHierarchyValid([])).toBe(true);
  });

  it('allows jumping back up multiple levels (h3→h1)', () => {
    expect(
      isHeadingHierarchyValid([
        { level: 1, text: 'a' },
        { level: 2, text: 'b' },
        { level: 3, text: 'c' },
        { level: 1, text: 'd' },
      ]),
    ).toBe(true);
  });
});
