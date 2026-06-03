import { describe, expect, it } from 'vitest';

import { collectJsonLdTypes, extractRawStructuredData, jsonLdHasType } from './index.js';
import { RICH_PAGE_HTML, SPARSE_PAGE_HTML } from './fixtures.js';

describe('extractRawStructuredData', () => {
  it('collects JSON-LD plus microdata and RDFa markers from a rich page', () => {
    const blocks = extractRawStructuredData(RICH_PAGE_HTML);
    const formats = blocks.map((b) => b.format);
    expect(formats).toContain('json-ld');
    expect(formats).toContain('microdata');
    expect(formats).toContain('rdfa');

    const jsonLd = blocks.find((b) => b.format === 'json-ld');
    expect(jsonLd?.data).toMatchObject({ '@type': 'FAQPage' });
  });

  it('returns no blocks for a page without structured data', () => {
    expect(extractRawStructuredData(SPARSE_PAGE_HTML)).toEqual([]);
  });

  it('silently skips malformed JSON-LD instead of throwing', () => {
    const html = `<script type="application/ld+json">{ not valid json }</script>
      <script type="application/ld+json">{"@type":"Article"}</script>`;
    const blocks = extractRawStructuredData(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.format).toBe('json-ld');
  });
});

describe('collectJsonLdTypes', () => {
  it('collects nested and array @type values', () => {
    const types = collectJsonLdTypes({
      '@type': 'WebPage',
      mainEntity: [{ '@type': 'FAQPage' }, { '@type': ['Question', 'Thing'] }],
    });
    expect([...types].sort()).toEqual(['FAQPage', 'Question', 'Thing', 'WebPage']);
  });
});

describe('jsonLdHasType', () => {
  it('detects an FAQPage type case-insensitively', () => {
    const blocks = extractRawStructuredData(RICH_PAGE_HTML);
    expect(jsonLdHasType(blocks, 'faqpage')).toBe(true);
    expect(jsonLdHasType(blocks, 'HowTo')).toBe(false);
  });
});
