/** Heading-tree extraction and hierarchy validation. */
import type { CheerioAPI } from 'cheerio';
import type { HeadingNode } from '@advance-labs/types';

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

/** Map a tag name (`h3`) to its numeric level, or `undefined` if not a heading. */
function levelOf(tagName: string): HeadingNode['level'] | undefined {
  const match = /^h([1-6])$/i.exec(tagName);
  if (match === null) return undefined;
  const n = Number(match[1]);
  // The regex guarantees 1..6, but narrow explicitly for the union type.
  if (n >= 1 && n <= 6) return n as HeadingNode['level'];
  return undefined;
}

/**
 * Extract headings h1–h6 in document order. Empty (whitespace-only) headings
 * are skipped — they carry no semantic content and would distort hierarchy.
 */
export function extractHeadings($: CheerioAPI): HeadingNode[] {
  const headings: HeadingNode[] = [];
  $(HEADING_SELECTOR).each((_, el) => {
    // Selector restricts matches to element nodes, which carry `tagName`.
    const level = levelOf(el.tagName);
    if (level === undefined) return;
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length === 0) return;
    headings.push({ level, text });
  });
  return headings;
}

/**
 * Valid when headings never skip a level *downward* (going deeper). h1→h2→h3
 * is fine; h1→h3 (skipping h2) is not. Moving back up any number of levels is
 * always allowed (h3→h1). An empty or single-heading list is trivially valid.
 */
export function isHeadingHierarchyValid(headings: HeadingNode[]): boolean {
  let previous: number | undefined;
  for (const heading of headings) {
    if (previous !== undefined && heading.level > previous + 1) {
      return false;
    }
    previous = heading.level;
  }
  return true;
}
