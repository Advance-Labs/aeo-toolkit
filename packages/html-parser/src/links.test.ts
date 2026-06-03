import { describe, expect, it } from 'vitest';

import { extractLinks, externalLinkCount, internalLinkCount } from './index.js';
import { FIXTURE_URL, RICH_PAGE_HTML } from './fixtures.js';

describe('extractLinks', () => {
  it('classifies internal/external by host and reads nofollow from rel', () => {
    const links = extractLinks(RICH_PAGE_HTML, FIXTURE_URL);
    // The `#top` anchor is skipped, leaving the internal guide link + external review.
    expect(links).toHaveLength(2);

    const internal = links.find((l) => l.href.includes('/guides/grinders'));
    expect(internal?.internal).toBe(true);
    expect(internal?.nofollow).toBe(false);
    expect(internal?.text).toBe('Our grinder guide');

    const external = links.find((l) => l.href.includes('external.example.org'));
    expect(external?.internal).toBe(false);
    expect(external?.nofollow).toBe(true);
    expect(external?.rel).toBe('nofollow noopener');
  });

  it('skips fragment-only and empty hrefs', () => {
    const links = extractLinks('<a href="#x">x</a><a href="">y</a><a href="/z">z</a>', FIXTURE_URL);
    expect(links).toHaveLength(1);
    expect(links[0]?.href).toBe('https://shop.example.com/z');
  });
});

describe('internalLinkCount / externalLinkCount', () => {
  it('counts internal and external links from the rich page', () => {
    const links = extractLinks(RICH_PAGE_HTML, FIXTURE_URL);
    expect(internalLinkCount(links)).toBe(1);
    expect(externalLinkCount(links)).toBe(1);
  });
});
